import React, { useMemo, useState, useEffect } from 'react';
import { FlaskConical, Trophy, Target, ChevronDown, ChevronUp, BarChart2, Zap, Loader2, Save, Download, Upload, History } from 'lucide-react';
import { StockTransaction, BacktestResult } from '../types';
import { lookupStockName, fetchKlineWindow, computeMultiBias, computeDSSForDate, fetchHistoricalInstForBacktest, fetchHistoricalMarginForBacktest, CompletedTrade, buildCompletedTrades } from '../services/stock';
import { getBacktestCache, getDSSProfiles, saveDSSProfiles, DSSProfile, getTechParameters } from '../services/storage';
import { BacktestView } from './BacktestView';

interface Props {
    stockTransactions: StockTransaction[];
}

/** ±N日進出場分析統一視窗天數（買入分析/出場分析共用，也讓原始資料快取可互相重用）*/
const WINDOW_DAYS = 10;

/** 最早交易日前至少緩衝這麼多天的歷史資料，讓 MA20/RSI14 等指標算得出來，
 *  同時對齊 DSS 回測分析(runBacktest)的 95 天緩衝需求，讓兩邊可共用同一份原始資料快取 */
const MIN_HISTORY_BUFFER_DAYS = 95;

interface SymbolStats {
    symbol: string;
    name?: string;
    category: 'ETF' | '上市' | '上櫃';
    trades: CompletedTrade[];
    wins: number;
    losses: number;
    winRate: number;
    avgProfit: number;
    avgReturn: number;
    avgHoldingDays: number;
    totalPnL: number;
    maxProfit: number;
    maxLoss: number;
}

const buildSymbolStats = (trades: CompletedTrade[]): SymbolStats[] => {
    const bySymbol: Record<string, CompletedTrade[]> = {};
    for (const t of trades) {
        (bySymbol[t.symbol] = bySymbol[t.symbol] ?? []).push(t);
    }
    return Object.entries(bySymbol).map(([symbol, list]) => {
        const wins = list.filter(t => t.realizedProfit > 0);
        const losses = list.filter(t => t.realizedProfit <= 0);
        return {
            symbol,
            name: list[0]?.name,
            category: list[0]?.category ?? '上市',
            trades: list,
            wins: wins.length,
            losses: losses.length,
            winRate: list.length ? (wins.length / list.length) * 100 : 0,
            avgProfit: list.length ? list.reduce((s, t) => s + t.realizedProfit, 0) / list.length : 0,
            avgReturn: list.length ? list.reduce((s, t) => s + t.returnPct, 0) / list.length : 0,
            avgHoldingDays: list.length ? list.reduce((s, t) => s + t.holdingDays, 0) / list.length : 0,
            totalPnL: list.reduce((s, t) => s + t.realizedProfit, 0),
            maxProfit: wins.length ? Math.max(...wins.map(t => t.realizedProfit)) : 0,
            maxLoss: losses.length ? Math.min(...losses.map(t => t.realizedProfit)) : 0,
        };
    }).sort((a, b) => b.trades.length - a.trades.length);
};

type SortKey = 'trades' | 'winRate' | 'avgProfit' | 'totalPnL' | 'avgHolding';
type CategoryFilter = 'ALL' | 'ETF' | '上市' | '上櫃';

const median = (arr: number[]): number | null => {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const avg = (arr: number[]) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;

// ── Section 3：±N日最佳進場分析 ───────────────────────────────────────────
/** 最佳進出場日 ±NEAR_BEST_DAYS 日內，每個交易日各自的技術面/籌碼面指標，讓中位數不只依賴單一天 */
interface IndicatorSample {
    rsi: number | null;
    bias5: number | null;
    bias10: number | null;
    bias20: number | null;
    slopeUpDays: number | null;
    foreignConsecBuy: number | null;
    trustConsecBuy: number | null;
    marginConsecIncrease: number | null;
}

interface WindowResult {
    symbol: string;
    name?: string;
    category: 'ETF' | '上市' | '上櫃';
    buyDate: string;
    sellDate: string;
    sellPrice: number;
    actualBuyPrice: number;
    actualReturn: number;
    actualBias5: number | null;
    actualBias10: number | null;
    actualBias20: number | null;
    bestDate: string;
    bestPrice: number;
    bestReturn: number;
    bestBias5: number | null;
    bestBias10: number | null;
    bestBias20: number | null;
    improvement: number;
    dayOffset: number;
    // Step2 補齊：斜率(連升天數)/RSI/籌碼 — 實際進場日 vs 最佳進場日
    actualRsi: number | null;
    actualSlopeUpDays: number | null;
    actualForeignConsecBuy: number | null;
    actualTrustConsecBuy: number | null;
    actualMarginConsecIncrease: number | null;
    bestRsi: number | null;
    bestSlopeUpDays: number | null;
    bestForeignConsecBuy: number | null;
    bestTrustConsecBuy: number | null;
    bestMarginConsecIncrease: number | null;
    /** 最佳進場日 ±NEAR_BEST_DAYS 日內各交易日的指標，供中位數計算使用（樣本比單一最佳日更穩健） */
    nearBestSamples?: IndicatorSample[];
    /** 對應原始交易 id，供 DSS 回測分析跨資料交叉比對（買進背離×已實現損益、最佳賣點）使用 */
    buyTxId?: string;
    sellTxId?: string;
}

/** biasSlopes[0] 起算連續正斜率天數（配合 TechParameters 的 xxxBuySlopeDays 門檻概念）*/
const slopeConsecUp = (slopes: number[]): number => {
    let n = 0;
    for (const s of slopes) { if (s > 0) n++; else break; }
    return n;
};

// ── Step3：±N日最佳進場分析數據 → 依分類(ETF/上市/上櫃)取中位數 ──────────────
interface OptimalCatStats {
    cat: 'ETF' | '上市' | '上櫃';
    n: number;
    rawN: number;
    qualityCutoff: number;
    medRsi: number | null;
    medBias5: number | null;
    medBias10: number | null;
    medBias20: number | null;
    medSlopeUpDays: number | null;
    medForeignConsecBuy: number | null;
    medTrustConsecBuy: number | null;
    medMarginConsecIncrease: number | null;
    /** 強買門檻：取單一最佳進場日（不含 ±2 日鄰近樣本）的中位數，比普通買進門檻更嚴格 */
    medStrongRsi: number | null;
    medStrongBias20: number | null;
    medStrongSlopeUpDays: number | null;
}

const notNull = (v: number | null): v is number => v !== null;

/** 優質數據篩選：依改善幅度(improvement)排序，僅保留該分類前70%（排除改善幅度最低的30%）*/
const KEEP_RATIO = 0.7;
const filterQualityTrades = <T extends { improvement: number }>(list: T[]): { kept: T[]; cutoff: number } => {
    if (list.length === 0) return { kept: [], cutoff: 0 };
    const sorted = [...list].sort((a, b) => a.improvement - b.improvement);
    const cutoffIdx = Math.floor(sorted.length * (1 - KEEP_RATIO));
    const cutoff = sorted[cutoffIdx].improvement;
    return { kept: list.filter(r => r.improvement >= cutoff), cutoff };
};

/** 把每筆交易的 nearBestSamples 攤平成單一指標樣本池；舊快取沒有 nearBestSamples 時，退回單一最佳日的數值 */
const flattenNearBestSamples = <T extends {
    bestRsi: number | null; bestBias5: number | null; bestBias10: number | null; bestBias20: number | null;
    bestSlopeUpDays: number | null; bestForeignConsecBuy: number | null; bestTrustConsecBuy: number | null; bestMarginConsecIncrease: number | null;
    nearBestSamples?: IndicatorSample[];
}>(list: T[]): IndicatorSample[] => list.flatMap(r => r.nearBestSamples?.length ? r.nearBestSamples : [{
    rsi: r.bestRsi, bias5: r.bestBias5, bias10: r.bestBias10, bias20: r.bestBias20,
    slopeUpDays: r.bestSlopeUpDays, foreignConsecBuy: r.bestForeignConsecBuy,
    trustConsecBuy: r.bestTrustConsecBuy, marginConsecIncrease: r.bestMarginConsecIncrease,
}]);

const buildOptimalCatStats = (results: WindowResult[], cat: 'ETF' | '上市' | '上櫃'): OptimalCatStats | null => {
    const minN = cat === 'ETF' ? 1 : 3;
    const catList = results.filter(r => r.category === cat);
    if (catList.length < minN) return null;

    const { kept: list, cutoff } = filterQualityTrades(catList);
    if (list.length < minN) return null;

    const samples = flattenNearBestSamples(list);
    return {
        cat,
        n: list.length,
        rawN: catList.length,
        qualityCutoff: cutoff,
        medRsi: median(samples.map(s => s.rsi).filter(notNull)),
        medBias5: median(samples.map(s => s.bias5).filter(notNull)),
        medBias10: median(samples.map(s => s.bias10).filter(notNull)),
        medBias20: median(samples.map(s => s.bias20).filter(notNull)),
        medSlopeUpDays: median(samples.map(s => s.slopeUpDays).filter(notNull)),
        medForeignConsecBuy: median(samples.map(s => s.foreignConsecBuy).filter(notNull)),
        medTrustConsecBuy: median(samples.map(s => s.trustConsecBuy).filter(notNull)),
        medMarginConsecIncrease: median(samples.map(s => s.marginConsecIncrease).filter(notNull)),
        // 強買門檻刻意只取單一最佳日（不併入 ±2 日鄰近樣本），比普通買進門檻更嚴格、更貼近真正的最佳時機
        medStrongRsi: median(list.map(r => r.bestRsi).filter(notNull)),
        medStrongBias20: median(list.map(r => r.bestBias20).filter(notNull)),
        medStrongSlopeUpDays: median(list.map(r => r.bestSlopeUpDays).filter(notNull)),
    };
};

interface RawCacheEntry {
    kline: { date: string; close: number }[];
    inst: { date: string; foreign: number; trust: number }[];
    margin: { date: string; balance: number }[];
}

const OptimalEntrySection: React.FC<{ results: WindowResult[] | null }> = ({ results }) => {
    const [optimalCatTab, setOptimalCatTab] = useState<'ETF' | '上市' | '上櫃'>('上市');

    const optimalCatStats = useMemo(() => {
        if (!results?.length) return null;
        const etf = buildOptimalCatStats(results, 'ETF');
        const listed = buildOptimalCatStats(results, '上市');
        const otc = buildOptimalCatStats(results, '上櫃');
        if (!etf && !listed && !otc) return null;
        return { ETF: etf, 上市: listed, 上櫃: otc };
    }, [results]);

    const avgImprovement = results?.length ? avg(results.map(r => r.improvement)) : null;
    const couldImprove = results?.filter(r => r.improvement > 0.5).length ?? 0;
    const losers = results?.filter(r => r.actualReturn < 0) ?? [];
    const avgLossReduction = losers.length ? avg(losers.map(r => r.improvement)) : null;
    const lossAvoided = losers.filter(r => r.bestReturn >= 0).length;

    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex items-center gap-2">
                <Zap size={16} className="text-amber-400" />
                <h3 className="text-sm font-bold text-slate-200">±N日最佳進場分析</h3>
                <span className="text-xs text-slate-500 ml-1">若改在附近最低價入場，報酬率可提升多少？</span>
            </div>
            <div className="p-4 space-y-4">
                {!results && (
                    <div className="text-center py-12 text-slate-500 text-sm">尚未執行分析，請至上方點擊「開始分析」</div>
                )}
                {results && (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            <div className="bg-slate-900/60 rounded-xl p-3 text-center">
                                <div className="text-xs text-slate-400 mb-1">平均可改善報酬</div>
                                <div className={`text-lg font-bold ${(avgImprovement ?? 0) > 0 ? 'text-red-400' : 'text-slate-300'}`}>
                                    {avgImprovement !== null ? `+${avgImprovement.toFixed(2)}%` : '-'}
                                </div>
                                <div className="text-[10px] text-slate-500">全部交易</div>
                            </div>
                            <div className="bg-slate-900/60 rounded-xl p-3 text-center">
                                <div className="text-xs text-slate-400 mb-1">可顯著改善筆數</div>
                                <div className="text-lg font-bold text-amber-400">{couldImprove} / {results.length}</div>
                                <div className="text-[10px] text-slate-500">改善 &gt; 0.5%</div>
                            </div>
                            <div className="bg-emerald-900/30 border border-emerald-800/40 rounded-xl p-3 text-center">
                                <div className="text-xs text-emerald-400 mb-1">虧損交易筆數</div>
                                <div className="text-lg font-bold text-emerald-400">{losers.length}</div>
                                <div className="text-[10px] text-slate-500">實際負報酬</div>
                            </div>
                            <div className="bg-emerald-900/30 border border-emerald-800/40 rounded-xl p-3 text-center">
                                <div className="text-xs text-emerald-400 mb-1">虧損平均可減少</div>
                                <div className={`text-lg font-bold ${(avgLossReduction ?? 0) > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                                    {avgLossReduction !== null ? `+${avgLossReduction.toFixed(2)}%` : '-'}
                                </div>
                                <div className="text-[10px] text-slate-500">提早/延後進場</div>
                            </div>
                            <div className="bg-emerald-900/30 border border-emerald-800/40 rounded-xl p-3 text-center">
                                <div className="text-xs text-emerald-400 mb-1">可轉為獲利</div>
                                <div className="text-lg font-bold text-red-400">{lossAvoided} 筆</div>
                                <div className="text-[10px] text-slate-500">最佳日報酬 ≥ 0</div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead><tr className="text-xs text-slate-400 border-b border-slate-700">
                                    <th className="py-2 px-3">標的</th>
                                    <th className="py-2 px-3 text-center">進場日</th>
                                    <th className="py-2 px-3 text-center">出場日</th>
                                    <th className="py-2 px-3 text-right">實際買入</th>
                                    <th className="py-2 px-3 text-right">實際報酬</th>
                                    <th className="py-2 px-3 text-center text-sky-400">B5</th>
                                    <th className="py-2 px-3 text-center text-violet-400">B10</th>
                                    <th className="py-2 px-3 text-center text-slate-400">B20</th>
                                    <th className="py-2 px-3 text-center">最佳日（偏移）</th>
                                    <th className="py-2 px-3 text-right">最佳價格</th>
                                    <th className="py-2 px-3 text-right">最佳報酬</th>
                                    <th className="py-2 px-3 text-center text-sky-400">最佳B5</th>
                                    <th className="py-2 px-3 text-center text-violet-400">最佳B10</th>
                                    <th className="py-2 px-3 text-center text-slate-400">最佳B20</th>
                                    <th className="py-2 px-3 text-center text-amber-400">最佳RSI</th>
                                    <th className="py-2 px-3 text-center text-amber-400">最佳斜率</th>
                                    <th className="py-2 px-3 text-center text-amber-400">最佳外資</th>
                                    <th className="py-2 px-3 text-center text-amber-400">最佳投信</th>
                                    <th className="py-2 px-3 text-center text-amber-400">最佳融資</th>
                                    <th className="py-2 px-3 text-right">可改善</th>
                                </tr></thead>
                                <tbody>
                                    {results.slice(0, 50).map((r, i) => (
                                        <tr key={i} className={`border-t border-slate-700/30 transition-colors ${r.actualReturn < 0 ? 'bg-emerald-950/20 hover:bg-emerald-950/30' : 'hover:bg-slate-700/10'}`}>
                                            <td className="py-2 px-3 text-sm">
                                                <div className="font-medium text-white">{r.name ?? r.symbol}</div>
                                                <div className="text-xs text-slate-500">{r.symbol}</div>
                                            </td>
                                            <td className="py-2 px-3 text-center text-xs text-slate-400">{r.buyDate}</td>
                                            <td className="py-2 px-3 text-center text-xs text-slate-400">{r.sellDate}</td>
                                            <td className="py-2 px-3 text-right font-mono text-sm text-slate-300">{r.actualBuyPrice}</td>
                                            <td className="py-2 px-3 text-right font-mono text-sm">
                                                <span className={r.actualReturn >= 0 ? 'text-red-400' : 'text-emerald-400'}>
                                                    {r.actualReturn >= 0 ? '+' : ''}{r.actualReturn.toFixed(2)}%
                                                </span>
                                            </td>
                                            <td className="py-2 px-3 text-center font-mono text-xs text-sky-400">{r.actualBias5 !== null ? `${r.actualBias5.toFixed(1)}%` : '-'}</td>
                                            <td className="py-2 px-3 text-center font-mono text-xs text-violet-400">{r.actualBias10 !== null ? `${r.actualBias10.toFixed(1)}%` : '-'}</td>
                                            <td className="py-2 px-3 text-center font-mono text-xs text-slate-400">{r.actualBias20 !== null ? `${r.actualBias20.toFixed(1)}%` : '-'}</td>
                                            <td className="py-2 px-3 text-center text-xs">
                                                <span className="text-slate-300">{r.bestDate}</span>
                                                <span className={`ml-1 ${r.dayOffset > 0 ? 'text-sky-400' : r.dayOffset < 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                                                    {r.dayOffset > 0 ? `(早 ${r.dayOffset}天)` : r.dayOffset < 0 ? `(晚 ${Math.abs(r.dayOffset)}天)` : '(同日)'}
                                                </span>
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono text-sm text-slate-300">{r.bestPrice}</td>
                                            <td className="py-2 px-3 text-right font-mono text-sm">
                                                <span className={r.bestReturn >= 0 ? 'text-red-400' : 'text-emerald-400'}>
                                                    {r.bestReturn >= 0 ? '+' : ''}{r.bestReturn.toFixed(2)}%
                                                </span>
                                            </td>
                                            <td className="py-2 px-3 text-center font-mono text-xs text-sky-400">{r.bestBias5 !== null ? `${r.bestBias5.toFixed(1)}%` : '-'}</td>
                                            <td className="py-2 px-3 text-center font-mono text-xs text-violet-400">{r.bestBias10 !== null ? `${r.bestBias10.toFixed(1)}%` : '-'}</td>
                                            <td className="py-2 px-3 text-center font-mono text-xs text-slate-400">{r.bestBias20 !== null ? `${r.bestBias20.toFixed(1)}%` : '-'}</td>
                                            <td className="py-2 px-3 text-center font-mono text-xs text-amber-300">{r.bestRsi != null ? r.bestRsi.toFixed(1) : '-'}</td>
                                            <td className="py-2 px-3 text-center font-mono text-xs text-amber-300">{r.bestSlopeUpDays != null ? `${r.bestSlopeUpDays}天` : '-'}</td>
                                            <td className="py-2 px-3 text-center font-mono text-xs text-amber-300">{r.bestForeignConsecBuy != null ? `${r.bestForeignConsecBuy}天` : '-'}</td>
                                            <td className="py-2 px-3 text-center font-mono text-xs text-amber-300">{r.bestTrustConsecBuy != null ? `${r.bestTrustConsecBuy}天` : '-'}</td>
                                            <td className="py-2 px-3 text-center font-mono text-xs text-amber-300">{r.bestMarginConsecIncrease != null ? `${r.bestMarginConsecIncrease}天` : '-'}</td>
                                            <td className="py-2 px-3 text-right font-mono text-sm font-bold">
                                                <span className={r.improvement > 0.5 ? 'text-amber-400' : r.improvement > 0 ? 'text-slate-300' : 'text-slate-500'}>
                                                    {r.improvement > 0 ? '+' : ''}{r.improvement.toFixed(2)}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {optimalCatStats && (
                            <div className="pt-4 border-t border-slate-700 space-y-3">
                                <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-bold text-slate-200">最佳進場點參數中位數</h4>
                                    <span className="text-xs text-slate-500">依分類彙總 — 可套用為進場門檻參考值</span>
                                </div>
                                <div className="flex gap-1">
                                    {(['ETF', '上市', '上櫃'] as const).map(tab => {
                                        const s = optimalCatStats[tab];
                                        const disabled = !s;
                                        return (
                                            <button key={tab} onClick={() => !disabled && setOptimalCatTab(tab)}
                                                disabled={disabled}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                                    optimalCatTab === tab && !disabled
                                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                                        : disabled
                                                            ? 'text-slate-600 cursor-not-allowed'
                                                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                                                }`}>
                                                {tab}
                                                {s ? <span className="ml-1 text-slate-500">({s.n}/{s.rawN})</span>
                                                   : <span className="ml-1 text-slate-600">(不足)</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                                {optimalCatStats[optimalCatTab] ? (
                                    <>
                                    <div className="text-xs text-slate-500">
                                        優質數據篩選：改善幅度前 70%（{optimalCatStats[optimalCatTab]!.rawN} 筆中保留 {optimalCatStats[optimalCatTab]!.n} 筆，門檻 ≥ {optimalCatStats[optimalCatTab]!.qualityCutoff.toFixed(1)}%）
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <StatCard label="RSI 中位數" value={optimalCatStats[optimalCatTab]!.medRsi?.toFixed(1) ?? '-'} color="text-amber-300" />
                                        <StatCard label="Bias5 中位數" value={optimalCatStats[optimalCatTab]!.medBias5 !== null ? `${optimalCatStats[optimalCatTab]!.medBias5!.toFixed(1)}%` : '-'} color="text-sky-400" />
                                        <StatCard label="Bias10 中位數" value={optimalCatStats[optimalCatTab]!.medBias10 !== null ? `${optimalCatStats[optimalCatTab]!.medBias10!.toFixed(1)}%` : '-'} color="text-violet-400" />
                                        <StatCard label="Bias20 中位數" value={optimalCatStats[optimalCatTab]!.medBias20 !== null ? `${optimalCatStats[optimalCatTab]!.medBias20!.toFixed(1)}%` : '-'} color="text-slate-300" />
                                        <StatCard label="斜率連升天數中位數" value={optimalCatStats[optimalCatTab]!.medSlopeUpDays !== null ? `${optimalCatStats[optimalCatTab]!.medSlopeUpDays}天` : '-'} color="text-amber-300" />
                                        <StatCard label="外資連買天數中位數" value={optimalCatStats[optimalCatTab]!.medForeignConsecBuy !== null ? `${optimalCatStats[optimalCatTab]!.medForeignConsecBuy}天` : '-'} color="text-amber-300" />
                                        <StatCard label="投信連買天數中位數" value={optimalCatStats[optimalCatTab]!.medTrustConsecBuy !== null ? `${optimalCatStats[optimalCatTab]!.medTrustConsecBuy}天` : '-'} color="text-amber-300" />
                                        <StatCard label="融資連增天數中位數" value={optimalCatStats[optimalCatTab]!.medMarginConsecIncrease !== null ? `${optimalCatStats[optimalCatTab]!.medMarginConsecIncrease}天` : '-'} color="text-amber-300" />
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">強買門檻（取單一最佳日，不含 ±2 日鄰近樣本，比普通買進更嚴格）</div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <StatCard label="強買 RSI 中位數" value={optimalCatStats[optimalCatTab]!.medStrongRsi?.toFixed(1) ?? '-'} color="text-rose-300" />
                                        <StatCard label="強買 Bias20 中位數" value={optimalCatStats[optimalCatTab]!.medStrongBias20 !== null ? `${optimalCatStats[optimalCatTab]!.medStrongBias20!.toFixed(1)}%` : '-'} color="text-rose-300" />
                                        <StatCard label="強買斜率連升天數中位數" value={optimalCatStats[optimalCatTab]!.medStrongSlopeUpDays !== null ? `${optimalCatStats[optimalCatTab]!.medStrongSlopeUpDays}天` : '-'} color="text-rose-300" />
                                    </div>
                                    </>
                                ) : (
                                    <div className="text-xs text-slate-500 py-4 text-center">此類別資料不足（上市/上櫃需 ≥3 筆，ETF 需 ≥1 筆）</div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

const daysBetween2 = (d1: string, d2: string) => {
    const diff = new Date(d2).getTime() - new Date(d1).getTime();
    return Math.round(diff / 86400000);
};

/** 依 kline 陣列裡的實際交易日位置（索引）取前後 N 個交易日的窗口，而非日曆天差——
 *  避免最佳日剛好卡在週五時，「後2天」落到不開盤的週六週日，導致樣本數不足 */
const sliceAroundDate = <T extends { date: string }>(rows: T[], centerDate: string, windowDays: number): T[] => {
    let idx = rows.findIndex(r => r.date === centerDate);
    if (idx === -1) {
        idx = rows.findIndex(r => r.date >= centerDate);
        if (idx === -1) idx = rows.length - 1;
    }
    return rows.slice(Math.max(0, idx - windowDays), idx + windowDays + 1);
};

/** 最佳進出場日往前後各抓幾個交易日，一起納入中位數樣本，避免單一天的極端值主導參數 */
const NEAR_BEST_DAYS = 2;

const computeNearBestSamples = (
    kline: { date: string; close: number }[],
    instRows: { date: string; foreign: number; trust: number }[],
    marginRows: { date: string; balance: number }[],
    bestDate: string,
    params: ReturnType<typeof getTechParameters>,
    sizeCategory: 'ETF' | 'LARGE_CAP' | 'SMALL_CAP'
): IndicatorSample[] => {
    const nearby = sliceAroundDate(kline, bestDate, NEAR_BEST_DAYS);
    return nearby.map(r => {
        const bias = computeMultiBias(kline, r.date);
        const dss = computeDSSForDate(kline, instRows, marginRows, r.date, params, sizeCategory);
        return {
            rsi: dss?.rsi ?? null,
            bias5: bias.bias5, bias10: bias.bias10, bias20: bias.bias20,
            slopeUpDays: dss ? slopeConsecUp(dss.biasSlopes) : null,
            foreignConsecBuy: dss?.foreignConsecBuy ?? null,
            trustConsecBuy: dss?.trustConsecBuy ?? null,
            marginConsecIncrease: dss?.marginConsecIncrease ?? null,
        };
    });
};

// ── Section 4：出場分析（對稱於 ±N日最佳進場分析，改找最佳「出場」日）────────
interface ExitWindowResult {
    symbol: string;
    name?: string;
    category: 'ETF' | '上市' | '上櫃';
    buyDate: string;
    sellDate: string;
    buyPrice: number;
    actualSellPrice: number;
    actualReturn: number;
    /** 這筆完整交易最終是否獲利（returnPct > 0）。獲利樣本 → SELL/FORCE SELL 資料庫；虧損樣本 → STOP LOSS/FORCE STOP LOSS 資料庫 */
    isWinner: boolean;
    actualBias5: number | null;
    actualBias10: number | null;
    actualBias20: number | null;
    /** 最佳出場日＝窗口內報酬最大化的一天（獲利交易＝停利點；虧損交易＝損失最小的停損點） */
    bestDate: string;
    bestPrice: number;
    bestReturn: number;
    bestBias5: number | null;
    bestBias10: number | null;
    bestBias20: number | null;
    improvement: number;
    dayOffset: number;
    actualRsi: number | null;
    actualSlopeUpDays: number | null;
    actualForeignConsecBuy: number | null;
    actualTrustConsecBuy: number | null;
    actualMarginConsecIncrease: number | null;
    bestRsi: number | null;
    bestSlopeUpDays: number | null;
    bestForeignConsecBuy: number | null;
    bestTrustConsecBuy: number | null;
    bestMarginConsecIncrease: number | null;
    /** 最差出場日＝窗口內報酬最小化的一天，僅虧損交易用來刻畫「最危險狀態」特徵（FORCE STOP LOSS） */
    worstDate: string;
    worstPrice: number;
    worstReturn: number;
    worstBias5: number | null;
    worstBias10: number | null;
    worstBias20: number | null;
    worstRsi: number | null;
    worstSlopeUpDays: number | null;
    worstForeignConsecBuy: number | null;
    worstTrustConsecBuy: number | null;
    worstMarginConsecIncrease: number | null;
    /** 最佳出場日 ±NEAR_BEST_DAYS 日內各交易日的指標，供中位數計算使用（樣本比單一最佳日更穩健） */
    nearBestSamples?: IndicatorSample[];
    /** 對應原始交易 id，供 DSS 回測分析跨資料交叉比對（買進背離×已實現損益、最佳賣點）使用 */
    buyTxId?: string;
    sellTxId?: string;
}

interface ExitCatStats {
    cat: 'ETF' | '上市' | '上櫃';
    n: number;
    rawN: number;
    qualityCutoff: number;
    // SELL：±2日樣本池中位數，僅獲利交易
    medRsi: number | null;
    medBias5: number | null;
    medBias10: number | null;
    medBias20: number | null;
    medSlopeUpDays: number | null;
    medForeignConsecBuy: number | null;
    medTrustConsecBuy: number | null;
    medMarginConsecIncrease: number | null;
    // FORCE SELL：單一最佳日中位數（不含±2樣本），僅獲利交易，比一般停利更嚴格
    medForceRsi: number | null;
    medForceBias20: number | null;
    medForceSlopeUpDays: number | null;
}

interface StopLossCatStats {
    cat: 'ETF' | '上市' | '上櫃';
    n: number;
    rawN: number;
    qualityCutoff: number;
    // STOP LOSS：±2日樣本池中位數，僅虧損交易，找損失最小的停損點
    medRsi: number | null;
    medBias5: number | null;
    medBias10: number | null;
    medBias20: number | null;
    medSlopeUpDays: number | null;
    medForeignConsecBuy: number | null;
    medTrustConsecBuy: number | null;
    medMarginConsecIncrease: number | null;
    // FORCE STOP LOSS：單一最差日中位數（窗口內損失最大的一天），刻畫最危險狀態特徵
    medForceRsi: number | null;
    medForceBias20: number | null;
    medForceSlopeUpDays: number | null;
}

/** SELL（停利）/ FORCE SELL：僅取「最終獲利」的完整交易 */
const buildExitCatStats = (results: ExitWindowResult[], cat: 'ETF' | '上市' | '上櫃'): ExitCatStats | null => {
    const minN = cat === 'ETF' ? 1 : 3;
    const catList = results.filter(r => r.category === cat && r.isWinner);
    if (catList.length < minN) return null;

    const { kept: list, cutoff } = filterQualityTrades(catList);
    if (list.length < minN) return null;

    const samples = flattenNearBestSamples(list);
    return {
        cat,
        n: list.length,
        rawN: catList.length,
        qualityCutoff: cutoff,
        medRsi: median(samples.map(s => s.rsi).filter(notNull)),
        medBias5: median(samples.map(s => s.bias5).filter(notNull)),
        medBias10: median(samples.map(s => s.bias10).filter(notNull)),
        medBias20: median(samples.map(s => s.bias20).filter(notNull)),
        medSlopeUpDays: median(samples.map(s => s.slopeUpDays).filter(notNull)),
        medForeignConsecBuy: median(samples.map(s => s.foreignConsecBuy).filter(notNull)),
        medTrustConsecBuy: median(samples.map(s => s.trustConsecBuy).filter(notNull)),
        medMarginConsecIncrease: median(samples.map(s => s.marginConsecIncrease).filter(notNull)),
        medForceRsi: median(list.map(r => r.bestRsi).filter(notNull)),
        medForceBias20: median(list.map(r => r.bestBias20).filter(notNull)),
        medForceSlopeUpDays: median(list.map(r => r.bestSlopeUpDays).filter(notNull)),
    };
};

/** STOP LOSS（停損）/ FORCE STOP LOSS：僅取「最終虧損」的完整交易 */
const buildStopLossCatStats = (results: ExitWindowResult[], cat: 'ETF' | '上市' | '上櫃'): StopLossCatStats | null => {
    const minN = cat === 'ETF' ? 1 : 3;
    const catList = results.filter(r => r.category === cat && !r.isWinner);
    if (catList.length < minN) return null;

    const { kept: list, cutoff } = filterQualityTrades(catList);
    if (list.length < minN) return null;

    const samples = flattenNearBestSamples(list);
    return {
        cat,
        n: list.length,
        rawN: catList.length,
        qualityCutoff: cutoff,
        medRsi: median(samples.map(s => s.rsi).filter(notNull)),
        medBias5: median(samples.map(s => s.bias5).filter(notNull)),
        medBias10: median(samples.map(s => s.bias10).filter(notNull)),
        medBias20: median(samples.map(s => s.bias20).filter(notNull)),
        medSlopeUpDays: median(samples.map(s => s.slopeUpDays).filter(notNull)),
        medForeignConsecBuy: median(samples.map(s => s.foreignConsecBuy).filter(notNull)),
        medTrustConsecBuy: median(samples.map(s => s.trustConsecBuy).filter(notNull)),
        medMarginConsecIncrease: median(samples.map(s => s.marginConsecIncrease).filter(notNull)),
        medForceRsi: median(list.map(r => r.worstRsi).filter(notNull)),
        medForceBias20: median(list.map(r => r.worstBias20).filter(notNull)),
        medForceSlopeUpDays: median(list.map(r => r.worstSlopeUpDays).filter(notNull)),
    };
};

const ExitAnalysisSection: React.FC<{ results: ExitWindowResult[] | null }> = ({ results }) => {
    const [exitCatTab, setExitCatTab] = useState<'ETF' | '上市' | '上櫃'>('上市');

    const exitCatStats = useMemo(() => {
        if (!results?.length) return null;
        const etf = buildExitCatStats(results, 'ETF');
        const listed = buildExitCatStats(results, '上市');
        const otc = buildExitCatStats(results, '上櫃');
        if (!etf && !listed && !otc) return null;
        return { ETF: etf, 上市: listed, 上櫃: otc };
    }, [results]);

    // STOP LOSS / FORCE STOP LOSS：僅取最終虧損的完整交易，跟 SELL/FORCE SELL（僅取獲利交易）互斥分流
    const stopLossCatStats = useMemo(() => {
        if (!results?.length) return null;
        const etf = buildStopLossCatStats(results, 'ETF');
        const listed = buildStopLossCatStats(results, '上市');
        const otc = buildStopLossCatStats(results, '上櫃');
        if (!etf && !listed && !otc) return null;
        return { ETF: etf, 上市: listed, 上櫃: otc };
    }, [results]);

    const avgImprovement = results?.length ? avg(results.map(r => r.improvement)) : null;
    const couldImprove = results?.filter(r => r.improvement > 0.5).length ?? 0;
    const losers = results?.filter(r => r.actualReturn < 0) ?? [];
    const avgLossReduction = losers.length ? avg(losers.map(r => r.improvement)) : null;
    const lossAvoided = losers.filter(r => r.bestReturn >= 0).length;

    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex items-center gap-2">
                <Target size={16} className="text-amber-400" />
                <h3 className="text-sm font-bold text-slate-200">出場分析</h3>
                <span className="text-xs text-slate-500 ml-1">若改在附近最高價出場，報酬率可提升多少？</span>
            </div>
            <div className="p-4 space-y-4">
                {!results && (
                    <div className="text-center py-12 text-slate-500 text-sm">尚未執行分析，請至上方點擊「開始分析」</div>
                )}
                {results && (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            <div className="bg-slate-900/60 rounded-xl p-3 text-center">
                                <div className="text-xs text-slate-400 mb-1">平均可改善報酬</div>
                                <div className={`text-lg font-bold ${(avgImprovement ?? 0) > 0 ? 'text-red-400' : 'text-slate-300'}`}>
                                    {avgImprovement !== null ? `+${avgImprovement.toFixed(2)}%` : '-'}
                                </div>
                                <div className="text-[10px] text-slate-500">全部交易</div>
                            </div>
                            <div className="bg-slate-900/60 rounded-xl p-3 text-center">
                                <div className="text-xs text-slate-400 mb-1">可顯著改善筆數</div>
                                <div className="text-lg font-bold text-amber-400">{couldImprove} / {results.length}</div>
                                <div className="text-[10px] text-slate-500">改善 &gt; 0.5%</div>
                            </div>
                            <div className="bg-emerald-900/30 border border-emerald-800/40 rounded-xl p-3 text-center">
                                <div className="text-xs text-emerald-400 mb-1">虧損交易筆數</div>
                                <div className="text-lg font-bold text-emerald-400">{losers.length}</div>
                                <div className="text-[10px] text-slate-500">實際負報酬</div>
                            </div>
                            <div className="bg-emerald-900/30 border border-emerald-800/40 rounded-xl p-3 text-center">
                                <div className="text-xs text-emerald-400 mb-1">虧損平均可減少</div>
                                <div className={`text-lg font-bold ${(avgLossReduction ?? 0) > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                                    {avgLossReduction !== null ? `+${avgLossReduction.toFixed(2)}%` : '-'}
                                </div>
                                <div className="text-[10px] text-slate-500">提早/延後出場</div>
                            </div>
                            <div className="bg-emerald-900/30 border border-emerald-800/40 rounded-xl p-3 text-center">
                                <div className="text-xs text-emerald-400 mb-1">可轉為獲利</div>
                                <div className="text-lg font-bold text-red-400">{lossAvoided} 筆</div>
                                <div className="text-[10px] text-slate-500">最佳日報酬 ≥ 0</div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead><tr className="text-xs text-slate-400 border-b border-slate-700">
                                    <th className="py-2 px-3">標的</th>
                                    <th className="py-2 px-3 text-center">進場日</th>
                                    <th className="py-2 px-3 text-center">出場日</th>
                                    <th className="py-2 px-3 text-right">實際賣出</th>
                                    <th className="py-2 px-3 text-right">實際報酬</th>
                                    <th className="py-2 px-3 text-center text-sky-400">B5</th>
                                    <th className="py-2 px-3 text-center text-violet-400">B10</th>
                                    <th className="py-2 px-3 text-center text-slate-400">B20</th>
                                    <th className="py-2 px-3 text-center">最佳日（偏移）</th>
                                    <th className="py-2 px-3 text-right">最佳價格</th>
                                    <th className="py-2 px-3 text-right">最佳報酬</th>
                                    <th className="py-2 px-3 text-center text-sky-400">最佳B5</th>
                                    <th className="py-2 px-3 text-center text-violet-400">最佳B10</th>
                                    <th className="py-2 px-3 text-center text-slate-400">最佳B20</th>
                                    <th className="py-2 px-3 text-center text-amber-400">最佳RSI</th>
                                    <th className="py-2 px-3 text-center text-amber-400">最佳斜率</th>
                                    <th className="py-2 px-3 text-center text-amber-400">最佳外資</th>
                                    <th className="py-2 px-3 text-center text-amber-400">最佳投信</th>
                                    <th className="py-2 px-3 text-center text-amber-400">最佳融資</th>
                                    <th className="py-2 px-3 text-right">可改善</th>
                                </tr></thead>
                                <tbody>
                                    {results.slice(0, 50).map((r, i) => (
                                        <tr key={i} className={`border-t border-slate-700/30 transition-colors ${r.actualReturn < 0 ? 'bg-emerald-950/20 hover:bg-emerald-950/30' : 'hover:bg-slate-700/10'}`}>
                                            <td className="py-2 px-3 text-sm">
                                                <div className="font-medium text-white">{r.name ?? r.symbol}</div>
                                                <div className="text-xs text-slate-500">{r.symbol}</div>
                                            </td>
                                            <td className="py-2 px-3 text-center text-xs text-slate-400">{r.buyDate}</td>
                                            <td className="py-2 px-3 text-center text-xs text-slate-400">{r.sellDate}</td>
                                            <td className="py-2 px-3 text-right font-mono text-sm text-slate-300">{r.actualSellPrice}</td>
                                            <td className="py-2 px-3 text-right font-mono text-sm">
                                                <span className={r.actualReturn >= 0 ? 'text-red-400' : 'text-emerald-400'}>
                                                    {r.actualReturn >= 0 ? '+' : ''}{r.actualReturn.toFixed(2)}%
                                                </span>
                                            </td>
                                            <td className="py-2 px-3 text-center font-mono text-xs text-sky-400">{r.actualBias5 !== null ? `${r.actualBias5.toFixed(1)}%` : '-'}</td>
                                            <td className="py-2 px-3 text-center font-mono text-xs text-violet-400">{r.actualBias10 !== null ? `${r.actualBias10.toFixed(1)}%` : '-'}</td>
                                            <td className="py-2 px-3 text-center font-mono text-xs text-slate-400">{r.actualBias20 !== null ? `${r.actualBias20.toFixed(1)}%` : '-'}</td>
                                            <td className="py-2 px-3 text-center text-xs">
                                                <span className="text-slate-300">{r.bestDate}</span>
                                                <span className={`ml-1 ${r.dayOffset > 0 ? 'text-sky-400' : r.dayOffset < 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                                                    {r.dayOffset > 0 ? `(早 ${r.dayOffset}天)` : r.dayOffset < 0 ? `(晚 ${Math.abs(r.dayOffset)}天)` : '(同日)'}
                                                </span>
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono text-sm text-slate-300">{r.bestPrice}</td>
                                            <td className="py-2 px-3 text-right font-mono text-sm">
                                                <span className={r.bestReturn >= 0 ? 'text-red-400' : 'text-emerald-400'}>
                                                    {r.bestReturn >= 0 ? '+' : ''}{r.bestReturn.toFixed(2)}%
                                                </span>
                                            </td>
                                            <td className="py-2 px-3 text-center font-mono text-xs text-sky-400">{r.bestBias5 !== null ? `${r.bestBias5.toFixed(1)}%` : '-'}</td>
                                            <td className="py-2 px-3 text-center font-mono text-xs text-violet-400">{r.bestBias10 !== null ? `${r.bestBias10.toFixed(1)}%` : '-'}</td>
                                            <td className="py-2 px-3 text-center font-mono text-xs text-slate-400">{r.bestBias20 !== null ? `${r.bestBias20.toFixed(1)}%` : '-'}</td>
                                            <td className="py-2 px-3 text-center font-mono text-xs text-amber-300">{r.bestRsi != null ? r.bestRsi.toFixed(1) : '-'}</td>
                                            <td className="py-2 px-3 text-center font-mono text-xs text-amber-300">{r.bestSlopeUpDays != null ? `${r.bestSlopeUpDays}天` : '-'}</td>
                                            <td className="py-2 px-3 text-center font-mono text-xs text-amber-300">{r.bestForeignConsecBuy != null ? `${r.bestForeignConsecBuy}天` : '-'}</td>
                                            <td className="py-2 px-3 text-center font-mono text-xs text-amber-300">{r.bestTrustConsecBuy != null ? `${r.bestTrustConsecBuy}天` : '-'}</td>
                                            <td className="py-2 px-3 text-center font-mono text-xs text-amber-300">{r.bestMarginConsecIncrease != null ? `${r.bestMarginConsecIncrease}天` : '-'}</td>
                                            <td className="py-2 px-3 text-right font-mono text-sm font-bold">
                                                <span className={r.improvement > 0.5 ? 'text-amber-400' : r.improvement > 0 ? 'text-slate-300' : 'text-slate-500'}>
                                                    {r.improvement > 0 ? '+' : ''}{r.improvement.toFixed(2)}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {(exitCatStats || stopLossCatStats) && (
                            <div className="pt-4 border-t border-slate-700 space-y-3">
                                <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-bold text-slate-200">最佳出場點參數中位數</h4>
                                    <span className="text-xs text-slate-500">依分類彙總 — 供停利/停損門檻參考</span>
                                </div>
                                <div className="flex gap-1">
                                    {(['ETF', '上市', '上櫃'] as const).map(tab => {
                                        const s = exitCatStats?.[tab] ?? stopLossCatStats?.[tab];
                                        const disabled = !s;
                                        return (
                                            <button key={tab} onClick={() => !disabled && setExitCatTab(tab)}
                                                disabled={disabled}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                                    exitCatTab === tab && !disabled
                                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                                        : disabled
                                                            ? 'text-slate-600 cursor-not-allowed'
                                                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                                                }`}>
                                                {tab}
                                                {s ? <span className="ml-1 text-slate-500">({s.n}/{s.rawN})</span>
                                                   : <span className="ml-1 text-slate-600">(不足)</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                                {exitCatStats?.[exitCatTab] ? (
                                    <>
                                    <div className="text-xs text-slate-500">
                                        SELL（停利，僅取最終獲利交易）· 優質數據篩選：改善幅度前 70%（{exitCatStats[exitCatTab]!.rawN} 筆中保留 {exitCatStats[exitCatTab]!.n} 筆，門檻 ≥ {exitCatStats[exitCatTab]!.qualityCutoff.toFixed(1)}%）
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <StatCard label="RSI 中位數" value={exitCatStats[exitCatTab]!.medRsi?.toFixed(1) ?? '-'} color="text-amber-300" />
                                        <StatCard label="Bias5 中位數" value={exitCatStats[exitCatTab]!.medBias5 !== null ? `${exitCatStats[exitCatTab]!.medBias5!.toFixed(1)}%` : '-'} color="text-sky-400" />
                                        <StatCard label="Bias10 中位數" value={exitCatStats[exitCatTab]!.medBias10 !== null ? `${exitCatStats[exitCatTab]!.medBias10!.toFixed(1)}%` : '-'} color="text-violet-400" />
                                        <StatCard label="Bias20 中位數" value={exitCatStats[exitCatTab]!.medBias20 !== null ? `${exitCatStats[exitCatTab]!.medBias20!.toFixed(1)}%` : '-'} color="text-slate-300" />
                                        <StatCard label="斜率連升天數中位數" value={exitCatStats[exitCatTab]!.medSlopeUpDays !== null ? `${exitCatStats[exitCatTab]!.medSlopeUpDays}天` : '-'} color="text-amber-300" />
                                        <StatCard label="外資連買天數中位數" value={exitCatStats[exitCatTab]!.medForeignConsecBuy !== null ? `${exitCatStats[exitCatTab]!.medForeignConsecBuy}天` : '-'} color="text-amber-300" />
                                        <StatCard label="投信連買天數中位數" value={exitCatStats[exitCatTab]!.medTrustConsecBuy !== null ? `${exitCatStats[exitCatTab]!.medTrustConsecBuy}天` : '-'} color="text-amber-300" />
                                        <StatCard label="融資連增天數中位數" value={exitCatStats[exitCatTab]!.medMarginConsecIncrease !== null ? `${exitCatStats[exitCatTab]!.medMarginConsecIncrease}天` : '-'} color="text-amber-300" />
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">FORCE SELL（取單一最佳出場日，不含 ±2 日鄰近樣本，比一般停利更嚴格）</div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <StatCard label="強制停利 RSI 中位數" value={exitCatStats[exitCatTab]!.medForceRsi?.toFixed(1) ?? '-'} color="text-red-300" />
                                        <StatCard label="強制停利 Bias20 中位數" value={exitCatStats[exitCatTab]!.medForceBias20 !== null ? `${exitCatStats[exitCatTab]!.medForceBias20!.toFixed(1)}%` : '-'} color="text-red-300" />
                                        <StatCard label="強制停利斜率連升天數中位數" value={exitCatStats[exitCatTab]!.medForceSlopeUpDays !== null ? `${exitCatStats[exitCatTab]!.medForceSlopeUpDays}天` : '-'} color="text-red-300" />
                                    </div>
                                    </>
                                ) : (
                                    <div className="text-xs text-slate-500 py-4 text-center">此類別獲利交易資料不足（上市/上櫃需 ≥3 筆，ETF 需 ≥1 筆）</div>
                                )}
                                {stopLossCatStats && (
                                    <div className="pt-3 border-t border-slate-700/60 space-y-3">
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-sm font-bold text-slate-200">最佳停損點參數中位數</h4>
                                            <span className="text-xs text-slate-500">STOP LOSS / FORCE STOP LOSS，僅取最終虧損交易</span>
                                        </div>
                                        {stopLossCatStats[exitCatTab] ? (
                                            <>
                                            <div className="text-xs text-slate-500">
                                                STOP LOSS（找損失最小的停損點）· 優質數據篩選：改善幅度前 70%（{stopLossCatStats[exitCatTab]!.rawN} 筆中保留 {stopLossCatStats[exitCatTab]!.n} 筆，門檻 ≥ {stopLossCatStats[exitCatTab]!.qualityCutoff.toFixed(1)}%）
                                                {exitCatTab === 'ETF' && <span className="text-slate-600">（ETF 無停損機制，此數值僅供參考）</span>}
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                <StatCard label="RSI 中位數" value={stopLossCatStats[exitCatTab]!.medRsi?.toFixed(1) ?? '-'} color="text-emerald-300" />
                                                <StatCard label="Bias5 中位數" value={stopLossCatStats[exitCatTab]!.medBias5 !== null ? `${stopLossCatStats[exitCatTab]!.medBias5!.toFixed(1)}%` : '-'} color="text-sky-400" />
                                                <StatCard label="Bias10 中位數" value={stopLossCatStats[exitCatTab]!.medBias10 !== null ? `${stopLossCatStats[exitCatTab]!.medBias10!.toFixed(1)}%` : '-'} color="text-violet-400" />
                                                <StatCard label="Bias20 中位數" value={stopLossCatStats[exitCatTab]!.medBias20 !== null ? `${stopLossCatStats[exitCatTab]!.medBias20!.toFixed(1)}%` : '-'} color="text-slate-300" />
                                                <StatCard label="斜率連升天數中位數" value={stopLossCatStats[exitCatTab]!.medSlopeUpDays !== null ? `${stopLossCatStats[exitCatTab]!.medSlopeUpDays}天` : '-'} color="text-emerald-300" />
                                                <StatCard label="外資連買天數中位數" value={stopLossCatStats[exitCatTab]!.medForeignConsecBuy !== null ? `${stopLossCatStats[exitCatTab]!.medForeignConsecBuy}天` : '-'} color="text-emerald-300" />
                                                <StatCard label="投信連買天數中位數" value={stopLossCatStats[exitCatTab]!.medTrustConsecBuy !== null ? `${stopLossCatStats[exitCatTab]!.medTrustConsecBuy}天` : '-'} color="text-emerald-300" />
                                                <StatCard label="融資連增天數中位數" value={stopLossCatStats[exitCatTab]!.medMarginConsecIncrease !== null ? `${stopLossCatStats[exitCatTab]!.medMarginConsecIncrease}天` : '-'} color="text-emerald-300" />
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1">FORCE STOP LOSS（窗口內損失最大的一天，刻畫最危險狀態特徵，目前僅供參考、不自動套用）</div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                <StatCard label="最危險 RSI 中位數" value={stopLossCatStats[exitCatTab]!.medForceRsi?.toFixed(1) ?? '-'} color="text-slate-400" />
                                                <StatCard label="最危險 Bias20 中位數" value={stopLossCatStats[exitCatTab]!.medForceBias20 !== null ? `${stopLossCatStats[exitCatTab]!.medForceBias20!.toFixed(1)}%` : '-'} color="text-slate-400" />
                                                <StatCard label="最危險斜率天數中位數" value={stopLossCatStats[exitCatTab]!.medForceSlopeUpDays !== null ? `${stopLossCatStats[exitCatTab]!.medForceSlopeUpDays}天` : '-'} color="text-slate-400" />
                                            </div>
                                            </>
                                        ) : (
                                            <div className="text-xs text-slate-500 py-4 text-center">此類別虧損交易資料不足（上市/上櫃需 ≥3 筆，ETF 需 ≥1 筆）</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

const StatCard = ({ label, value, sub, color = 'text-white' }: { label: string; value: string; sub?: string; color?: string }) => (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
        <div className="text-xs text-slate-400 mb-1">{label}</div>
        <div className={`text-xl font-bold ${color}`}>{value}</div>
        {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
);

// ── Section 5：背離分析（BUY 漏判/誤判/時點偏移；SELL/STOP LOSS 過早/過晚）──────
/** 進場日與最佳進場/出場日相差超過此天數（日曆天，對齊 dayOffset 計算方式）才視為有意義的偏移，避免零附近雜訊 */
const DIVERGE_DAY_THRESHOLD = 3;

interface BuyDivergenceRow {
    symbol: string;
    name?: string;
    category: 'ETF' | '上市' | '上櫃';
    buyDate: string;
    alignment: 'MATCH' | 'DIVERGE' | 'PARTIAL';
    realizedProfit: number;
    dayOffset: number | null;
    rsi: number;
    bias20: number;
    slopeUpDays: number;
    foreignConsecBuy: number;
    trustConsecBuy: number;
}

const fmtNum = (v: number | null) => v !== null ? v.toFixed(1) : '-';
const fmtPct = (v: number | null) => v !== null ? `${v.toFixed(1)}%` : '-';
const fmtDays = (v: number | null) => v !== null ? `${Math.round(v)}天` : '-';
/** 過濾 null/undefined 後取中位數（沿用上方 median()），供各背離分類母體中位數使用 */
const medianOf = (arr: (number | null | undefined)[]): number | null =>
    median(arr.filter((v): v is number => v !== null && v !== undefined));

const MiniStat = ({ label, value }: { label: string; value: string }) => (
    <div className="bg-slate-900/40 border border-slate-700/50 rounded-lg px-3 py-1.5 text-center min-w-[84px]">
        <div className="text-[10px] text-slate-500">{label}</div>
        <div className="text-sm font-bold text-amber-300">{value}</div>
    </div>
);

const MedianStatsRow: React.FC<{ n: number; items: { label: string; value: string }[] }> = ({ n, items }) => (
    <div className="flex flex-wrap gap-2">
        <MiniStat label="樣本數" value={`${n}`} />
        {items.map(it => <MiniStat key={it.label} label={it.label} value={it.value} />)}
    </div>
);

const buyBucketMedianItems = (list: BuyDivergenceRow[]) => [
    { label: 'RSI 中位數', value: fmtNum(medianOf(list.map(r => r.rsi))) },
    { label: 'Bias20 中位數', value: fmtPct(medianOf(list.map(r => r.bias20))) },
    { label: '斜率天數中位數', value: fmtDays(medianOf(list.map(r => r.slopeUpDays))) },
    { label: '外資連買中位數', value: fmtDays(medianOf(list.map(r => r.foreignConsecBuy))) },
    { label: '投信連買中位數', value: fmtDays(medianOf(list.map(r => r.trustConsecBuy))) },
];

const exitBucketMedianItems = (list: ExitWindowResult[]) => [
    { label: 'RSI 中位數', value: fmtNum(medianOf(list.map(r => r.actualRsi))) },
    { label: 'Bias5 中位數', value: fmtPct(medianOf(list.map(r => r.actualBias5))) },
    { label: 'Bias10 中位數', value: fmtPct(medianOf(list.map(r => r.actualBias10))) },
    { label: 'Bias20 中位數', value: fmtPct(medianOf(list.map(r => r.actualBias20))) },
    { label: '斜率天數中位數', value: fmtDays(medianOf(list.map(r => r.actualSlopeUpDays))) },
    { label: '外資連買中位數', value: fmtDays(medianOf(list.map(r => r.actualForeignConsecBuy))) },
    { label: '投信連買中位數', value: fmtDays(medianOf(list.map(r => r.actualTrustConsecBuy))) },
    { label: '融資連增中位數', value: fmtDays(medianOf(list.map(r => r.actualMarginConsecIncrease))) },
];

const BuyDivergenceTable: React.FC<{ list: BuyDivergenceRow[] }> = ({ list }) => {
    if (!list.length) return <div className="text-xs text-slate-500 py-4 text-center">此分類目前無資料</div>;
    return (
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-800">
                    <tr className="text-slate-400">
                        <th className="py-1.5 px-2 text-left">標的</th>
                        <th className="py-1.5 px-2 text-left">分類</th>
                        <th className="py-1.5 px-2 text-left">進場日</th>
                        <th className="py-1.5 px-2 text-center">燈號比對</th>
                        <th className="py-1.5 px-2 text-right">已實現損益</th>
                        <th className="py-1.5 px-2 text-right">最佳進場日偏移</th>
                    </tr>
                </thead>
                <tbody>
                    {list.map((r, i) => (
                        <tr key={i} className="border-t border-slate-700/40">
                            <td className="py-1.5 px-2 text-slate-200">{r.name ? `${r.name} (${r.symbol})` : r.symbol}</td>
                            <td className="py-1.5 px-2 text-slate-400">{r.category}</td>
                            <td className="py-1.5 px-2 text-slate-400">{r.buyDate}</td>
                            <td className="py-1.5 px-2 text-center text-slate-300">{r.alignment}</td>
                            <td className={`py-1.5 px-2 text-right font-mono ${r.realizedProfit >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>{r.realizedProfit.toFixed(0)}</td>
                            <td className="py-1.5 px-2 text-right font-mono text-slate-400">{r.dayOffset !== null ? `${r.dayOffset > 0 ? '+' : ''}${r.dayOffset}天` : '—'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const ExitDivergenceTable: React.FC<{ list: ExitWindowResult[] }> = ({ list }) => {
    if (!list.length) return <div className="text-xs text-slate-500 py-4 text-center">此分類目前無資料</div>;
    return (
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-800">
                    <tr className="text-slate-400">
                        <th className="py-1.5 px-2 text-left">標的</th>
                        <th className="py-1.5 px-2 text-left">分類</th>
                        <th className="py-1.5 px-2 text-left">實際賣出日</th>
                        <th className="py-1.5 px-2 text-left">最佳出場日</th>
                        <th className="py-1.5 px-2 text-right">實際報酬</th>
                        <th className="py-1.5 px-2 text-right">最佳報酬</th>
                        <th className="py-1.5 px-2 text-right">日差</th>
                    </tr>
                </thead>
                <tbody>
                    {list.map((r, i) => (
                        <tr key={i} className="border-t border-slate-700/40">
                            <td className="py-1.5 px-2 text-slate-200">{r.name ? `${r.name} (${r.symbol})` : r.symbol}</td>
                            <td className="py-1.5 px-2 text-slate-400">{r.category}</td>
                            <td className="py-1.5 px-2 text-slate-400">{r.sellDate}</td>
                            <td className="py-1.5 px-2 text-slate-400">{r.bestDate}</td>
                            <td className="py-1.5 px-2 text-right font-mono text-slate-300">{r.actualReturn.toFixed(1)}%</td>
                            <td className="py-1.5 px-2 text-right font-mono text-slate-300">{r.bestReturn.toFixed(1)}%</td>
                            <td className="py-1.5 px-2 text-right font-mono text-slate-400">{r.dayOffset > 0 ? '+' : ''}{r.dayOffset}天</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const DivergenceAnalysisSection: React.FC<{
    completedTrades: CompletedTrade[];
    optimalResults: WindowResult[] | null;
    exitResults: ExitWindowResult[] | null;
}> = ({ completedTrades, optimalResults, exitResults }) => {
    const [backtestCache] = useState(() => getBacktestCache());
    const [buySubTab, setBuySubTab] = useState<'falseBuy' | 'missed' | 'timingOff'>('falseBuy');
    const [sellSubTab, setSellSubTab] = useState<'early' | 'late'>('early');
    const [stopSubTab, setStopSubTab] = useState<'early' | 'late'>('early');

    const buyRows = useMemo((): BuyDivergenceRow[] | null => {
        if (!backtestCache) return null;
        const buyResultByTxId = new Map<string, BacktestResult>();
        backtestCache.results.forEach(r => { if (r.side === 'BUY' && !r.error) buyResultByTxId.set(r.tradeId, r); });
        const offsetByBuyTxId = new Map<string, number>();
        optimalResults?.forEach(w => { if (w.buyTxId) offsetByBuyTxId.set(w.buyTxId, w.dayOffset); });
        const rows: BuyDivergenceRow[] = [];
        completedTrades.forEach(t => {
            const r = buyResultByTxId.get(t.buyTxId);
            if (!r) return;
            rows.push({
                symbol: t.symbol, name: t.name, category: t.category, buyDate: t.buyDate,
                alignment: r.alignment, realizedProfit: t.realizedProfit,
                dayOffset: offsetByBuyTxId.get(t.buyTxId) ?? null,
                rsi: r.rsi, bias20: r.bias20, slopeUpDays: slopeConsecUp(r.biasSlopes),
                foreignConsecBuy: r.foreignConsecBuy, trustConsecBuy: r.trustConsecBuy,
            });
        });
        return rows;
    }, [backtestCache, optimalResults, completedTrades]);

    const buyStats = useMemo(() => {
        if (!buyRows?.length) return null;
        const falseBuy = buyRows.filter(r => r.alignment === 'MATCH' && r.realizedProfit < 0);
        const missed = buyRows.filter(r => r.alignment !== 'MATCH' && r.realizedProfit > 0);
        const timingOff = buyRows.filter(r => r.dayOffset !== null && Math.abs(r.dayOffset) > DIVERGE_DAY_THRESHOLD);
        return { total: buyRows.length, falseBuy, missed, timingOff };
    }, [buyRows]);

    const sellDivergence = useMemo(() => {
        if (!exitResults) return null;
        const pool = exitResults.filter(r => r.isWinner);
        if (!pool.length) return null;
        return { total: pool.length, early: pool.filter(r => r.dayOffset < -DIVERGE_DAY_THRESHOLD), late: pool.filter(r => r.dayOffset > DIVERGE_DAY_THRESHOLD) };
    }, [exitResults]);

    const stopLossDivergence = useMemo(() => {
        if (!exitResults) return null;
        const pool = exitResults.filter(r => !r.isWinner);
        if (!pool.length) return null;
        return { total: pool.length, early: pool.filter(r => r.dayOffset < -DIVERGE_DAY_THRESHOLD), late: pool.filter(r => r.dayOffset > DIVERGE_DAY_THRESHOLD) };
    }, [exitResults]);

    if (!buyStats && !sellDivergence && !stopLossDivergence) {
        return (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 text-center text-slate-500 text-sm">
                尚無可比對資料 — 請先執行上方「開始分析」，並至「DSS 回測分析」執行一次回測
            </div>
        );
    }

    const buyTabs = buyStats ? [
        { key: 'falseBuy' as const, label: '誤判', desc: '訊號判定進場，但實際虧損', list: buyStats.falseBuy },
        { key: 'missed' as const, label: '漏判', desc: '訊號未判定進場，但實際獲利', list: buyStats.missed },
        { key: 'timingOff' as const, label: '時點偏移', desc: `最佳進場日與實際進場日相差 > ${DIVERGE_DAY_THRESHOLD} 天`, list: buyStats.timingOff },
    ] : [];

    return (
        <div className="space-y-6">
            {buyStats && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-slate-700 flex items-center gap-2">
                        <BarChart2 size={16} className="text-violet-400" />
                        <h3 className="text-sm font-bold text-slate-200">買進背離分類</h3>
                        <span className="text-xs text-slate-500 ml-1">共比對 {buyStats.total} 筆已配對交易（來自 DSS 回測分析快取）</span>
                    </div>
                    <div className="p-4 space-y-4">
                        <div className="grid grid-cols-3 gap-3">
                            {buyTabs.map(t => (
                                <button key={t.key} onClick={() => setBuySubTab(t.key)}
                                    className={`text-left p-3 rounded-xl border transition-colors ${buySubTab === t.key ? 'bg-violet-600/20 border-violet-500/40' : 'bg-slate-800/60 border-slate-700 hover:border-slate-600'}`}>
                                    <div className="text-xs text-slate-400">{t.label}</div>
                                    <div className="text-xl font-bold text-white">{t.list.length}
                                        <span className="text-xs text-slate-500 font-normal ml-1">({buyStats.total ? ((t.list.length / buyStats.total) * 100).toFixed(1) : '0'}%)</span>
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">{t.desc}</div>
                                </button>
                            ))}
                        </div>
                        <MedianStatsRow n={buyTabs.find(t => t.key === buySubTab)?.list.length ?? 0} items={buyBucketMedianItems(buyTabs.find(t => t.key === buySubTab)?.list ?? [])} />
                        <BuyDivergenceTable list={buyTabs.find(t => t.key === buySubTab)?.list ?? []} />
                    </div>
                </div>
            )}

            {(sellDivergence || stopLossDivergence) && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-slate-700 flex items-center gap-2">
                        <Target size={16} className="text-emerald-400" />
                        <h3 className="text-sm font-bold text-slate-200">出場背離分類</h3>
                        <span className="text-xs text-slate-500 ml-1">與「出場分析」±{WINDOW_DAYS}日窗口內最佳/最差出場日比對</span>
                    </div>
                    <div className="p-4 space-y-5">
                        {sellDivergence && (
                            <div className="space-y-3">
                                <div className="text-xs text-slate-400">SELL（最終獲利交易，共 {sellDivergence.total} 筆）</div>
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={() => setSellSubTab('early')}
                                        className={`text-left p-3 rounded-xl border transition-colors ${sellSubTab === 'early' ? 'bg-emerald-600/20 border-emerald-500/40' : 'bg-slate-800/60 border-slate-700 hover:border-slate-600'}`}>
                                        <div className="text-xs text-slate-400">過早賣出</div>
                                        <div className="text-xl font-bold text-white">{sellDivergence.early.length}
                                            <span className="text-xs text-slate-500 font-normal ml-1">({sellDivergence.total ? ((sellDivergence.early.length / sellDivergence.total) * 100).toFixed(1) : '0'}%)</span>
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1">最佳賣點在實際賣出日之後</div>
                                    </button>
                                    <button onClick={() => setSellSubTab('late')}
                                        className={`text-left p-3 rounded-xl border transition-colors ${sellSubTab === 'late' ? 'bg-emerald-600/20 border-emerald-500/40' : 'bg-slate-800/60 border-slate-700 hover:border-slate-600'}`}>
                                        <div className="text-xs text-slate-400">過晚賣出</div>
                                        <div className="text-xl font-bold text-white">{sellDivergence.late.length}
                                            <span className="text-xs text-slate-500 font-normal ml-1">({sellDivergence.total ? ((sellDivergence.late.length / sellDivergence.total) * 100).toFixed(1) : '0'}%)</span>
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1">最佳賣點在實際賣出日之前（賣晚了）</div>
                                    </button>
                                </div>
                                <MedianStatsRow n={(sellSubTab === 'early' ? sellDivergence.early : sellDivergence.late).length} items={exitBucketMedianItems(sellSubTab === 'early' ? sellDivergence.early : sellDivergence.late)} />
                                <ExitDivergenceTable list={sellSubTab === 'early' ? sellDivergence.early : sellDivergence.late} />
                            </div>
                        )}
                        {stopLossDivergence && (
                            <div className="space-y-3 pt-4 border-t border-slate-700">
                                <div className="text-xs text-slate-400">STOP LOSS（最終虧損交易，共 {stopLossDivergence.total} 筆）</div>
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={() => setStopSubTab('early')}
                                        className={`text-left p-3 rounded-xl border transition-colors ${stopSubTab === 'early' ? 'bg-amber-600/20 border-amber-500/40' : 'bg-slate-800/60 border-slate-700 hover:border-slate-600'}`}>
                                        <div className="text-xs text-slate-400">停損過早</div>
                                        <div className="text-xl font-bold text-white">{stopLossDivergence.early.length}
                                            <span className="text-xs text-slate-500 font-normal ml-1">({stopLossDivergence.total ? ((stopLossDivergence.early.length / stopLossDivergence.total) * 100).toFixed(1) : '0'}%)</span>
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1">窗口內最小損失日在實際停損日之後</div>
                                    </button>
                                    <button onClick={() => setStopSubTab('late')}
                                        className={`text-left p-3 rounded-xl border transition-colors ${stopSubTab === 'late' ? 'bg-amber-600/20 border-amber-500/40' : 'bg-slate-800/60 border-slate-700 hover:border-slate-600'}`}>
                                        <div className="text-xs text-slate-400">停損過晚</div>
                                        <div className="text-xl font-bold text-white">{stopLossDivergence.late.length}
                                            <span className="text-xs text-slate-500 font-normal ml-1">({stopLossDivergence.total ? ((stopLossDivergence.late.length / stopLossDivergence.total) * 100).toFixed(1) : '0'}%)</span>
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1">窗口內最小損失日在實際停損日之前（停損慢了）</div>
                                    </button>
                                </div>
                                <MedianStatsRow n={(stopSubTab === 'early' ? stopLossDivergence.early : stopLossDivergence.late).length} items={exitBucketMedianItems(stopSubTab === 'early' ? stopLossDivergence.early : stopLossDivergence.late)} />
                                <ExitDivergenceTable list={stopSubTab === 'early' ? stopLossDivergence.early : stopLossDivergence.late} />
                            </div>
                        )}
                    </div>
                </div>
            )}
            <p className="text-xs text-slate-600">
                各分類上方的中位數為該分類母體（誤判/漏判/時點偏移/過早/過晚）自身的技術面/籌碼面中位數，僅供對照「±N日最佳進場分析」/「出場分析」頁籤中的整體中位數參考，尚未自動套用或寫入設定檔；分位數修正與自動收斂迴圈仍維持暫停（如需要可再討論）。
            </p>
        </div>
    );
};

export const DSSLab: React.FC<Props> = ({ stockTransactions }) => {
    const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());

    useEffect(() => {
        const symbols = [...new Set(stockTransactions.map(t => t.symbol).filter(Boolean))] as string[];
        Promise.all(symbols.map(async s => [s, await lookupStockName(s)] as [string, string | null]))
            .then(entries => {
                const map = new Map<string, string>();
                entries.forEach(([s, n]) => { if (n) map.set(s, n); });
                setNameMap(map);
            });
    }, [stockTransactions]);
    const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
    const [sortKey, setSortKey] = useState<SortKey>('trades');
    const [sortAsc, setSortAsc] = useState(false);
    const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
    const [activeSection, setActiveSection] = useState<'winrate' | 'optimal' | 'exit' | 'divergence' | 'backtest'>('winrate');

    const OPTIMAL_CACHE_KEY = 'ft_dsslab_optimal_cache';
    const EXIT_CACHE_KEY = 'ft_dsslab_exit_cache';
    const RAW_CACHE_KEY = 'ft_dsslab_raw_cache';
    const [optimalResults, setOptimalResults] = useState<WindowResult[] | null>(null);
    const [exitResults, setExitResults] = useState<ExitWindowResult[] | null>(null);
    const [analysisRunning, setAnalysisRunning] = useState(false);
    const [analysisProgress, setAnalysisProgress] = useState<{ done: number; total: number } | null>(null);
    const [analysisTs, setAnalysisTs] = useState<number | null>(null);
    const [savedProfileMsg, setSavedProfileMsg] = useState('');

    const allCompleted = useMemo(() => buildCompletedTrades(stockTransactions), [stockTransactions]);

    const filteredTrades = useMemo(() =>
        categoryFilter === 'ALL' ? allCompleted : allCompleted.filter(t => t.category === categoryFilter),
        [allCompleted, categoryFilter]);

    useEffect(() => {
        try {
            const rawOpt = localStorage.getItem(OPTIMAL_CACHE_KEY);
            if (rawOpt) { const p = JSON.parse(rawOpt); setOptimalResults(p.results); setAnalysisTs(p.timestamp); }
        } catch { /* 快取損壞則忽略 */ }
        try {
            const rawExit = localStorage.getItem(EXIT_CACHE_KEY);
            if (rawExit) { const p = JSON.parse(rawExit); setExitResults(p.results); }
        } catch { /* 快取損壞則忽略 */ }
    }, []);

    /** 統一分析：進場+出場一次跑完，共用同一份原始資料抓取（kline/籌碼/融資只抓一次）*/
    const handleRunAnalysis = async () => {
        setAnalysisRunning(true);
        setOptimalResults(null);
        setExitResults(null);
        const params = getTechParameters();
        const symbols = [...new Set(filteredTrades.map(t => t.symbol))];
        const klineCache = new Map<string, { date: string; close: number }[]>();
        const instCache = new Map<string, { date: string; foreign: number; trust: number }[]>();
        const marginCache = new Map<string, { date: string; balance: number }[]>();
        const total = symbols.length;
        let done = 0;

        let rawCache: Record<string, RawCacheEntry> = {};
        try { rawCache = JSON.parse(localStorage.getItem(RAW_CACHE_KEY) || '{}'); } catch { /* 忽略損壞快取 */ }

        for (const sym of symbols) {
            setAnalysisProgress({ done, total });
            const symTrades = filteredTrades.filter(t => t.symbol === sym);
            const completedMinDate = symTrades.reduce((m, t) => t.buyDate < m ? t.buyDate : m, symTrades[0].buyDate);
            const completedMaxDate = symTrades.reduce((m, t) => t.sellDate > m ? t.sellDate : m, symTrades[0].sellDate);
            // 抓取範圍延伸涵蓋該標的「全部交易」日期（不只完整交易），讓這份快取也能滿足 DSS 回測分析（涵蓋未平倉/後續加碼）所需範圍
            const allSymDates = stockTransactions.filter(t => t.symbol === sym).map(t => t.date);
            const minDate = allSymDates.reduce((m, d) => d < m ? d : m, completedMinDate);
            const maxDate = allSymDates.reduce((m, d) => d > m ? d : m, completedMaxDate);
            const cacheKey = `${sym}|${minDate}|${maxDate}|${WINDOW_DAYS}`;
            const cached = rawCache[cacheKey];

            if (cached) {
                klineCache.set(sym, cached.kline);
                instCache.set(sym, cached.inst);
                marginCache.set(sym, cached.margin);
                done++;
                continue;
            }

            const full = await fetchKlineWindow(sym, minDate, MIN_HISTORY_BUFFER_DAYS - 35, daysBetween2(minDate, maxDate) + WINDOW_DAYS + 5);
            if (full) klineCache.set(sym, full);

            const rangeStart = new Date(minDate); rangeStart.setDate(rangeStart.getDate() - MIN_HISTORY_BUFFER_DAYS);
            const rangeEnd = new Date(maxDate); rangeEnd.setDate(rangeEnd.getDate() + WINDOW_DAYS + 10);
            const rangeStartStr = rangeStart.toISOString().slice(0, 10);
            const rangeEndStr = rangeEnd.toISOString().slice(0, 10);
            const [instRows, marginRows] = await Promise.all([
                fetchHistoricalInstForBacktest(sym, rangeStartStr, rangeEndStr),
                fetchHistoricalMarginForBacktest(sym, rangeStartStr, rangeEndStr),
            ]);
            if (instRows) instCache.set(sym, instRows);
            if (marginRows) marginCache.set(sym, marginRows);

            rawCache[cacheKey] = { kline: full ?? [], inst: instRows ?? [], margin: marginRows ?? [] };
            done++;
        }
        setAnalysisProgress({ done: total, total });
        try { localStorage.setItem(RAW_CACHE_KEY, JSON.stringify(rawCache)); } catch { /* 空間不足則不快取原始資料 */ }

        const optResults: WindowResult[] = [];
        const extResults: ExitWindowResult[] = [];
        for (const trade of filteredTrades) {
            const kline = klineCache.get(trade.symbol);
            if (!kline) continue;
            const instRows = instCache.get(trade.symbol) ?? [];
            const marginRows = marginCache.get(trade.symbol) ?? [];
            const sizeCategory = trade.category === 'ETF' ? 'ETF' : trade.category === '上櫃' ? 'SMALL_CAP' : 'LARGE_CAP';

            // 進場：買入日 ±WINDOW_DAYS 個交易日內找報酬最大化（等同最低價）的一天
            const buyCandidates = sliceAroundDate(kline, trade.buyDate, WINDOW_DAYS);
            if (buyCandidates.length) {
                const withReturns = buyCandidates.map(c => ({ ...c, ret: trade.sellPrice > 0 ? ((trade.sellPrice - c.close) / c.close) * 100 : -Infinity }));
                const best = withReturns.reduce((m, c) => c.ret > m.ret ? c : m, withReturns[0]);
                const bestReturn = best.ret === -Infinity ? 0 : best.ret;
                const actualBias = computeMultiBias(kline, trade.buyDate);
                const bestBias = computeMultiBias(kline, best.date);
                const actualDss = computeDSSForDate(kline, instRows, marginRows, trade.buyDate, params, sizeCategory);
                const bestDss = computeDSSForDate(kline, instRows, marginRows, best.date, params, sizeCategory);
                const nearBestSamples = computeNearBestSamples(kline, instRows, marginRows, best.date, params, sizeCategory);
                optResults.push({
                    symbol: trade.symbol, name: nameMap.get(trade.symbol), category: trade.category,
                    buyDate: trade.buyDate, sellDate: trade.sellDate, sellPrice: trade.sellPrice,
                    actualBuyPrice: trade.buyPrice, actualReturn: trade.returnPct,
                    actualBias5: actualBias.bias5, actualBias10: actualBias.bias10, actualBias20: actualBias.bias20,
                    bestDate: best.date, bestPrice: best.close, bestReturn,
                    bestBias5: bestBias.bias5, bestBias10: bestBias.bias10, bestBias20: bestBias.bias20,
                    improvement: bestReturn - trade.returnPct, dayOffset: daysBetween2(best.date, trade.buyDate),
                    actualRsi: actualDss?.rsi ?? null, actualSlopeUpDays: actualDss ? slopeConsecUp(actualDss.biasSlopes) : null,
                    actualForeignConsecBuy: actualDss?.foreignConsecBuy ?? null, actualTrustConsecBuy: actualDss?.trustConsecBuy ?? null,
                    actualMarginConsecIncrease: actualDss?.marginConsecIncrease ?? null,
                    bestRsi: bestDss?.rsi ?? null, bestSlopeUpDays: bestDss ? slopeConsecUp(bestDss.biasSlopes) : null,
                    bestForeignConsecBuy: bestDss?.foreignConsecBuy ?? null, bestTrustConsecBuy: bestDss?.trustConsecBuy ?? null,
                    bestMarginConsecIncrease: bestDss?.marginConsecIncrease ?? null,
                    nearBestSamples,
                    buyTxId: trade.buyTxId, sellTxId: trade.sellTxId,
                });
            }

            // 出場：賣出日 ±WINDOW_DAYS 內（不早於買入日）找報酬最大化（等同最高價）的一天
            const sellCandidates = sliceAroundDate(kline, trade.sellDate, WINDOW_DAYS).filter(r => r.date >= trade.buyDate);
            if (sellCandidates.length) {
                const withReturns = sellCandidates.map(c => ({ ...c, ret: trade.buyPrice > 0 ? ((c.close - trade.buyPrice) / trade.buyPrice) * 100 : -Infinity }));
                // 最佳出場日：報酬最大化（獲利交易=停利點；虧損交易=損失最小的停損點，同一套邏輯，差別只在後續依獲利/虧損分流統計）
                const best = withReturns.reduce((m, c) => c.ret > m.ret ? c : m, withReturns[0]);
                const bestReturn = best.ret === -Infinity ? 0 : best.ret;
                // 最差出場日：報酬最小化（僅虧損交易用來刻畫「最危險狀態」特徵＝強制停損）
                const worst = withReturns.reduce((m, c) => c.ret < m.ret ? c : m, withReturns[0]);
                const worstReturn = worst.ret === -Infinity ? 0 : worst.ret;
                const actualBias = computeMultiBias(kline, trade.sellDate);
                const bestBias = computeMultiBias(kline, best.date);
                const worstBias = computeMultiBias(kline, worst.date);
                const actualDss = computeDSSForDate(kline, instRows, marginRows, trade.sellDate, params, sizeCategory);
                const bestDss = computeDSSForDate(kline, instRows, marginRows, best.date, params, sizeCategory);
                const worstDss = computeDSSForDate(kline, instRows, marginRows, worst.date, params, sizeCategory);
                const nearBestSamples = computeNearBestSamples(kline, instRows, marginRows, best.date, params, sizeCategory);
                extResults.push({
                    symbol: trade.symbol, name: nameMap.get(trade.symbol), category: trade.category,
                    buyDate: trade.buyDate, sellDate: trade.sellDate, buyPrice: trade.buyPrice,
                    actualSellPrice: trade.sellPrice, actualReturn: trade.returnPct,
                    isWinner: trade.returnPct > 0,
                    actualBias5: actualBias.bias5, actualBias10: actualBias.bias10, actualBias20: actualBias.bias20,
                    bestDate: best.date, bestPrice: best.close, bestReturn,
                    bestBias5: bestBias.bias5, bestBias10: bestBias.bias10, bestBias20: bestBias.bias20,
                    improvement: bestReturn - trade.returnPct, dayOffset: daysBetween2(best.date, trade.sellDate),
                    actualRsi: actualDss?.rsi ?? null, actualSlopeUpDays: actualDss ? slopeConsecUp(actualDss.biasSlopes) : null,
                    actualForeignConsecBuy: actualDss?.foreignConsecBuy ?? null, actualTrustConsecBuy: actualDss?.trustConsecBuy ?? null,
                    actualMarginConsecIncrease: actualDss?.marginConsecIncrease ?? null,
                    bestRsi: bestDss?.rsi ?? null, bestSlopeUpDays: bestDss ? slopeConsecUp(bestDss.biasSlopes) : null,
                    bestForeignConsecBuy: bestDss?.foreignConsecBuy ?? null, bestTrustConsecBuy: bestDss?.trustConsecBuy ?? null,
                    bestMarginConsecIncrease: bestDss?.marginConsecIncrease ?? null,
                    worstDate: worst.date, worstPrice: worst.close, worstReturn,
                    worstBias5: worstBias.bias5, worstBias10: worstBias.bias10, worstBias20: worstBias.bias20,
                    worstRsi: worstDss?.rsi ?? null, worstSlopeUpDays: worstDss ? slopeConsecUp(worstDss.biasSlopes) : null,
                    worstForeignConsecBuy: worstDss?.foreignConsecBuy ?? null, worstTrustConsecBuy: worstDss?.trustConsecBuy ?? null,
                    worstMarginConsecIncrease: worstDss?.marginConsecIncrease ?? null,
                    nearBestSamples,
                    buyTxId: trade.buyTxId, sellTxId: trade.sellTxId,
                });
            }
        }
        const sortedOpt = optResults.sort((a, b) => b.improvement - a.improvement);
        const sortedExt = extResults.sort((a, b) => b.improvement - a.improvement);
        const ts = Date.now();
        setOptimalResults(sortedOpt);
        setExitResults(sortedExt);
        setAnalysisTs(ts);
        try { localStorage.setItem(OPTIMAL_CACHE_KEY, JSON.stringify({ results: sortedOpt, timestamp: ts, window: WINDOW_DAYS })); } catch { /* 空間不足忽略 */ }
        try { localStorage.setItem(EXIT_CACHE_KEY, JSON.stringify({ results: sortedExt, timestamp: ts, window: WINDOW_DAYS })); } catch { /* 空間不足忽略 */ }
        setAnalysisRunning(false);
        setAnalysisProgress(null);
    };

    /** 匯出全域原始資料快取（K線/籌碼/融資），與分析結果無關，供進場/出場/DSS回測分析三處共用，可帶到其他裝置匯入使用 */
    const handleExportAnalysis = () => {
        let rawCache: Record<string, RawCacheEntry> = {};
        try { rawCache = JSON.parse(localStorage.getItem(RAW_CACHE_KEY) || '{}'); } catch { /* 忽略損壞快取 */ }
        if (Object.keys(rawCache).length === 0) { alert('目前尚無任何原始資料快取可匯出'); return; }
        const payload = { rawCache, exportedAt: Date.now() };
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dsslab_rawcache_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    /** 匯入全域原始資料快取，依 key 合併（匯入項目覆蓋同 key，其餘既有快取保留），避免整包覆蓋清空其他標的的快取 */
    const handleImportAnalysis = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const parsed = JSON.parse(ev.target?.result as string);
                const incoming = parsed.rawCache && typeof parsed.rawCache === 'object' ? parsed.rawCache : parsed;
                if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) throw new Error('invalid');
                let existing: Record<string, RawCacheEntry> = {};
                try { existing = JSON.parse(localStorage.getItem(RAW_CACHE_KEY) || '{}'); } catch { /* 忽略損壞快取 */ }
                const merged = { ...existing, ...incoming };
                localStorage.setItem(RAW_CACHE_KEY, JSON.stringify(merged));
                alert(`已匯入 ${Object.keys(incoming).length} 筆原始資料快取`);
            } catch {
                alert('匯入失敗：檔案格式不正確');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    /** 把進場(最佳進場日)+出場(最佳出場日)的分類中位數合併存成一份 DSS 設定檔 */
    const handleSaveOptimalProfile = () => {
        if (!optimalResults?.length && !exitResults?.length) return;
        const round2 = (v: number | null | undefined): number | undefined => v == null ? undefined : Math.round(v * 100) / 100;
        const cats: DSSProfile['categories'] = {};
        (['ETF', '上市', '上櫃'] as const).forEach(cat => {
            const entryStats = optimalResults?.length ? buildOptimalCatStats(optimalResults, cat) : null;
            const exitStats = exitResults?.length ? buildExitCatStats(exitResults, cat) : null;
            const stopLossStats = exitResults?.length ? buildStopLossCatStats(exitResults, cat) : null;
            if (!entryStats && !exitStats && !stopLossStats) return;
            cats[cat] = {
                rsi: round2(entryStats?.medRsi) ?? 0,
                bias20: round2(entryStats?.medBias20) ?? 0,
                n: entryStats?.n ?? 0,
                slopeUpDays: round2(entryStats?.medSlopeUpDays),
                bias5: round2(entryStats?.medBias5),
                bias10: round2(entryStats?.medBias10),
                foreignConsecBuy: round2(entryStats?.medForeignConsecBuy),
                trustConsecBuy: round2(entryStats?.medTrustConsecBuy),
                marginConsecIncrease: round2(entryStats?.medMarginConsecIncrease),
                strongRsi: round2(entryStats?.medStrongRsi),
                strongBias20: round2(entryStats?.medStrongBias20),
                strongSlopeUpDays: round2(entryStats?.medStrongSlopeUpDays),
                exitRsi: round2(exitStats?.medRsi),
                exitBias5: round2(exitStats?.medBias5),
                exitBias10: round2(exitStats?.medBias10),
                exitBias20: round2(exitStats?.medBias20),
                exitSlopeUpDays: round2(exitStats?.medSlopeUpDays),
                exitForeignConsecBuy: round2(exitStats?.medForeignConsecBuy),
                exitTrustConsecBuy: round2(exitStats?.medTrustConsecBuy),
                exitMarginConsecIncrease: round2(exitStats?.medMarginConsecIncrease),
                exitN: exitStats?.n ?? undefined,
                exitForceRsi: round2(exitStats?.medForceRsi),
                exitForceBias20: round2(exitStats?.medForceBias20),
                exitForceSlopeUpDays: round2(exitStats?.medForceSlopeUpDays),
                stopLossRsi: round2(stopLossStats?.medRsi),
                stopLossBias5: round2(stopLossStats?.medBias5),
                stopLossBias10: round2(stopLossStats?.medBias10),
                stopLossBias20: round2(stopLossStats?.medBias20),
                stopLossSlopeUpDays: round2(stopLossStats?.medSlopeUpDays),
                stopLossForeignConsecBuy: round2(stopLossStats?.medForeignConsecBuy),
                stopLossTrustConsecBuy: round2(stopLossStats?.medTrustConsecBuy),
                stopLossMarginConsecIncrease: round2(stopLossStats?.medMarginConsecIncrease),
                stopLossN: stopLossStats?.n ?? undefined,
                forceStopLossRsi: round2(stopLossStats?.medForceRsi),
                forceStopLossBias20: round2(stopLossStats?.medForceBias20),
                forceStopLossSlopeUpDays: round2(stopLossStats?.medForceSlopeUpDays),
            };
        });
        if (Object.keys(cats).length === 0) return;
        const profile: DSSProfile = {
            id: crypto.randomUUID(),
            name: `優化參數 ${new Date().toLocaleDateString('zh-TW')}`,
            createdAt: Date.now(),
            source: { total: filteredTrades.length, matched: optimalResults?.length ?? exitResults?.length ?? 0 },
            categories: cats,
        };
        const profiles = getDSSProfiles();
        saveDSSProfiles([...profiles, profile]);
        setSavedProfileMsg('已儲存！可至系統設定套用');
        setTimeout(() => setSavedProfileMsg(''), 3000);
    };

    const symbolStats = useMemo(() => {
        const stats = buildSymbolStats(filteredTrades);
        return [...stats].sort((a, b) => {
            let cmp = 0;
            if (sortKey === 'trades')      cmp = a.trades.length - b.trades.length;
            else if (sortKey === 'winRate')    cmp = a.winRate - b.winRate;
            else if (sortKey === 'avgProfit')  cmp = a.avgProfit - b.avgProfit;
            else if (sortKey === 'totalPnL')   cmp = a.totalPnL - b.totalPnL;
            else if (sortKey === 'avgHolding') cmp = a.avgHoldingDays - b.avgHoldingDays;
            return sortAsc ? cmp : -cmp;
        });
    }, [filteredTrades, sortKey, sortAsc]);

    const summary = useMemo(() => {
        if (!filteredTrades.length) return null;
        const wins = filteredTrades.filter(t => t.realizedProfit > 0);
        const totalPnL = filteredTrades.reduce((s, t) => s + t.realizedProfit, 0);
        const avgHolding = filteredTrades.reduce((s, t) => s + t.holdingDays, 0) / filteredTrades.length;
        const avgReturn = filteredTrades.reduce((s, t) => s + t.returnPct, 0) / filteredTrades.length;
        return {
            total: filteredTrades.length,
            winRate: (wins.length / filteredTrades.length) * 100,
            totalPnL,
            avgHolding,
            avgReturn,
        };
    }, [filteredTrades]);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) setSortAsc(p => !p);
        else { setSortKey(key); setSortAsc(false); }
    };

    const SortIcon = ({ k }: { k: SortKey }) => sortKey === k
        ? (sortAsc ? <ChevronUp size={10} /> : <ChevronDown size={10} />)
        : null;

    const catColor = (cat: string) => {
        if (cat === 'ETF') return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
        if (cat === '上櫃') return 'bg-violet-500/20 text-violet-300 border-violet-500/30';
        return 'bg-slate-700/50 text-slate-300 border-slate-600/30';
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg">
                    <FlaskConical size={20} className="text-white" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-white">DSS 實驗室</h1>
                    <p className="text-xs text-slate-400">訊號品質分析 · 以真實交易結果回推最佳參數</p>
                </div>
            </div>

            {/* Section Tabs - 常駐，不受完整交易紀錄多寡影響，DSS 回測分析不需配對交易也能使用 */}
            <div className="flex gap-2 border-b border-slate-800">
                {([
                    { key: 'winrate', label: '標的勝率排行', icon: Trophy },
                    { key: 'optimal', label: '±N日最佳進場分析', icon: Zap },
                    { key: 'exit', label: '出場分析', icon: Target },
                    { key: 'divergence', label: '背離分析', icon: BarChart2 },
                    { key: 'backtest', label: 'DSS 回測分析', icon: History },
                ] as const).map(({ key, label, icon: Icon }) => (
                    <button key={key} onClick={() => setActiveSection(key)}
                        className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${activeSection === key ? 'bg-slate-800/50 text-violet-400 border-b-2 border-violet-400' : 'text-slate-500 hover:text-slate-300'}`}>
                        <Icon size={16} /> {label}
                    </button>
                ))}
            </div>

            {/* 全域數據工具列：分析 + 儲存為設定檔 + 匯出/匯入全域數據，常駐於上方，供進場/出場/DSS回測分析三處共用 */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 flex items-center gap-3 flex-wrap">
                <span className="text-sm text-slate-400">視窗範圍：±{WINDOW_DAYS} 日（進場+出場一起分析）</span>
                <button onClick={handleRunAnalysis} disabled={analysisRunning}
                    className="px-4 py-1.5 rounded-lg text-sm font-bold bg-violet-600 hover:bg-violet-500 text-white border border-violet-500 disabled:opacity-50 flex items-center gap-2 transition-all">
                    {analysisRunning ? <><Loader2 size={14} className="animate-spin" />分析中…</> : '開始分析'}
                </button>
                {analysisProgress && <span className="text-xs text-slate-400">{analysisProgress.done}/{analysisProgress.total} 標的</span>}
                {analysisTs && !analysisRunning && <span className="text-xs text-slate-500">上次分析：{new Date(analysisTs).toLocaleString('zh-TW', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' })}</span>}
                <div className="ml-auto flex items-center gap-2">
                    {savedProfileMsg && <span className="text-xs text-emerald-400">{savedProfileMsg}</span>}
                    {(optimalResults?.length || exitResults?.length) ? (
                        <button onClick={handleSaveOptimalProfile}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/30 text-violet-300 rounded-lg transition-colors">
                            <Save size={12} />儲存為設定檔
                        </button>
                    ) : null}
                    <button onClick={handleExportAnalysis}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded-lg transition-colors">
                        <Download size={12} />匯出全域數據
                    </button>
                    <label className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded-lg transition-colors cursor-pointer">
                        <Upload size={12} />匯入全域數據
                        <input type="file" accept="application/json" className="hidden" onChange={handleImportAnalysis} />
                    </label>
                </div>
            </div>

            {activeSection === 'backtest' ? (
                <BacktestView allTransactions={stockTransactions} filteredTransactions={stockTransactions} />
            ) : allCompleted.length === 0 ? (
                <div className="text-center py-20 text-slate-500">
                    <FlaskConical size={40} className="mx-auto mb-3 opacity-30" />
                    <p>尚無完整交易紀錄（需有買入對應的賣出資料）</p>
                </div>
            ) : (
                <>
                    {/* Category Filter */}
                    <div className="flex items-center gap-2">
                        {(['ALL', 'ETF', '上市', '上櫃'] as CategoryFilter[]).map(cat => (
                            <button key={cat} onClick={() => setCategoryFilter(cat)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${categoryFilter === cat ? 'bg-violet-600/30 text-violet-300 border-violet-500/50' : 'text-slate-400 border-slate-700 hover:text-white hover:border-slate-600'}`}>
                                {cat === 'ALL' ? '全部' : cat}
                            </button>
                        ))}
                        <span className="ml-auto text-xs text-slate-500">{filteredTrades.length} 筆完整交易</span>
                    </div>

                    {/* Summary Cards */}
                    {summary && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <StatCard label="整體勝率" value={`${summary.winRate.toFixed(1)}%`}
                                sub={`${filteredTrades.filter(t => t.realizedProfit > 0).length} 勝 / ${filteredTrades.filter(t => t.realizedProfit <= 0).length} 敗`}
                                color={summary.winRate >= 50 ? 'text-red-400' : 'text-emerald-400'} />
                            <StatCard label="累計損益" value={`${summary.totalPnL >= 0 ? '+' : ''}${summary.totalPnL.toLocaleString()}`}
                                color={summary.totalPnL >= 0 ? 'text-red-400' : 'text-emerald-400'} />
                            <StatCard label="平均報酬率" value={`${summary.avgReturn >= 0 ? '+' : ''}${summary.avgReturn.toFixed(2)}%`}
                                color={summary.avgReturn >= 0 ? 'text-red-400' : 'text-emerald-400'} />
                            <StatCard label="平均持倉天數" value={`${summary.avgHolding.toFixed(1)} 天`} color="text-slate-200" />
                        </div>
                    )}

                    {/* Symbol Stats Table */}
                    {activeSection === 'winrate' && (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-slate-700 flex items-center gap-2">
                            <Trophy size={16} className="text-amber-400" />
                            <h3 className="text-sm font-bold text-slate-200">標的勝率排行</h3>
                            <span className="text-xs text-slate-500 ml-1">（點擊展開明細）</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="sticky top-0 bg-slate-900 z-10">
                                    <tr className="text-xs text-slate-400 uppercase">
                                        <th className="p-3 font-medium">標的</th>
                                        <th className="p-3 font-medium text-center cursor-pointer select-none hover:text-white" onClick={() => toggleSort('trades')}>
                                            <span className="flex items-center justify-center gap-1">交易數 <SortIcon k="trades" /></span>
                                        </th>
                                        <th className="p-3 font-medium text-center cursor-pointer select-none hover:text-white" onClick={() => toggleSort('winRate')}>
                                            <span className="flex items-center justify-center gap-1">勝率 <SortIcon k="winRate" /></span>
                                        </th>
                                        <th className="p-3 font-medium text-right cursor-pointer select-none hover:text-white" onClick={() => toggleSort('avgProfit')}>
                                            <span className="flex items-center justify-end gap-1">平均損益 <SortIcon k="avgProfit" /></span>
                                        </th>
                                        <th className="p-3 font-medium text-right cursor-pointer select-none hover:text-white" onClick={() => toggleSort('totalPnL')}>
                                            <span className="flex items-center justify-end gap-1">累計損益 <SortIcon k="totalPnL" /></span>
                                        </th>
                                        <th className="p-3 font-medium text-center cursor-pointer select-none hover:text-white" onClick={() => toggleSort('avgHolding')}>
                                            <span className="flex items-center justify-center gap-1">平均持倉 <SortIcon k="avgHolding" /></span>
                                        </th>
                                        <th className="p-3 font-medium text-right">最大獲利 / 最大虧損</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {symbolStats.map(s => (
                                        <React.Fragment key={s.symbol}>
                                            <tr className="border-t border-slate-700/50 hover:bg-slate-700/20 cursor-pointer transition-colors"
                                                onClick={() => setExpandedSymbol(expandedSymbol === s.symbol ? null : s.symbol)}>
                                                <td className="p-3">
                                                    <div className="flex items-center gap-2">
                                                        <div>
                                                            {(nameMap.get(s.symbol) ?? s.name) && <div className="font-bold text-white text-sm">{nameMap.get(s.symbol) ?? s.name}</div>}
                                                            <div className={`font-mono ${(nameMap.get(s.symbol) ?? s.name) ? 'text-xs text-slate-500' : 'font-bold text-white text-sm'}`}>{s.symbol}</div>
                                                        </div>
                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${catColor(s.category)}`}>{s.category}</span>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span className="text-white font-bold">{s.trades.length}</span>
                                                    <span className="text-xs text-slate-500 ml-1">筆</span>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <div className={`font-bold text-sm ${s.winRate >= 60 ? 'text-red-400' : s.winRate >= 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                        {s.winRate.toFixed(0)}%
                                                    </div>
                                                    <div className="text-[10px] text-slate-500">{s.wins}W / {s.losses}L</div>
                                                </td>
                                                <td className="p-3 text-right">
                                                    <span className={`font-mono text-sm font-bold ${s.avgProfit >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                        {s.avgProfit >= 0 ? '+' : ''}{s.avgProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                    </span>
                                                    <div className="text-[10px] text-slate-500">{s.avgReturn >= 0 ? '+' : ''}{s.avgReturn.toFixed(2)}%</div>
                                                </td>
                                                <td className="p-3 text-right">
                                                    <span className={`font-mono text-sm font-bold ${s.totalPnL >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                        {s.totalPnL >= 0 ? '+' : ''}{s.totalPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-center text-slate-300 text-sm">
                                                    {s.avgHoldingDays.toFixed(1)} 天
                                                </td>
                                                <td className="p-3 text-right text-xs">
                                                    {s.maxProfit > 0 && <div className="text-red-400">+{s.maxProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>}
                                                    {s.maxLoss < 0 && <div className="text-emerald-400">{s.maxLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>}
                                                </td>
                                            </tr>
                                            {expandedSymbol === s.symbol && (
                                                <tr className="bg-slate-900/60">
                                                    <td colSpan={7} className="px-6 py-3">
                                                        <div className="text-xs text-slate-400 mb-2 font-semibold">交易明細</div>
                                                        <div className="space-y-1">
                                                            {s.trades.sort((a, b) => b.sellDate.localeCompare(a.sellDate)).map((t, i) => (
                                                                <div key={i} className="flex items-center gap-4 text-xs">
                                                                    <span className="text-slate-500 w-20">{t.buyDate}</span>
                                                                    <span className="text-slate-500">→</span>
                                                                    <span className="text-slate-500 w-20">{t.sellDate}</span>
                                                                    <span className="text-slate-400 w-10 text-right">{t.holdingDays}天</span>
                                                                    <span className="text-slate-400">買 {t.buyPrice} → 賣 {t.sellPrice}</span>
                                                                    <span className={`ml-auto font-mono font-bold ${t.realizedProfit >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                                        {t.realizedProfit >= 0 ? '+' : ''}{t.realizedProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                                    </span>
                                                                    <span className={`w-14 text-right ${t.returnPct >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                                        {t.returnPct >= 0 ? '+' : ''}{t.returnPct.toFixed(2)}%
                                                                    </span>
                                                                    <span className={`w-6 text-center ${t.realizedProfit >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                                        {t.realizedProfit >= 0 ? '✓' : '✗'}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    )}

                    {activeSection === 'optimal' && <OptimalEntrySection results={optimalResults} />}
                    {activeSection === 'exit' && <ExitAnalysisSection results={exitResults} />}
                    {activeSection === 'divergence' && <DivergenceAnalysisSection completedTrades={allCompleted} optimalResults={optimalResults} exitResults={exitResults} />}
                </>
            )}
        </div>
    );
};
