import React, { useState, useMemo, useEffect } from 'react';
import { PlayCircle, RefreshCw, TrendingUp, TrendingDown, ChevronDown, ChevronUp, AlertCircle, Clock } from 'lucide-react';
import { StockTransaction, BacktestResult } from '../types';
import { runBacktest, loadDSSLabRawCache, computeVirtualAlignment, buildCompletedTrades } from '../services/stock';
import { getBacktestCache, saveBacktestCache, getTechParameters } from '../services/storage';
import { TECH_SIGNAL_BADGE_CLASS, NEUTRAL_BADGE_CLASS } from '../services/signalColors';

/** DSS 實驗室「±N日最佳進場分析」「出場分析」快取裡，虛擬交易比對只需要用到的欄位 */
interface OptimalEntryLite { symbol: string; category: 'ETF' | '上市' | '上櫃'; bestDate: string; }
/** 出場分析快取，額外帶上 sellTxId／實際-最佳出場日資訊，供「賣出→±10日最佳賣點」交叉比對使用 */
interface OptimalExitLite {
    symbol: string; category: 'ETF' | '上市' | '上櫃'; bestDate: string;
    buyDate: string; sellDate: string; actualReturn: number; bestReturn: number; sellTxId?: string;
}

const CATEGORY_TO_SIZE: Record<'ETF' | '上市' | '上櫃', 'ETF' | 'LARGE_CAP' | 'SMALL_CAP'> = {
    'ETF': 'ETF', '上市': 'LARGE_CAP', '上櫃': 'SMALL_CAP',
};

// 依 techSignal 還原「當天技術面判定條件」，呈現方式與籌碼條件一致（✓/✗ + 門檻）
const buildTechConditions = (row: BacktestResult): { label: string; satisfied: boolean }[] | string => {
    const params = getTechParameters();
    const isETF = row.sizeCategory === 'ETF';
    const isLarge = row.sizeCategory === 'LARGE_CAP';
    const slopeUp = (row.biasSlopes[0] ?? 0) > 0;
    const slopeDown = (row.biasSlopes[0] ?? 0) < 0;

    const buyBias  = isETF ? params.etfBuyBias       : isLarge ? params.largeCapBuyBias       : params.smallCapBuyBias;
    const sbBias   = isETF ? params.etfStrongBuyBias  : isLarge ? params.largeCapStrongBuyBias  : params.smallCapStrongBuyBias;
    const buyRsi   = isETF ? params.etfBuyRsi         : isLarge ? params.largeCapBuyRsi         : params.smallCapBuyRsi;
    const sbRsi    = isETF ? params.etfStrongBuyRsi   : isLarge ? params.largeCapStrongBuyRsi   : params.smallCapStrongBuyRsi;
    const sellBias = isETF ? params.etfPartialSellBias : isLarge ? params.largeCapPartialSellBias : params.smallCapPartialSellBias;
    const sell2Bias = isETF ? params.etfSecondPartialSellBias : isLarge ? params.largeCapForceSellBias : params.smallCapForceSellBias;

    switch (row.techSignal) {
        case 'STRONG_BUY':
            return [
                { label: `乖離 ≤ ${sbBias}%`, satisfied: row.bias20 <= sbBias },
                { label: `RSI < ${sbRsi}`, satisfied: row.rsi < sbRsi },
                { label: '斜率上揚', satisfied: slopeUp },
            ];
        case 'BUY':
            return [
                { label: `乖離 ≤ ${buyBias}%`, satisfied: row.bias20 <= buyBias },
                { label: `RSI < ${buyRsi}`, satisfied: row.rsi < buyRsi },
                { label: '斜率上揚', satisfied: slopeUp },
            ];
        case 'PARTIAL_SELL':
            return [
                { label: `乖離 ≥ +${sellBias}%`, satisfied: row.bias20 >= sellBias },
                { label: '斜率下彎', satisfied: slopeDown },
            ];
        case 'SECOND_PARTIAL_SELL':
        case 'FORCE_SELL':
            return [
                { label: `乖離 ≥ +${sell2Bias}%`, satisfied: row.bias20 >= sell2Bias },
            ];
        case 'STRONG_LAYOUT':
            return '技術面偏多 + 外資/投信同步連買 → 籌碼共振升級';
        case 'WATCH_DIVERGE':
            return '技術面偏多，但外資連賣＋融資連增 → 判定籌碼背離，降級觀察';
        case 'SELL':
            return '技術面中性/風險預警，且外資/投信同步連賣 → 判定法人棄守';
        case 'RISK_ALERT':
            return '乖離已跌破風險預警門檻，尚未達強制停損';
        default:
            return '乖離 / RSI / 斜率皆未達任何門檻，維持觀察';
    }
};

interface Props {
    allTransactions: StockTransaction[];       // 全部交易（用於執行回測 + 快取）
    filteredTransactions: StockTransaction[];  // 日期/搜尋篩選後的交易（用於顯示）
}

const SIGNAL_LABELS: Record<string, string> = {
    STRONG_BUY: '強力布局', BUY: '適合布局', STRONG_LAYOUT: '籌碼共振',
    NONE: '觀察中', RISK_ALERT: '風險預警',
    WATCH_DIVERGE: '籌碼疑慮', PARTIAL_SELL: '高位停利',
    SECOND_PARTIAL_SELL: '嚴重過熱', FORCE_SELL: '強制停利',
    STOP_LOSS_ALERT: '停損預警', SELL: '法人棄守',
};

const getSignalStyle = (sig: string) => TECH_SIGNAL_BADGE_CLASS[sig as keyof typeof TECH_SIGNAL_BADGE_CLASS] ?? NEUTRAL_BADGE_CLASS;

const getChipStyle = (target: string) => {
    if (target.includes('法人棄守')) return 'text-emerald-400';
    if (target.includes('籌碼疑慮')) return 'text-teal-400';
    if (target.includes('籌碼偏多')) return 'text-red-400';
    if (target.includes('籌碼觀察')) return 'text-sky-400';
    if (target.includes('籌碼偏弱')) return 'text-teal-400';
    return 'text-slate-400';
};

const AlignmentBadge = ({ alignment }: { alignment: 'MATCH' | 'DIVERGE' | 'PARTIAL' }) => {
    if (alignment === 'MATCH')   return <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">✓ 吻合</span>;
    if (alignment === 'DIVERGE') return <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">✗ 背離</span>;
    return <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-slate-700/50 text-slate-400 border border-slate-600/30">— 中性</span>;
};

const GapDisplay = ({ gap, type }: { gap: number | null; type: 'buy' | 'sell' }) => {
    if (gap === null) return <span className="text-slate-600 text-xs">-</span>;
    if (type === 'buy') {
        if (gap <= 0) return <span className="text-red-400 text-xs font-mono">已入 {Math.abs(gap).toFixed(1)}%</span>;
        return <span className="text-orange-400 text-xs font-mono">差 +{gap.toFixed(1)}%</span>;
    } else {
        if (gap >= 0) return <span className="text-emerald-400 text-xs font-mono">超出 +{gap.toFixed(1)}%</span>;
        return <span className="text-slate-500 text-xs font-mono">差 {Math.abs(gap).toFixed(1)}%</span>;
    }
};

const formatTimestamp = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return '剛才';
    if (mins < 60) return `${mins} 分鐘前`;
    if (hours < 24) return `${hours} 小時前`;
    return `${days} 天前`;
};

type FilterSide = 'ALL' | 'BUY' | 'SELL';
type FilterAlign = 'ALL' | 'MATCH' | 'DIVERGE' | 'PARTIAL';
type SortKey = 'date' | 'symbol' | 'bias20' | 'rsi' | 'alignment';

export const BacktestView: React.FC<Props> = ({ allTransactions, filteredTransactions }) => {
    const [results, setResults] = useState<BacktestResult[] | null>(null);
    const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState<{ done: number; total: number; symbol: string } | null>(null);
    const [filterSide, setFilterSide] = useState<FilterSide>('ALL');
    const [filterAlign, setFilterAlign] = useState<FilterAlign>('ALL');
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortAsc, setSortAsc] = useState(false);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    // 啟動時讀快取
    useEffect(() => {
        const cache = getBacktestCache();
        if (cache) {
            setResults(cache.results);
            setCacheTimestamp(cache.timestamp);
        }
    }, []);

    const handleRun = async () => {
        setIsRunning(true);
        setProgress(null);
        try {
            const r = await runBacktest(allTransactions, (done, total, sym) => setProgress({ done, total, symbol: sym }));
            setResults(r);
            saveBacktestCache(r);
            setCacheTimestamp(Date.now());
        } catch (e) {
            console.error('Backtest error:', e);
        } finally {
            setIsRunning(false);
            setProgress(null);
        }
    };

    // filteredTransactions 的 id 集合（日期/搜尋已由上層篩好）
    const filteredIds = useMemo(() => new Set(filteredTransactions.map(t => t.id)), [filteredTransactions]);

    const recurringExcludedCount = useMemo(
        () => filteredTransactions.filter(t => t.isRecurring).length,
        [filteredTransactions]
    );

    const displayResults = useMemo(() => {
        if (!results) return [];
        let list = results.filter(r => filteredIds.has(r.tradeId));
        if (filterSide !== 'ALL')  list = list.filter(r => r.side === filterSide);
        if (filterAlign !== 'ALL') list = list.filter(r => r.alignment === filterAlign);
        return [...list].sort((a, b) => {
            let cmp = 0;
            if (sortKey === 'date')      cmp = a.date.localeCompare(b.date);
            else if (sortKey === 'symbol')    cmp = a.symbol.localeCompare(b.symbol);
            else if (sortKey === 'bias20')    cmp = a.bias20 - b.bias20;
            else if (sortKey === 'rsi')       cmp = a.rsi - b.rsi;
            else if (sortKey === 'alignment') cmp = a.alignment.localeCompare(b.alignment);
            return sortAsc ? cmp : -cmp;
        });
    }, [results, filteredIds, filterSide, filterAlign, sortKey, sortAsc]);

    const stats = useMemo(() => {
        const list = results ? results.filter(r => filteredIds.has(r.tradeId)) : [];
        if (!list.length) return null;
        const buys  = list.filter(r => r.side === 'BUY');
        const sells = list.filter(r => r.side === 'SELL');
        const buyMatch  = buys.filter(r => r.alignment === 'MATCH').length;
        const sellMatch = sells.filter(r => r.alignment === 'MATCH').length;
        const buyDiverge  = buys.filter(r => r.alignment === 'DIVERGE').length;
        const sellDiverge = sells.filter(r => r.alignment === 'DIVERGE').length;
        const sellMatchPnL   = sells.filter(r => r.alignment === 'MATCH'   && r.realizedProfit !== undefined && r.realizedProfit !== 0);
        const sellDivergePnL = sells.filter(r => r.alignment === 'DIVERGE' && r.realizedProfit !== undefined && r.realizedProfit !== 0);
        const avgPnL = (arr: BacktestResult[]) => arr.length ? arr.reduce((s, r) => s + (r.realizedProfit ?? 0), 0) / arr.length : null;
        return {
            total: list.length, buys: buys.length, sells: sells.length,
            buyMatch, buyDiverge, sellMatch, sellDiverge,
            buyMatchRate:  buys.length  ? (buyMatch  / buys.length  * 100) : 0,
            sellMatchRate: sells.length ? (sellMatch / sells.length * 100) : 0,
            avgPnLMatch:   avgPnL(sellMatchPnL),
            avgPnLDiverge: avgPnL(sellDivergePnL),
        };
    }, [results, filteredIds]);

    // DSS 實驗室「±N日最佳進場分析／出場分析」快取，供虛擬交易比對與「背離×損益」「最佳賣點」交叉比對共用
    const dssLabCaches = useMemo(() => {
        let optimalResults: OptimalEntryLite[] = [];
        let exitResults: OptimalExitLite[] = [];
        try {
            const raw = JSON.parse(localStorage.getItem('ft_dsslab_optimal_cache') || 'null');
            if (Array.isArray(raw?.results)) optimalResults = raw.results;
        } catch { /* 忽略損壞快取 */ }
        try {
            const raw = JSON.parse(localStorage.getItem('ft_dsslab_exit_cache') || 'null');
            if (Array.isArray(raw?.results)) exitResults = raw.results;
        } catch { /* 忽略損壞快取 */ }
        return { optimalResults, exitResults };
    }, [results]);

    // 完整交易（FIFO 配對），供「買進背離×已實現損益」交叉比對用；獨立算一次，跟 DSS 實驗室的標的勝率排行共用同一套邏輯
    const completedTrades = useMemo(() => buildCompletedTrades(allTransactions), [allTransactions]);

    // tradeId(買進) → 配對到的完整交易；tradeId(賣出) → 出場分析算出的最佳賣點
    const completedByBuyTxId = useMemo(() => {
        const map = new Map<string, typeof completedTrades>();
        for (const t of completedTrades) {
            if (!t.buyTxId) continue;
            const arr = map.get(t.buyTxId) ?? [];
            arr.push(t);
            map.set(t.buyTxId, arr);
        }
        return map;
    }, [completedTrades]);

    const exitInfoBySellTxId = useMemo(() => {
        const map = new Map<string, OptimalExitLite[]>();
        for (const r of dssLabCaches.exitResults) {
            if (!r.sellTxId) continue;
            const arr = map.get(r.sellTxId) ?? [];
            arr.push(r);
            map.set(r.sellTxId, arr);
        }
        return map;
    }, [dssLabCaches]);

    // 虛擬交易比對：把 DSS 實驗室「±N日最佳進場分析／出場分析」算出的最佳進出場日當模擬交易，重算訊號吻合度，
    // 藉此跟上面「實際交易」的吻合率並排比較，排除額度不足/定期定額/加碼誤判等雜訊干擾
    const virtualStats = useMemo(() => {
        const { optimalResults, exitResults } = dssLabCaches;
        if (!optimalResults.length && !exitResults.length) return null;

        const rawCache = loadDSSLabRawCache();
        const params = getTechParameters();

        let buyMatch = 0, buyDiverge = 0, buyNoData = 0;
        for (const r of optimalResults) {
            const alignment = computeVirtualAlignment(rawCache, r.symbol, r.bestDate, 'BUY', CATEGORY_TO_SIZE[r.category], params);
            if (alignment === 'MATCH') buyMatch++;
            else if (alignment === 'DIVERGE') buyDiverge++;
            else if (alignment === null) buyNoData++;
        }
        let sellMatch = 0, sellDiverge = 0, sellNoData = 0;
        for (const r of exitResults) {
            const alignment = computeVirtualAlignment(rawCache, r.symbol, r.bestDate, 'SELL', CATEGORY_TO_SIZE[r.category], params);
            if (alignment === 'MATCH') sellMatch++;
            else if (alignment === 'DIVERGE') sellDiverge++;
            else if (alignment === null) sellNoData++;
        }
        const buyTotal = optimalResults.length - buyNoData;
        const sellTotal = exitResults.length - sellNoData;
        return {
            buyTotalRaw: optimalResults.length, sellTotalRaw: exitResults.length,
            buyTotal, sellTotal, buyNoData, sellNoData, buyMatch, buyDiverge, sellMatch, sellDiverge,
            buyMatchRate:  buyTotal  ? (buyMatch  / buyTotal  * 100) : 0,
            sellMatchRate: sellTotal ? (sellMatch / sellTotal * 100) : 0,
        };
    }, [dssLabCaches]);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) setSortAsc(p => !p);
        else { setSortKey(key); setSortAsc(false); }
    };
    const SortIcon = ({ k }: { k: SortKey }) => sortKey === k
        ? (sortAsc ? <ChevronUp size={11}/> : <ChevronDown size={11}/>)
        : null;

    return (
        <div className="border-t border-slate-700/50 pt-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <TrendingUp size={16} className="text-sky-400"/>
                    <div>
                        <span className="text-sm font-bold text-white">DSS 回測分析</span>
                        <span className="text-xs text-slate-500 ml-2">大盤假設 NORMAL，跳過持倉相關訊號 · 「動作」是您實際的買賣紀錄，「訊號」是系統重算當天 DSS 會給出的判斷，兩者不同即為背離</span>
                    </div>
                    {cacheTimestamp && (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Clock size={11}/> {formatTimestamp(cacheTimestamp)}
                        </span>
                    )}
                    {recurringExcludedCount > 0 && (
                        <span className="flex items-center gap-1 text-xs text-sky-400/80" title="定期定額為排程扣款，非訊號驅動，已排除於吻合率統計之外">
                            已排除定期定額 {recurringExcludedCount} 筆
                        </span>
                    )}
                </div>
                <button
                    onClick={handleRun}
                    disabled={isRunning}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/15 text-sky-300 border border-sky-500/25 hover:bg-sky-500/25 transition-all disabled:opacity-50 text-xs font-bold"
                >
                    {isRunning ? <RefreshCw size={13} className="animate-spin"/> : <PlayCircle size={13}/>}
                    {isRunning ? '分析中...' : results ? '重新分析' : '開始回測'}
                </button>
            </div>

            {/* Progress */}
            {isRunning && progress && (
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-3">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-slate-300">分析 <span className="text-white font-mono">{progress.symbol}</span>...</span>
                        <span className="text-slate-400 font-mono">{progress.done} / {progress.total} 檔</span>
                    </div>
                    <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-sky-500 rounded-full transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                    </div>
                </div>
            )}

            {/* Stats bar：BUY/SELL 吻合率卡片內直接併入虛擬（最佳進出場）命中率，避免另開一個區塊重複顯示 */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="bg-slate-800/40 rounded-lg border border-slate-700/40 px-3 py-2">
                        <div className="text-xs text-slate-500">區間筆數</div>
                        <div className="text-lg font-bold text-white">{stats.total} <span className="text-xs text-slate-500">筆</span></div>
                        <div className="text-xs text-slate-500">買 {stats.buys} / 賣 {stats.sells}</div>
                    </div>
                    <div className="bg-slate-800/40 rounded-lg border border-slate-700/40 px-3 py-2">
                        <div className="text-xs text-slate-500">BUY 吻合率</div>
                        <div className={`text-lg font-bold ${stats.buyMatchRate >= 50 ? 'text-emerald-400' : 'text-orange-400'}`}>{stats.buyMatchRate.toFixed(0)}%</div>
                        <div className="text-xs text-slate-500">吻合 {stats.buyMatch} / 背離 {stats.buyDiverge}</div>
                        {virtualStats && (
                            <div className="text-[10px] text-slate-500 mt-1 pt-1 border-t border-slate-700/40"
                                title="虛擬命中率：把 DSS 實驗室「最佳進場日」當模擬交易重算訊號吻合度，樣本為完整交易（FIFO配對後），跟左邊實際吻合率的樣本（全部訊號驅動交易）母體不同，僅供參考趨勢">
                                虛擬 <span className={`font-bold ${virtualStats.buyMatchRate >= 50 ? 'text-emerald-400' : 'text-orange-400'}`}>{virtualStats.buyMatchRate.toFixed(0)}%</span>
                                <span className="text-slate-600">（{virtualStats.buyTotal}/{virtualStats.buyTotalRaw}筆{virtualStats.buyNoData ? `,${virtualStats.buyNoData}無快取` : ''}）</span>
                            </div>
                        )}
                    </div>
                    <div className="bg-slate-800/40 rounded-lg border border-slate-700/40 px-3 py-2">
                        <div className="text-xs text-slate-500">SELL 吻合率</div>
                        <div className={`text-lg font-bold ${stats.sellMatchRate >= 50 ? 'text-emerald-400' : 'text-orange-400'}`}>{stats.sellMatchRate.toFixed(0)}%</div>
                        <div className="text-xs text-slate-500">吻合 {stats.sellMatch} / 背離 {stats.sellDiverge}</div>
                        {virtualStats && (
                            <div className="text-[10px] text-slate-500 mt-1 pt-1 border-t border-slate-700/40"
                                title="虛擬命中率：把 DSS 實驗室「最佳出場日」當模擬交易重算訊號吻合度，樣本為完整交易（FIFO配對後），跟左邊實際吻合率的樣本（全部訊號驅動交易）母體不同，僅供參考趨勢">
                                虛擬 <span className={`font-bold ${virtualStats.sellMatchRate >= 50 ? 'text-emerald-400' : 'text-orange-400'}`}>{virtualStats.sellMatchRate.toFixed(0)}%</span>
                                <span className="text-slate-600">（{virtualStats.sellTotal}/{virtualStats.sellTotalRaw}筆{virtualStats.sellNoData ? `,${virtualStats.sellNoData}無快取` : ''}）</span>
                            </div>
                        )}
                    </div>
                    <div className="bg-slate-800/40 rounded-lg border border-slate-700/40 px-3 py-2">
                        <div className="text-xs text-slate-500">賣出損益（吻合 vs 背離）</div>
                        <div className="space-y-0.5 mt-0.5">
                            {stats.avgPnLMatch !== null && (
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-400">吻合賣出</span>
                                    <span className={`font-mono font-bold ${stats.avgPnLMatch >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {stats.avgPnLMatch >= 0 ? '+' : ''}{(stats.avgPnLMatch / 1000).toFixed(1)}K
                                    </span>
                                </div>
                            )}
                            {stats.avgPnLDiverge !== null && (
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-400">背離賣出</span>
                                    <span className={`font-mono font-bold ${stats.avgPnLDiverge >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {stats.avgPnLDiverge >= 0 ? '+' : ''}{(stats.avgPnLDiverge / 1000).toFixed(1)}K
                                    </span>
                                </div>
                            )}
                            {stats.avgPnLMatch === null && stats.avgPnLDiverge === null && (
                                <span className="text-slate-600 text-xs">無賣出損益資料</span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            {results && (
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex rounded-lg border border-slate-700 overflow-hidden text-xs">
                        {(['ALL', 'BUY', 'SELL'] as FilterSide[]).map(v => (
                            <button key={v} onClick={() => setFilterSide(v)}
                                className={`px-3 py-1.5 font-bold transition-all ${filterSide === v ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                                {v === 'ALL' ? '全部' : v === 'BUY' ? '買進' : '賣出'}
                            </button>
                        ))}
                    </div>
                    <div className="flex rounded-lg border border-slate-700 overflow-hidden text-xs">
                        {(['ALL', 'MATCH', 'DIVERGE', 'PARTIAL'] as FilterAlign[]).map(v => (
                            <button key={v} onClick={() => setFilterAlign(v)}
                                className={`px-3 py-1.5 font-bold transition-all ${filterAlign === v ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                                {v === 'ALL' ? '全部' : v === 'MATCH' ? '✓ 吻合' : v === 'DIVERGE' ? '✗ 背離' : '— 中性'}
                            </button>
                        ))}
                    </div>
                    <span className="text-xs text-slate-500 ml-auto">顯示 {displayResults.length} 筆</span>
                </div>
            )}

            {/* Table */}
            {results && (
                <div className="overflow-x-auto rounded-xl border border-slate-700/50">
                    <table className="w-full text-sm min-w-[860px]">
                        <thead>
                            <tr className="border-b border-slate-700/50 bg-slate-800/60">
                                {([
                                    { label: '日期',      key: 'date'      as SortKey },
                                    { label: '股票',      key: 'symbol'    as SortKey },
                                    { label: '動作',      key: null, title: '您實際下的買賣紀錄' },
                                    { label: '訊號(技術)', key: null, title: '系統重算當天的技術面 DSS 訊號（與您的動作無關，用來比對是否吻合）' },
                                    { label: '訊號(籌碼)', key: null, title: '系統重算當天的籌碼面燈號' },
                                    { label: '月乖離%',   key: 'bias20'    as SortKey },
                                    { label: 'RSI',       key: 'rsi'       as SortKey },
                                    { label: '距買進',    key: null, title: '當天乖離率與「買進」門檻的差距：已入=已達標可買進，差+X%=還差多少才會觸發買進' },
                                    { label: '距停利',    key: null, title: '當天乖離率與「停利」門檻的差距：超出+X%=已超過停利門檻，差X%=還差多少才會觸發停利' },
                                    { label: '吻合',      key: 'alignment' as SortKey },
                                    { label: '損益',      key: null },
                                ] as { label: string; key: SortKey | null; title?: string }[]).map(({ label, key, title }) => (
                                    <th key={label}
                                        onClick={() => key && toggleSort(key)}
                                        title={title}
                                        className={`px-3 py-2.5 text-left text-xs text-slate-400 font-bold whitespace-nowrap ${key ? 'cursor-pointer hover:text-white select-none' : ''}`}>
                                        <span className="flex items-center gap-1">{label}{key && <SortIcon k={key}/>}</span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {displayResults.map(row => (
                                <React.Fragment key={row.tradeId}>
                                    <tr
                                        className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors"
                                        onClick={() => setExpandedRow(expandedRow === row.tradeId ? null : row.tradeId)}
                                    >
                                        <td className="px-3 py-2.5 text-slate-400 font-mono text-xs whitespace-nowrap">{row.date}</td>
                                        <td className="px-3 py-2.5">
                                            <div className="font-bold text-white text-xs">{row.symbol}</div>
                                            <div className="text-slate-500 text-[11px]">{row.name}</div>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${row.side === 'BUY' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}>
                                                {row.side === 'BUY' ? '買進' : '賣出'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            {row.error
                                                ? <span className="flex items-center gap-1 text-slate-600 text-xs"><AlertCircle size={11}/>{row.error}</span>
                                                : <span className={`px-1.5 py-0.5 rounded text-xs font-bold border ${getSignalStyle(row.techSignal)}`}>{SIGNAL_LABELS[row.techSignal] ?? row.techSignal}</span>
                                            }
                                        </td>
                                        <td className="px-3 py-2.5">
                                            {row.chipHint
                                                ? <span className={`text-xs font-bold ${getChipStyle(row.chipHint.target)}`}>{row.chipHint.target}</span>
                                                : <span className="text-slate-600 text-xs">-</span>
                                            }
                                        </td>
                                        <td className="px-3 py-2.5">
                                            {row.error ? <span className="text-slate-600 text-xs">-</span> :
                                                <span className={`font-mono text-xs font-bold ${row.bias20 >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                    {row.bias20 >= 0 ? '+' : ''}{row.bias20.toFixed(1)}%
                                                </span>
                                            }
                                        </td>
                                        <td className="px-3 py-2.5">
                                            {row.error ? <span className="text-slate-600 text-xs">-</span> :
                                                <span className={`font-mono text-xs ${row.rsi > 70 ? 'text-emerald-400' : row.rsi < 30 ? 'text-red-400' : 'text-slate-300'}`}>
                                                    {row.rsi.toFixed(0)}
                                                </span>
                                            }
                                        </td>
                                        <td className="px-3 py-2.5"><GapDisplay gap={row.gapToBuyBias} type="buy"/></td>
                                        <td className="px-3 py-2.5"><GapDisplay gap={row.gapToSellBias} type="sell"/></td>
                                        <td className="px-3 py-2.5"><AlignmentBadge alignment={row.alignment}/></td>
                                        <td className="px-3 py-2.5">
                                            {row.side === 'SELL' && row.realizedProfit !== undefined && row.realizedProfit !== 0
                                                ? <span className={`font-mono text-xs font-bold ${row.realizedProfit >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                    {row.realizedProfit >= 0 ? '+' : ''}{(row.realizedProfit / 1000).toFixed(1)}K
                                                  </span>
                                                : <span className="text-slate-600 text-xs">-</span>
                                            }
                                        </td>
                                    </tr>
                                    {expandedRow === row.tradeId && !row.error && (
                                        <tr className="border-b border-slate-800/50 bg-slate-800/20">
                                            <td colSpan={11} className="px-4 py-3">
                                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                                                    <div>
                                                        <div className="text-slate-500 mb-1">成交明細</div>
                                                        <div className="text-slate-300">價格 <span className="font-mono text-white">{row.price}</span></div>
                                                        <div className="text-slate-300">張數 <span className="font-mono text-white">{(row.shares / 1000).toFixed(0)} 張</span></div>
                                                        <div className="text-slate-300">分類 <span className="text-slate-400">{row.sizeCategory}</span></div>
                                                    </div>
                                                    <div>
                                                        <div className="text-slate-500 mb-1">
                                                            「{SIGNAL_LABELS[row.techSignal] ?? row.techSignal}」判定條件
                                                        </div>
                                                        {(() => {
                                                            const tc = buildTechConditions(row);
                                                            if (typeof tc === 'string') return <div className="text-slate-300">{tc}</div>;
                                                            return tc.map((c, i) => (
                                                                <div key={i} className={c.satisfied ? 'text-emerald-400' : 'text-slate-600'}>
                                                                    {c.satisfied ? '✓' : '✗'} {c.label}
                                                                </div>
                                                            ));
                                                        })()}
                                                    </div>
                                                    <div>
                                                        <div className="text-slate-500 mb-1">
                                                            {row.chipHint ? `「${row.chipHint.target}」判定條件` : '籌碼條件'}
                                                        </div>
                                                        {row.chipHint?.conditions.map((c, i) => (
                                                            <div key={i} className={c.satisfied ? 'text-emerald-400' : 'text-slate-600'}>
                                                                {c.satisfied ? '✓' : '✗'} {c.label}
                                                            </div>
                                                        )) ?? <div className="text-slate-600">無籌碼資料</div>}
                                                    </div>
                                                    {row.side === 'BUY' ? (
                                                        <div>
                                                            <div className="text-slate-500 mb-1">配對已實現損益{row.alignment === 'DIVERGE' && <span className="text-slate-600">（背離）</span>}</div>
                                                            {(() => {
                                                                const matched = completedByBuyTxId.get(row.tradeId);
                                                                if (!matched?.length) return <div className="text-slate-600">尚未配對到賣出（可能還沒出場，或賣出紀錄不在篩選範圍內）</div>;
                                                                const total = matched.reduce((s, t) => s + t.realizedProfit, 0);
                                                                return (
                                                                    <>
                                                                        {matched.map((t, i) => (
                                                                            <div key={i} className="flex justify-between text-slate-300">
                                                                                <span className="text-slate-500">{t.sellDate}</span>
                                                                                <span className={`font-mono ${t.realizedProfit >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                                                    {t.realizedProfit >= 0 ? '+' : ''}{(t.realizedProfit / 1000).toFixed(1)}K（{t.returnPct >= 0 ? '+' : ''}{t.returnPct.toFixed(1)}%）
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                        {row.alignment === 'DIVERGE' && (
                                                                            <div className={`mt-1 pt-1 border-t border-slate-700/40 font-bold ${total >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                                                {total >= 0 ? '雖背離但實際獲利 +' : '背離且虧損 '}{(total / 1000).toFixed(1)}K
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                );
                                                            })()}
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <div className="text-slate-500 mb-1">±10日最佳賣點（出場分析）</div>
                                                            {(() => {
                                                                const matched = exitInfoBySellTxId.get(row.tradeId);
                                                                if (!matched?.length) return <div className="text-slate-600">尚無出場分析資料（需先跑 DSS 實驗室的出場分析）</div>;
                                                                return matched.map((r, i) => (
                                                                    <div key={i} className="text-slate-300">
                                                                        <div className="flex justify-between"><span className="text-slate-500">實際報酬</span><span className={`font-mono ${r.actualReturn >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>{r.actualReturn >= 0 ? '+' : ''}{r.actualReturn.toFixed(1)}%</span></div>
                                                                        <div className="flex justify-between"><span className="text-slate-500">最佳（{r.bestDate}）</span><span className={`font-mono ${r.bestReturn >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>{r.bestReturn >= 0 ? '+' : ''}{r.bestReturn.toFixed(1)}%</span></div>
                                                                    </div>
                                                                ));
                                                            })()}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                            {displayResults.length === 0 && (
                                <tr><td colSpan={11} className="px-4 py-6 text-center text-slate-500 text-sm">
                                    {results ? '沒有符合條件的交易記錄' : '尚未執行回測，點擊「開始回測」'}
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {!results && !isRunning && (
                <div className="py-8 text-center text-slate-500 text-sm">
                    點擊「開始回測」，系統將呼叫 FinMind 歷史資料，分析 {allTransactions.length} 筆交易的 DSS 訊號吻合情況。
                </div>
            )}
        </div>
    );
};
