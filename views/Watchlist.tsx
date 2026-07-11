import React, { useState, useEffect, useRef } from 'react';
import { Eye, Plus, X, Search, RefreshCw, Loader2, LineChart, Trash2, Target, ShieldAlert, Clock, TrendingUp, WifiOff } from 'lucide-react';
import { MarketRegimeBadge } from '../components/MarketRegimeBadge';
import { WatchlistGroup, MarketRegime } from '../types';
import * as storage from '../services/storage';
import { getAutoTechUpdateEnabled, setAutoTechUpdateEnabled } from '../services/storage';
import { fetchTechnicalData, fetchMarketRegime, loadStockInfoMap, fetchTWSEBatch } from '../services/stock';
import { TECH_SIGNAL_BADGE_CLASS, brewingBadgeClass, conditionChipClass, chipHintBadgeClass, THRESHOLD_BUY_HIT_BG, THRESHOLD_SELL_HIT_BG, THRESHOLD_BUY_HIT_TEXT, THRESHOLD_SELL_HIT_TEXT, CONSEC_BUY_BG, CONSEC_SELL_BG, CONSEC_BUY_TEXT, CONSEC_SELL_TEXT } from '../services/signalColors';
import { Button } from '../components/ui';
import twStocks from '../src/data/tw_stocks.json';

// --- Module Level Cache (Preserves data across tab switching) ---
let globalTechDataCache: Record<string, any> = {};
let globalLastUpdatedCache: number | null = null;

interface WatchlistProps {
    isActiveView?: boolean;
}

export const Watchlist: React.FC<WatchlistProps> = ({ isActiveView = true }) => {
    const [groups, setGroups] = useState<WatchlistGroup[]>(storage.getWatchlists());
    const [activeGroupId, setActiveGroupId] = useState<string>(groups[0]?.id || '');
    const [isAddingGroup, setIsAddingGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newSymbol, setNewSymbol] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    // Store fetched technical data (Initialize from global cache)
    const [techDataMap, setTechDataMap] = useState<Record<string, any>>(globalTechDataCache);
    const [lastUpdated, setLastUpdated] = useState<number | null>(globalLastUpdatedCache);
    const [marketRegime, setMarketRegime] = useState<MarketRegime | null>(null);
    const [taiexInfo, setTaiexInfo] = useState<{ lastClose: number, dailyChange: number, changeAmount: number } | null>(null);
    const [analyzeProgress, setAnalyzeProgress] = useState<{ current: number, total: number, symbol: string } | null>(null);
    const [autoUpdateEnabled, setAutoUpdateEnabledState] = useState(getAutoTechUpdateEnabled());
    const [flashState, setFlashState] = useState<Record<string, string>>({});
    const [priceSource, setPriceSource] = useState<'TWSE' | 'TWSE_FAILED'>('TWSE');
    const priceRetryRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Sync state to global cache
    useEffect(() => {
        globalTechDataCache = techDataMap;
        globalLastUpdatedCache = lastUpdated;
    }, [techDataMap, lastUpdated]);

    // 離開頁面時清除重試計時器
    useEffect(() => {
        return () => {
            if (priceRetryRef.current) {
                clearInterval(priceRetryRef.current);
                priceRetryRef.current = null;
            }
        };
    }, []);

    const activeGroup = groups.find(g => g.id === activeGroupId);

    // Save groups whenever they change
    useEffect(() => {
        storage.saveWatchlists(groups);
    }, [groups]);
    useEffect(() => {
        if (localStorage.getItem('needs_rescan_watchlist') === 'true') {
            localStorage.removeItem('needs_rescan_watchlist');
            if (activeGroup && activeGroup.symbols.length > 0) {
                setTimeout(() => refreshData(true), 100);
            }
        }
    }, [activeGroup]);

    // Fetch data for all groups (deduplicated)
    const refreshData = async (force: boolean = false) => {
        const allSymbols = [...new Set(groups.flatMap(g => g.symbols))];
        if (allSymbols.length === 0) return;

        // Find which symbols actually need fetching (skip if already cached unless forced)
        const symbolsToFetch = force
            ? allSymbols
            : allSymbols.filter(sym => !techDataMap[sym]);
            
        if (symbolsToFetch.length === 0) return;

        setIsLoading(true);
        const newMap = { ...techDataMap };
        
        const mRegimeData = await fetchMarketRegime();
        const regime = mRegimeData.regime;
        setMarketRegime(regime);
        setTaiexInfo({ lastClose: mRegimeData.lastClose, dailyChange: mRegimeData.dailyChange, changeAmount: mRegimeData.changeAmount });

        // 確保上市/上櫃分類表已就緒
        await loadStockInfoMap();

        // ── 批次抓即時現價（一次 CF 呼叫）──
        const batchResult = await fetchTWSEBatch(symbolsToFetch);
        if (batchResult.source === 'TWSE_FAILED') {
            setPriceSource('TWSE_FAILED');
            window.dispatchEvent(new CustomEvent('api-status-change', { detail: { api: 'twse', status: 'offline' } }));
            // 啟動背景重試（每 10 秒），只更新現價不重跑全部分析
            if (!priceRetryRef.current) {
                priceRetryRef.current = setInterval(async () => {
                    const allSymbols = [...new Set(groups.flatMap(g => g.symbols))];
                    const retry = await fetchTWSEBatch(allSymbols);
                    if (retry.source === 'TWSE') {
                        setPriceSource('TWSE');
                        window.dispatchEvent(new CustomEvent('api-status-change', { detail: { api: 'twse', status: 'online' } }));
                        setTechDataMap(prev => {
                            const updated = { ...prev };
                            for (const sym of allSymbols) {
                                if (updated[sym] && retry.prices[sym]) {
                                    updated[sym] = {
                                        ...updated[sym],
                                        currentPrice: retry.prices[sym].price,
                                        dailyChangeRatio: retry.prices[sym].changePercent,
                                    };
                                }
                            }
                            return updated;
                        });
                        clearInterval(priceRetryRef.current!);
                        priceRetryRef.current = null;
                    }
                }, 10_000);
            }
        } else {
            setPriceSource('TWSE');
            if (priceRetryRef.current) {
                clearInterval(priceRetryRef.current);
                priceRetryRef.current = null;
            }
        }


        
        let completed = 0;
        setAnalyzeProgress({ current: 0, total: symbolsToFetch.length, symbol: symbolsToFetch[0] });

        // Chunking array into smaller sizes to avoid rate limiting
        const chunkArray = <T,>(arr: T[], size: number): T[][] => 
            Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));

        // Pre-warm market regime cache before parallel execution to prevent duplicate TWII requests
        await fetchMarketRegime(true);
        // 每批降為 3 檔，搭配 1.7 秒間隔，貼近 TWSE「5 秒 3 次請求」限制，避免被限流回傳 520
        const chunks = chunkArray(symbolsToFetch, 3);
        for (const chunk of chunks) {
            await Promise.all(chunk.map(async (symbol, idxInChunk) => {
                // 批內錯開請求時間，進一步降低瞬間併發
                await new Promise(r => setTimeout(r, idxInChunk * 600));
                try {
                    const data = await fetchTechnicalData(symbol, [], [], batchResult.prices[symbol] ?? null);
                    if (data) {
                        const oldData = techDataMap[symbol];
                        if (oldData) {
                            if (oldData.currentPrice !== data.currentPrice) {
                                const type = data.currentPrice! > oldData.currentPrice! ? 'up' : 'down';
                                data.priceChangeSinceLastTick = data.currentPrice! - oldData.currentPrice!;
                                setFlashState(prev => ({ ...prev, [symbol]: type }));
                                setTimeout(() => {
                                    setFlashState(prev => {
                                        const next = { ...prev };
                                        delete next[symbol];
                                        return next;
                                    });
                                }, 1500);
                            } else {
                                // Preserve the previous tick change if price hasn't moved
                                data.priceChangeSinceLastTick = oldData.priceChangeSinceLastTick;
                                if (JSON.stringify(oldData) !== JSON.stringify(data)) {
                                    setFlashState(prev => ({ ...prev, [symbol]: 'neutral' }));
                                    setTimeout(() => {
                                        setFlashState(prev => {
                                            const next = { ...prev };
                                            delete next[symbol];
                                            return next;
                                        });
                                    }, 1500);
                                }
                            }
                        }
                        newMap[symbol] = data;
                    } else {
                        newMap[symbol] = { error: true }; // Cache the failure so it doesn't spin forever
                    }
                } catch (e) {
                    console.error(`Failed to fetch data for ${symbol}`, e);
                    newMap[symbol] = { error: true };
                } finally {
                    completed++;
                    setAnalyzeProgress({ current: completed, total: symbolsToFetch.length, symbol: symbol });
                }
            }));
            // 批與批之間額外間隔，確保不會在批次交界處瞬間連續發送
            await new Promise(r => setTimeout(r, 1500));
        }

        setTechDataMap(newMap);
        setLastUpdated(Date.now());
        if (force) {
            localStorage.setItem('last_watchlist_update_time', Date.now().toString());
        }
        setIsLoading(false);
        setAnalyzeProgress(null);
    };

    // Removed auto-fetch on tab switch per user request

    const refreshDataRef = React.useRef(refreshData);
    useEffect(() => {
        refreshDataRef.current = refreshData;
    });

    // 同步 Investments 頁面的開關狀態
    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key === 'auto_tech_update_enabled') {
                setAutoUpdateEnabledState(e.newValue === 'true');
            }
            if (e.key === 'needs_rescan_watchlist' && e.newValue === 'true') {
                localStorage.removeItem('needs_rescan_watchlist');
                setTimeout(() => refreshDataRef.current(true), 100);
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    useEffect(() => {
        if (!autoUpdateEnabled) return;
        const interval = setInterval(() => {
            if (!isActiveView) return; // 非當前頁面時，讓 Investments 頁負責更新
            const lastUpdate = localStorage.getItem('last_watchlist_update_time') || '0';
            if (Date.now() - parseInt(lastUpdate) >= 5 * 60 * 1000) {
                if (document.visibilityState === 'visible' && !isLoading) {
                    refreshDataRef.current(true);
                }
            }
        }, 15000);
        return () => clearInterval(interval);
    }, [autoUpdateEnabled, isLoading, isActiveView]);

    const handleAddGroup = () => {
        if (!newGroupName.trim()) return;
        const newGroup: WatchlistGroup = {
            id: crypto.randomUUID(),
            name: newGroupName.trim(),
            symbols: []
        };
        const updatedGroups = [...groups, newGroup];
        setGroups(updatedGroups);
        setActiveGroupId(newGroup.id);
        setNewGroupName('');
        setIsAddingGroup(false);
    };

    const handleDeleteGroup = (id: string) => {
        if (groups.length <= 1) {
            alert('至少需保留一個觀察名單');
            return;
        }
        if (!window.confirm('確定要刪除此觀察名單嗎？')) return;
        const updatedGroups = groups.filter(g => g.id !== id);
        setGroups(updatedGroups);
        if (activeGroupId === id) {
            setActiveGroupId(updatedGroups[0].id);
        }
    };

    const handleAddSymbol = async () => {
        if (!newSymbol.trim() || !activeGroup) return;
        const symbol = newSymbol.trim().toUpperCase();
        if (!/^\d{4,6}[A-Z]?$/.test(symbol)) {
            alert(`「${newSymbol.trim()}」不是合法的股票代號格式（需為 4-6 碼數字，可選字母後綴，例如 2330、00631L）`);
            return;
        }
        if (activeGroup.symbols.includes(symbol)) {
            setNewSymbol('');
            return;
        }

        const updatedGroups = groups.map(g => {
            if (g.id === activeGroupId) {
                return { ...g, symbols: [...g.symbols, symbol] };
            }
            return g;
        });
        setGroups(updatedGroups);
        setNewSymbol('');
        
        // Fetch data immediately for the new symbol
        setIsLoading(true);
        const data = await fetchTechnicalData(symbol);
        if (data) {
            setTechDataMap(prev => ({ ...prev, [symbol]: data }));
            setLastUpdated(Date.now());
        }
        setIsLoading(false);
    };

    const handleDeleteSymbol = (symbolToRemove: string) => {
        const updatedGroups = groups.map(g => {
            if (g.id === activeGroupId) {
                return { ...g, symbols: g.symbols.filter(s => s !== symbolToRemove) };
            }
            return g;
        });
        setGroups(updatedGroups);
    };

    const renderTechRow = (symbol: string) => {
        const data = techDataMap[symbol];
        const stockName = (twStocks as Record<string, string>)[symbol] || '';

        if (!data) {
            return (
                <tr key={symbol} className="border-b border-slate-800 last:border-b-0 hover:bg-slate-800 transition-colors">
                    <td className="p-3">
                        <p className="font-bold text-white">{symbol} <span className="text-slate-400 text-xs font-normal">{stockName}</span></p>
                    </td>
                    <td className="p-3 text-center" colSpan={10}>
                        <span className="text-slate-500 text-sm flex items-center justify-center gap-2">
                            {isLoading ? <><Loader2 size={14} className="animate-spin"/> 載入中...</> : '等候更新'}
                        </span>
                    </td>
                    <td className="p-3 text-center">
                        <button onClick={() => handleDeleteSymbol(symbol)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                            <Trash2 size={16} />
                        </button>
                    </td>
                </tr>
            );
        }

        if (data.error) {
            return (
                <tr key={symbol} className="border-b border-slate-800 last:border-b-0 hover:bg-red-900/20 transition-colors">
                    <td className="p-3">
                        <p className="font-bold text-white">{symbol} <span className="text-slate-400 text-xs font-normal">{stockName}</span></p>
                    </td>
                    <td className="p-3 text-center" colSpan={10}>
                        <span className="text-red-400 text-sm flex items-center justify-center gap-2">
                            抓取失敗 (代號錯誤或無資料)
                        </span>
                    </td>
                    <td className="p-3 text-center">
                        <button onClick={() => handleDeleteSymbol(symbol)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                            <Trash2 size={16} />
                        </button>
                    </td>
                </tr>
            );
        }

        const techParams = storage.getTechParameters();
        const bias20 = data.ma20 && data.currentPrice ? ((data.currentPrice - data.ma20) / data.ma20) * 100 : null;
        
        let consecutivePositiveSlopes = 0;
        let consecutiveNegativeSlopes = 0;
        if (data.biasSlopes) {
            for (let i = 0; i < data.biasSlopes.length; i++) {
                if (data.biasSlopes[i] !== undefined && data.biasSlopes[i] > 0) {
                    consecutivePositiveSlopes++;
                } else {
                    break;
                }
            }
            for (let i = 0; i < data.biasSlopes.length; i++) {
                if (data.biasSlopes[i] !== undefined && data.biasSlopes[i] < 0) {
                    consecutiveNegativeSlopes++;
                } else {
                    break;
                }
            }
        }

        let buyBiasThreshold = techParams.largeCapBuyBias;
        let rsiThreshold = techParams.largeCapBuyRsi;
        let slopeDaysThreshold = techParams.largeCapBuySlopeDays;
        let partialSellThreshold = techParams.largeCapPartialSellBias;
        let partialSellSlopeDaysThreshold = techParams.largeCapPartialSellSlopeDays;
        let stopLossThreshold = techParams.largeCapStopLossBias;

        if (data.sizeCategory === 'ETF') {
            buyBiasThreshold = techParams.etfBuyBias;
            rsiThreshold = techParams.etfBuyRsi;
            slopeDaysThreshold = techParams.etfBuySlopeDays;
            partialSellThreshold = techParams.etfPartialSellBias;
            partialSellSlopeDaysThreshold = techParams.etfPartialSellSlopeDays;
            stopLossThreshold = -999;
        } else if (data.sizeCategory === 'SMALL_CAP') {
            buyBiasThreshold = techParams.smallCapBuyBias;
            rsiThreshold = techParams.smallCapBuyRsi;
            slopeDaysThreshold = techParams.smallCapBuySlopeDays;
            partialSellThreshold = techParams.smallCapPartialSellBias;
            partialSellSlopeDaysThreshold = techParams.smallCapPartialSellSlopeDays;
            stopLossThreshold = techParams.smallCapStopLossBias;
        }

        let biasHighlightClass = '';
        let biasSubtext = null;
        if (stopLossThreshold !== -999 && bias20 !== null && bias20 <= stopLossThreshold) {
            biasHighlightClass = THRESHOLD_SELL_HIT_BG;
            biasSubtext = <div className={`text-[10px] ${THRESHOLD_SELL_HIT_TEXT} mt-0.5 leading-tight`}>達停損門檻 <span className="scale-90 inline-block">(&lt;={stopLossThreshold}%)</span></div>;
        } else if (bias20 !== null && bias20 <= buyBiasThreshold) {
            biasHighlightClass = THRESHOLD_BUY_HIT_BG;
            biasSubtext = <div className={`text-[10px] ${THRESHOLD_BUY_HIT_TEXT} mt-0.5 leading-tight`}>達買進門檻 <span className="scale-90 inline-block">(&lt;={buyBiasThreshold}%)</span></div>;
        } else if (bias20 !== null && bias20 >= partialSellThreshold) {
            biasHighlightClass = THRESHOLD_SELL_HIT_BG;
            biasSubtext = <div className={`text-[10px] ${THRESHOLD_SELL_HIT_TEXT} mt-0.5 leading-tight`}>過熱勿追 <span className="scale-90 inline-block">(&gt;={partialSellThreshold}%)</span></div>;
        }

        let slopeHighlightClass = '';
        let slopeSubtext = null;
        if (consecutivePositiveSlopes >= slopeDaysThreshold) {
            slopeHighlightClass = THRESHOLD_BUY_HIT_BG;
            slopeSubtext = <div className={`text-[10px] ${THRESHOLD_BUY_HIT_TEXT} mt-0.5 leading-tight`}>達買進門檻 <span className="scale-90 inline-block">(連{slopeDaysThreshold}增)</span></div>;
        } else if (consecutiveNegativeSlopes >= partialSellSlopeDaysThreshold) {
            slopeHighlightClass = THRESHOLD_SELL_HIT_BG;
            slopeSubtext = <div className={`text-[10px] ${THRESHOLD_SELL_HIT_TEXT} mt-0.5 leading-tight`}>過熱勿追 <span className="scale-90 inline-block">(連{partialSellSlopeDaysThreshold}跌)</span></div>;
        }

        let rsiHighlightClass = '';
        let rsiSubtext = null;
        if (data.rsi !== undefined && data.rsi !== null && data.rsi <= rsiThreshold) {
            rsiHighlightClass = THRESHOLD_BUY_HIT_BG;
            rsiSubtext = <div className={`text-[10px] ${THRESHOLD_BUY_HIT_TEXT} mt-0.5 leading-tight`}>達買進門檻 <span className="scale-90 inline-block">(&lt;={rsiThreshold})</span></div>;
        }

        const targetBuyPrice = data.ma20 ? (data.ma20 * (1 + buyBiasThreshold / 100)).toFixed(2) : '-';
        const targetSellPrice = data.ma20 ? (data.ma20 * (1 + partialSellThreshold / 100)).toFixed(2) : '-';
        const targetStopPrice = data.ma20 && stopLossThreshold !== -999 ? (data.ma20 * (1 + stopLossThreshold / 100)).toFixed(2) : '-';

        const renderConditionChips = (hint: typeof data.signalHint) => {
            if (!hint?.conditions?.length) return null;
            return (
                <div className="flex items-center justify-center gap-1 flex-wrap mt-1 max-w-[180px]">
                    {hint.conditions.map((c: any, i: number) => (
                        <span key={i} className={`text-xs px-1.5 py-0.5 rounded border ${conditionChipClass(hint.type, c.satisfied)}`}>
                            {c.label}
                        </span>
                    ))}
                </div>
            );
        };

        const withChips = (badge: React.ReactNode) => (
            <div className="flex flex-col items-center gap-1">
                {badge}
                {renderConditionChips(data.signalHint)}
            </div>
        );

        const renderTechBadge = (signal: string) => {
            const isBrewingState = signal === 'NONE' || signal === 'RISK_ALERT';
            if (isBrewingState) {
                if (!data.signalHint) return <span className="text-slate-500 text-xs">無訊號觀察中</span>;
                const hint = data.signalHint;
                const target = hint.target;
                return (
                    <div className="flex flex-col items-center gap-1">
                        {target && <span className={`px-2 py-0.5 rounded text-xs font-bold border ${brewingBadgeClass(hint.type)}`}>{target}</span>}
                        {renderConditionChips(hint)}
                    </div>
                );
            }
            switch (signal) {
                case 'STRONG_BUY': return withChips(<span className={`${TECH_SIGNAL_BADGE_CLASS.STRONG_BUY} px-2 py-1 rounded text-xs font-bold`}>🚀 強力進場 (&lt;={targetBuyPrice})</span>);
                case 'BUY': return withChips(<span className={`${TECH_SIGNAL_BADGE_CLASS.BUY} px-2 py-1 rounded text-xs font-bold`}>🔴 進場訊號 (&lt;={targetBuyPrice})</span>);
                case 'STRONG_LAYOUT': return withChips(<span className={`${TECH_SIGNAL_BADGE_CLASS.STRONG_LAYOUT} px-2 py-1 rounded text-xs font-bold`}>🚀 強力布局（籌碼共振）</span>);
                case 'FINAL_ADD': return withChips(<span className={`${TECH_SIGNAL_BADGE_CLASS.FINAL_ADD} px-2 py-1 rounded text-xs font-bold`}>🔵🔵 最後進場</span>);
                case 'PARTIAL_SELL': return withChips(<span className={`${TECH_SIGNAL_BADGE_CLASS.PARTIAL_SELL} px-2 py-1 rounded text-xs font-bold`}>🟢 高位過熱 (勿追 &gt;={targetSellPrice})</span>);
                case 'FORCE_SELL': return withChips(<span className={`${TECH_SIGNAL_BADGE_CLASS.FORCE_SELL} px-2 py-1 rounded text-xs font-bold`}>🟢 嚴重過熱 (切勿追高)</span>);
                case 'SECOND_PARTIAL_SELL': return withChips(<span className={`${TECH_SIGNAL_BADGE_CLASS.SECOND_PARTIAL_SELL} px-2 py-1 rounded text-xs font-bold`}>🟢 極度過熱 (嚴禁進場)</span>);
                case 'WATCH_DIVERGE': return withChips(<span className={`${TECH_SIGNAL_BADGE_CLASS.WATCH_DIVERGE} px-2 py-1 rounded text-xs font-bold`}>🟢 籌碼疑慮 (暫緩進場)</span>);
                case 'SELL': return withChips(<span className={`${TECH_SIGNAL_BADGE_CLASS.SELL} px-2 py-1 rounded text-xs font-bold`}>⛔ 法人棄守 (避免進場)</span>);
                case 'STOP_LOSS': return withChips(<span className={`${TECH_SIGNAL_BADGE_CLASS.STOP_LOSS} px-2 py-1 rounded text-xs font-bold`}>⚠️ 深度超跌 (&lt;={targetStopPrice})</span>);
                case 'STOP_LOSS_ALERT': return withChips(<span className={`${TECH_SIGNAL_BADGE_CLASS.STOP_LOSS_ALERT} px-2 py-1 rounded text-xs font-bold`}>⚠️ 深度超跌 (&lt;={targetStopPrice})</span>);
                case 'RISK_ALERT': return withChips(<span className={`${TECH_SIGNAL_BADGE_CLASS.PARTIAL_SELL} px-2 py-1 rounded text-xs font-bold`}>🟢 留意支撐</span>);
                case 'NONE': return <span className="text-slate-500 text-xs">無訊號觀察中</span>;
                default: return <span className="text-slate-500 text-xs">無訊號觀察中</span>;
            }
        };

        const renderChipBadge = (_signal: string) => {
            if (!data.chipHint) return <span className="text-slate-500 text-xs">-</span>;
            const hint = data.chipHint;
            const target = hint.target;
            return (
                <div className="flex flex-col items-center gap-1">
                    {target && <span className={`px-2 py-0.5 rounded text-xs font-bold border ${chipHintBadgeClass(target)}`}>{target}</span>}
                    {renderConditionChips(hint)}
                </div>
            );
        };

        const techBadge = renderTechBadge(data.techSignal || '');
        const chipBadge = renderChipBadge(data.techSignal || '');

        const currentSlope = data.biasSlopes && data.biasSlopes[0] !== undefined ? data.biasSlopes[0] : null;
        const slopeColor = currentSlope !== null ? (currentSlope > 0 ? 'text-red-400' : 'text-emerald-400') : 'text-slate-500';

        const categoryLabel = data.sizeCategory === 'LARGE_CAP' ? '上市' : (data.sizeCategory === 'SMALL_CAP' ? '上櫃' : 'ETF');

        const flashType = flashState[symbol];
        const flashClass = flashType === 'up' ? 'flash-row-up' : (flashType === 'down' ? 'flash-row-down' : (flashType === 'neutral' ? 'flash-row-neutral' : ''));

        const dailyChange = data.dailyChange;
        const dailyChangeRatio = data.dailyChangeRatio;

        return (
            <tr key={symbol} className={`border-b border-slate-800 last:border-b-0 hover:bg-slate-800 transition-colors ${flashClass}`}>
                <td className="p-3">
                    <p className="font-bold text-white">{symbol} <span className="text-slate-400 text-xs font-normal">{stockName}</span></p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        {data.sizeCategory === 'LARGE_CAP' && <span className="text-[9px] px-1 bg-indigo-500/20 text-indigo-400 rounded border border-indigo-500/30 font-bold tracking-wider">上市</span>}
                        {data.sizeCategory === 'SMALL_CAP' && <span className="text-[9px] px-1 bg-sky-500/20 text-sky-400 rounded border border-sky-500/30 font-bold tracking-wider">上櫃</span>}
                        {data.sizeCategory === 'ETF' && <span className="text-[9px] px-1 bg-violet-500/20 text-violet-400 rounded border border-violet-500/30 font-bold tracking-wider">ETF</span>}
                    </div>
                </td>
                <td className="p-3 text-right font-mono font-bold text-white">
                    <div className="flex flex-col items-end">
                        <span>{data.currentPrice?.toFixed(2) || '-'}</span>
                        {dailyChange != null && dailyChangeRatio != null && (
                            <span className={`text-[10px] ${dailyChange > 0 ? 'text-red-400' : dailyChange < 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                                {dailyChange > 0 ? '▲' : '▼'} {Math.abs(dailyChange).toFixed(2)} ({dailyChange > 0 ? '+' : ''}{dailyChangeRatio.toFixed(2)}%)
                            </span>
                        )}
                    </div>
                </td>
                <td className="p-3 text-right font-mono text-slate-400">{data.ma20?.toFixed(2) || '-'}</td>
                <td className="p-3 text-right font-mono text-slate-500">{data.ma60?.toFixed(2) || '-'}</td>
                <td className={`p-3 text-right font-mono transition-colors ${biasHighlightClass}`}>
                    {bias20 !== null ? <span className={bias20 > 0 ? 'text-red-400' : 'text-emerald-400'}>{bias20 > 0 ? '+' : ''}{bias20.toFixed(2)}%</span> : '-'}
                    {biasSubtext}
                </td>
                <td className={`p-3 text-right font-mono transition-colors ${slopeHighlightClass}`}>
                    {currentSlope !== null ? (
                        <span className={slopeColor}>{currentSlope > 0 ? '+' : ''}{currentSlope.toFixed(2)} {consecutivePositiveSlopes > 0 ? <span className="text-[10px] ml-1 opacity-80">(連{consecutivePositiveSlopes}增)</span> : ''}</span>
                    ) : '-'}
                    {slopeSubtext}
                </td>
                <td className={`p-3 text-right font-mono text-slate-300 transition-colors ${rsiHighlightClass}`}>
                    {data.rsi?.toFixed(1) || '-'}
                    {rsiSubtext}
                </td>
                <td className={`p-3 text-right font-mono transition-colors ${data.foreignConsecBuy >= 3 ? CONSEC_BUY_BG : data.foreignConsecSell >= 3 ? CONSEC_SELL_BG : ''}`}>
                    {data.institutionalForeign !== undefined && data.institutionalForeign !== null ? (
                        <div>
                            <span className={data.institutionalForeign > 0 ? 'text-red-400' : (data.institutionalForeign < 0 ? 'text-emerald-400' : 'text-slate-500')}>
                                {data.institutionalForeign > 0 ? '+' : ''}{data.institutionalForeign.toLocaleString()}
                            </span>
                            {data.foreignConsecBuy > 0 ? (
                                <div className={`text-[10px] mt-0.5 ${CONSEC_BUY_TEXT(data.foreignConsecBuy >= 3)}`}>連買{data.foreignConsecBuy}日</div>
                            ) : data.foreignConsecSell > 0 ? (
                                <div className={`text-[10px] mt-0.5 ${CONSEC_SELL_TEXT(data.foreignConsecSell >= 3)}`}>連賣{data.foreignConsecSell}日</div>
                            ) : null}
                        </div>
                    ) : '-'}
                </td>
                <td className={`p-3 text-right font-mono transition-colors ${data.trustConsecBuy >= 3 ? CONSEC_BUY_BG : data.trustConsecSell >= 3 ? CONSEC_SELL_BG : ''}`}>
                    {data.institutionalTrust !== undefined && data.institutionalTrust !== null ? (
                        <div>
                            <span className={data.institutionalTrust > 0 ? 'text-red-400' : (data.institutionalTrust < 0 ? 'text-emerald-400' : 'text-slate-500')}>
                                {data.institutionalTrust > 0 ? '+' : ''}{data.institutionalTrust.toLocaleString()}
                            </span>
                            {data.trustConsecBuy > 0 ? (
                                <div className={`text-[10px] mt-0.5 ${CONSEC_BUY_TEXT(data.trustConsecBuy >= 3)}`}>連買{data.trustConsecBuy}日</div>
                            ) : data.trustConsecSell > 0 ? (
                                <div className={`text-[10px] mt-0.5 ${CONSEC_SELL_TEXT(data.trustConsecSell >= 3)}`}>連賣{data.trustConsecSell}日</div>
                            ) : null}
                        </div>
                    ) : '-'}
                </td>
                <td className={`p-3 text-right font-mono transition-colors ${data.marginChangeRatio !== null && data.marginChangeRatio !== undefined && data.marginChangeRatio >= 2 ? CONSEC_BUY_BG : data.marginChange !== null && data.marginChange !== undefined && data.marginChange < 0 ? CONSEC_SELL_BG : ''}`}>
                    {data.marginChange !== undefined && data.marginChange !== null ? (
                        <div>
                            <span className={data.marginChange > 0 ? 'text-red-400' : (data.marginChange < 0 ? 'text-emerald-400' : 'text-slate-500')}>
                                {data.marginChange > 0 ? '+' : ''}{data.marginChange.toLocaleString()}
                            </span>
                            {data.marginChangeRatio !== null && data.marginChangeRatio !== undefined && data.marginChangeRatio >= 2 && (
                                <div className="text-[10px] text-amber-400/80 mt-0.5">融資大增 +{data.marginChangeRatio.toFixed(1)}%</div>
                            )}
                            {data.marginChangeRatio !== null && data.marginChangeRatio !== undefined && data.marginChangeRatio <= -2 && (
                                <div className="text-[10px] text-emerald-400/80 mt-0.5">融資大減 {data.marginChangeRatio.toFixed(1)}%</div>
                            )}
                        </div>
                    ) : '-'}
                </td>

                <td className="p-3 text-center">{techBadge}</td>
                <td className="p-3 text-center">{chipBadge}</td>
                <td className="p-3 text-center">
                    <button onClick={() => handleDeleteSymbol(symbol)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                        <Trash2 size={16} />
                    </button>
                </td>
            </tr>
        );
    };

    return (
        <div className="space-y-6 animate-fade-in p-2 md:p-6 pb-24">
            {priceSource === 'TWSE_FAILED' && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
                    <WifiOff size={15} />
                    <span>即時現價暫時無法取得，目前顯示昨日收盤價，每 10 秒自動重試中...</span>
                </div>
            )}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Eye className="text-sky-400" /> 選股掃描與觀察名單
                        </h2>
                        <MarketRegimeBadge regime={marketRegime} />
                        {taiexInfo && taiexInfo.lastClose > 0 && (
                            <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                                加權指數 <span className="text-slate-200 font-bold">{taiexInfo.lastClose.toFixed(2)}</span>
                                <span className={taiexInfo.changeAmount > 0 ? 'text-red-400' : taiexInfo.changeAmount < 0 ? 'text-emerald-400' : 'text-slate-400'}>
                                    {taiexInfo.changeAmount > 0 ? '▲' : taiexInfo.changeAmount < 0 ? '▼' : ''} {Math.abs(taiexInfo.changeAmount).toFixed(2)} ({taiexInfo.dailyChange > 0 ? '+' : ''}{taiexInfo.dailyChange.toFixed(2)}%)
                                </span>
                            </span>
                        )}
                    </div>
                    <p className="text-slate-400 text-sm mt-1">建立自訂分頁，利用雙引擎自動分析標的強弱勢與買賣點</p>
                </div>
                <div className="flex items-center gap-3">
                    {lastUpdated && (
                        <span className="text-xs text-slate-500 font-mono">最後更新: {new Date(lastUpdated).toLocaleTimeString()}</span>
                    )}
                    <Button 
                        onClick={() => refreshData(true)} 
                        disabled={isLoading} 
                        loading={isLoading} 
                        className="h-8 text-xs bg-sky-500/10 text-sky-300 border-sky-500/20 hover:bg-sky-500/20 transition-all duration-300 ease-in-out min-w-[120px] relative overflow-hidden"
                    >
                        {!isLoading && <TrendingUp size={14}/>}
                        {isLoading && analyzeProgress ? (
                            <span className="flex items-center gap-1 z-10 relative">
                                處理中 {analyzeProgress.symbol} <span className="text-[10px] text-sky-400">({analyzeProgress.current}/{analyzeProgress.total})</span>
                            </span>
                        ) : '分析技術面'}
                        {isLoading && analyzeProgress && (
                            <div 
                                className="absolute left-0 top-0 bottom-0 bg-sky-500/20 transition-all duration-300"
                                style={{ width: `${(analyzeProgress.current / analyzeProgress.total) * 100}%` }}
                            />
                        )}
                    </Button>
                    <Button 
                        onClick={() => {
                            const newState = !autoUpdateEnabled;
                            setAutoUpdateEnabledState(newState);
                            setAutoTechUpdateEnabled(newState);
                        }} 
                        variant="secondary" 
                        className={`h-8 text-xs border transition-all duration-300 ${autoUpdateEnabled ? 'bg-red-500/20 text-red-400 border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-700/50'}`}
                        title="5分鐘自動更新"
                    >
                        <Clock size={14} className={autoUpdateEnabled ? "animate-pulse text-red-400" : ""} />
                        {autoUpdateEnabled ? '自動更新中' : '自動更新'}
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
                {groups.map(g => (
                    <div key={g.id} className="relative group">
                        <button
                            onClick={() => setActiveGroupId(g.id)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                                activeGroupId === g.id 
                                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' 
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
                            }`}
                        >
                            {g.name}
                        </button>
                        {groups.length > 1 && (
                            <button 
                                onClick={() => handleDeleteGroup(g.id)}
                                className="absolute -top-1 -right-1 w-5 h-5 bg-slate-800 rounded-full border border-slate-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20 hover:text-red-400 text-slate-400"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                ))}
                
                {isAddingGroup ? (
                    <div className="flex items-center gap-2 bg-slate-800/50 p-1 rounded-xl border border-slate-700">
                        <input
                            type="text"
                            value={newGroupName}
                            onChange={e => setNewGroupName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddGroup()}
                            placeholder="輸入群組名稱"
                            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white w-32 focus:outline-none focus:border-sky-500"
                            autoFocus
                        />
                        <button onClick={handleAddGroup} className="p-1.5 text-emerald-400 hover:bg-emerald-500/20 rounded-lg"><Plus size={16}/></button>
                        <button onClick={() => setIsAddingGroup(false)} className="p-1.5 text-slate-400 hover:bg-slate-700 rounded-lg"><X size={16}/></button>
                    </div>
                ) : (
                    <button 
                        onClick={() => setIsAddingGroup(true)}
                        className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-xl transition-colors border border-dashed border-slate-700 hover:border-slate-500"
                    >
                        <Plus size={16} /> 新增分類
                    </button>
                )}
            </div>

            {/* Active Group Content */}
            {activeGroup && (
                <div className="space-y-4">
                    {/* Add Symbol Input */}
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1 max-w-sm">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search size={18} className="text-slate-500" />
                            </div>
                            <input
                                type="text"
                                value={newSymbol}
                                onChange={e => setNewSymbol(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddSymbol()}
                                placeholder="輸入股票代號 (例: 2330, 0050)..."
                                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
                            />
                        </div>
                        <button 
                            onClick={handleAddSymbol}
                            disabled={!newSymbol.trim() || isLoading}
                            className="px-6 py-3 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-colors flex items-center gap-2 shadow-lg shadow-sky-500/20"
                        >
                            <Plus size={18} /> 加入清單
                        </button>
                    </div>

                    {/* Table */}
                    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl flex flex-col mt-4 max-h-[75vh]">
                        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/30 rounded-t-2xl shrink-0">
                            <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                                <LineChart size={16} className="text-sky-400" /> {activeGroup.name} 掃描結果
                            </h3>
                            <span className="text-xs text-slate-500">共 {activeGroup.symbols.length} 檔標的</span>
                        </div>
                        <div className="flex-1 overflow-auto"><table className="w-full text-left">
                            <thead className="sticky top-0 bg-slate-900 z-10 shadow-md"><tr className="text-xs text-slate-400 uppercase">
                                <th className="p-3 font-medium w-32">標的</th>
                                <th className="p-3 font-medium text-right">當前價格</th>
                                <th className="p-3 font-medium text-right">月線 (20MA)</th>
                                <th className="p-3 font-medium text-right">季線 (60MA)</th>
                                <th className="p-3 font-medium text-right">月乖離 (BIAS20)</th>
                                <th className="p-3 font-medium text-right">乖離斜率</th>
                                <th className="p-3 font-medium text-right">強弱指標 (RSI)</th>
                                <th className="p-3 font-medium text-right">外資買賣(張)</th>
                                <th className="p-3 font-medium text-right">投信買賣(張)</th>
                                <th className="p-3 font-medium text-right">融資增減(張)</th>
                                <th className="p-3 font-medium text-center">訊號(技術)</th>
                                <th className="p-3 font-medium text-center">訊號(籌碼)</th>
                                <th className="p-3 font-medium text-center w-16">操作</th>
                            </tr></thead>
                            <tbody>
                                {activeGroup.symbols.length > 0 ? (
                                    activeGroup.symbols.map(renderTechRow)
                                ) : (
                                    <tr>
                                        <td colSpan={12} className="text-center py-12 text-slate-500">
                                            <div className="flex flex-col items-center gap-2">
                                                <Target size={32} className="text-slate-600 mb-2" />
                                                <p className="font-bold text-slate-400">目前清單內尚無標的</p>
                                                <p className="text-sm">請在上方的搜尋框輸入股票代號並加入清單</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table></div>
                    </div>
                </div>
            )}
        </div>
    );
};



