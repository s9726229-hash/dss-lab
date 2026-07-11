import React, { useState } from 'react';
import { StockTransaction } from '../../types';
import { ReceiptText, Repeat, Search, X } from 'lucide-react';
import { detectRecurringCandidates } from '../../services/stock';

interface TransactionHistoryListProps {
    transactions: StockTransaction[];
    stockNameMap: Record<string, string>;
    onToggleRecurring?: (id: string) => void;
    onBulkMarkRecurring?: (ids: string[]) => void;
}

export const TransactionHistoryList: React.FC<TransactionHistoryListProps> = ({ transactions, stockNameMap, onToggleRecurring, onBulkMarkRecurring }) => {
    const [candidates, setCandidates] = useState<StockTransaction[] | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searched, setSearched] = useState(false);

    const runDetection = () => {
        const found = detectRecurringCandidates(transactions.filter(t => !t.isRecurring));
        setCandidates(found);
        setSelectedIds(new Set(found.map(t => t.id)));
        setSearched(true);
    };

    const toggleSelected = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const applySelected = () => {
        onBulkMarkRecurring?.(Array.from(selectedIds));
        setCandidates(null);
        setSearched(false);
    };

    const dismiss = () => { setCandidates(null); setSearched(false); };

    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl max-h-[70vh] flex flex-col animate-fade-in">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                    <ReceiptText size={16} className="text-amber-400" />
                    歷史交易明細
                </h3>
                {onBulkMarkRecurring && (
                    <button
                        onClick={runDetection}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/15 text-sky-300 border border-sky-500/25 hover:bg-sky-500/25 transition-all text-xs font-bold"
                        title="依「同標的、約每月一次、扣款日相近、金額相近」規律，找出疑似定期定額的買進交易供你確認"
                    >
                        <Search size={13}/> 偵測定期定額
                    </button>
                )}
            </div>

            {searched && (
                <div className="px-4 py-3 border-b border-slate-700 bg-slate-900/40">
                    {candidates && candidates.length > 0 ? (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-300">
                                    偵測到 <span className="font-bold text-sky-300">{candidates.length}</span> 筆疑似定期定額交易，請確認後套用標記：
                                </span>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setSelectedIds(new Set(candidates.map(t => t.id)))} className="text-xs text-slate-400 hover:text-white">全選</button>
                                    <button onClick={() => setSelectedIds(new Set())} className="text-xs text-slate-400 hover:text-white">取消全選</button>
                                </div>
                            </div>
                            <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                                {candidates.map(tx => (
                                    <label key={tx.id} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer hover:bg-slate-800/50 px-2 py-1 rounded">
                                        <input type="checkbox" checked={selectedIds.has(tx.id)} onChange={() => toggleSelected(tx.id)} className="accent-sky-500" />
                                        <span className="font-mono text-slate-500">{tx.date}</span>
                                        <span className="font-bold text-white">{stockNameMap[tx.symbol] || tx.symbol}</span>
                                        <span className="text-slate-500 font-mono">{tx.symbol}</span>
                                        <span className="ml-auto font-mono">${Math.abs(tx.amount).toLocaleString()}</span>
                                    </label>
                                ))}
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                                <button
                                    onClick={applySelected}
                                    disabled={selectedIds.size === 0}
                                    className="px-3 py-1.5 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30 hover:bg-sky-500/30 transition-all text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    套用標記（{selectedIds.size}）
                                </button>
                                <button onClick={dismiss} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-slate-400 hover:text-white text-xs">
                                    <X size={12}/> 關閉
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">未偵測到符合規律（同標的、約每月一次、金額相近）的定期定額交易，可能需要手動標記。</span>
                            <button onClick={dismiss} className="text-slate-400 hover:text-white"><X size={14}/></button>
                        </div>
                    )}
                </div>
            )}

            <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left">
                    <thead className="sticky top-0 z-10 bg-slate-900 border-b border-slate-700">
                        <tr className="text-xs text-slate-400 uppercase">
                            <th className="p-3 font-medium">股票</th>
                            <th className="p-3 font-medium text-right">買賣/股數</th>
                            <th className="p-3 font-medium text-right">成交價</th>
                            <th className="p-3 font-medium text-right">總金額</th>
                            <th className="p-3 font-medium text-right">損益 / 報酬率</th>
                            <th className="p-3 font-medium text-right">日期</th>
                            <th className="p-3 font-medium text-center" title="標記為定期定額後，DSS 回測分析會排除此筆交易，避免非訊號驅動的交易拉低訊號吻合率">定期定額</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.length > 0 ? transactions.map(tx => {
                            const profitColor = tx.realizedProfit && tx.realizedProfit >= 0 ? 'text-red-400' : 'text-emerald-400';
                            return (
                                <tr key={tx.id} className={`border-b border-slate-800 last:border-b-0 hover:bg-slate-800 transition-colors ${tx.isRecurring ? 'bg-sky-500/5' : ''}`}>
                                    <td className="p-3">
                                        <div className="flex items-center gap-1.5">
                                            <p className="font-bold text-white truncate">{stockNameMap[tx.symbol] || tx.symbol}</p>
                                            {tx.isRecurring && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 whitespace-nowrap">定期定額</span>}
                                        </div>
                                        <p className="text-xs text-slate-500 font-mono">{tx.symbol}</p>
                                    </td>
                                    <td className="p-3 text-right">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                            tx.side === 'BUY'
                                            ? 'bg-red-500/10 text-rose-400 border-red-500/20'
                                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                        }`}>
                                            {tx.side === 'BUY' ? '買入' : '賣出'}
                                        </span>
                                        <p className="text-xs text-slate-400 font-mono mt-1">{tx.shares.toLocaleString()} 股</p>
                                    </td>
                                    <td className="p-3 text-right font-mono text-slate-300">${tx.price.toLocaleString()}</td>
                                    <td className="p-3 text-right">
                                        <p className="font-mono font-bold text-white">${Math.abs(tx.amount).toLocaleString()}</p>
                                        {tx.fees > 0 && <p className="text-[10px] text-slate-500 font-mono mt-0.5">(含稅費: ${tx.fees.toLocaleString()})</p>}
                                    </td>
                                    <td className="p-3 text-right font-mono">
                                        {tx.side === 'SELL' ? (
                                            (() => {
                                                const costBasis = tx.amount - (tx.realizedProfit || 0);
                                                const roi = costBasis > 0 ? ((tx.realizedProfit || 0) / costBasis) * 100 : 0;
                                                return (
                                                    <div className="flex flex-col items-end">
                                                        <span className={profitColor}>
                                                            {tx.realizedProfit?.toLocaleString(undefined, { signDisplay: 'always' })}
                                                        </span>
                                                        <span className={`text-[10px] px-1 py-0.5 mt-0.5 rounded font-bold ${profitColor} ${tx.realizedProfit && tx.realizedProfit >= 0 ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                                                            {roi > 0 ? '+' : ''}{roi.toFixed(2)}%
                                                        </span>
                                                    </div>
                                                );
                                            })()
                                        ) : (
                                            <span className="text-slate-500">-</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-right text-xs font-mono text-slate-500">{tx.date}</td>
                                    <td className="p-3 text-center">
                                        <button
                                            onClick={() => onToggleRecurring?.(tx.id)}
                                            disabled={!onToggleRecurring}
                                            title={tx.isRecurring ? '取消定期定額標記' : '標記為定期定額（DSS 回測分析將排除此筆交易）'}
                                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                                tx.isRecurring
                                                ? 'bg-sky-500/20 text-sky-300 border-sky-500/30 hover:bg-sky-500/30'
                                                : 'text-slate-500 border-slate-700 hover:text-sky-300 hover:border-sky-500/30'
                                            }`}
                                        >
                                            <Repeat size={12}/> {tx.isRecurring ? '已標記' : '標記'}
                                        </button>
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr><td colSpan={7} className="text-center py-10 text-slate-500 text-sm">尚無交易紀錄</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
