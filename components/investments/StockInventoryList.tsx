
import React, { useState } from 'react';
import { Asset, Transaction } from '../../types';
import { List, Edit2, Trash2, Info, Loader2, AlertTriangle, RefreshCw, Check, X } from 'lucide-react';
import { calculateStockPerformance } from '../../services/stock';
import { Input } from '../ui';

interface StockInventoryListProps {
    inventory: Asset[];
    totalMarketValue: number;
    transactions: Transaction[];
    onEdit: (asset: Asset) => void;
    onDelete: (id: string) => void;
    enrichingIds: string[];
    onEnrichSingle: (id: string) => void;
}

export const StockInventoryList: React.FC<StockInventoryListProps> = ({ inventory, totalMarketValue, transactions, onEdit, onDelete, enrichingIds, onEnrichSingle }) => {
    const [editingDividendId, setEditingDividendId] = useState<string | null>(null);
    const [dividendValue, setDividendValue] = useState('');
    const [paymentDate, setPaymentDate] = useState('');

    const formatDate = (timestamp: number | undefined) => {
        if (!timestamp) return '-';
        try {
            return new Date(timestamp).toLocaleDateString('sv-SE'); // YYYY-MM-DD
        } catch {
            return '-';
        }
    };

    const handleStartEditDividend = (pos: Asset) => {
        setEditingDividendId(pos.id);
        setDividendValue(pos.dividendPerShare?.toString() || '');
        setPaymentDate(pos.paymentDate || '');
    };

    const handleCancelEditDividend = () => {
        setEditingDividendId(null);
        setDividendValue('');
        setPaymentDate('');
    };

    const handleSaveDividend = (pos: Asset) => {
        const updatedAsset: Asset = {
            ...pos,
            dividendPerShare: parseFloat(dividendValue) || 0,
            paymentDate: paymentDate,
        };
        onEdit(updatedAsset);
        handleCancelEditDividend();
    };

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden h-full flex flex-col">
            <h3 className="text-sm font-bold text-slate-300 p-4 border-b border-slate-700 flex items-center gap-2">
                <List size={16} className="text-violet-400" />
                庫存明細
            </h3>
            <div className="overflow-auto flex-1">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10">
                        <tr className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider">
                            <th className="p-3 font-medium">名稱/代號</th>
                            <th className="p-3 font-medium text-right hidden lg:table-cell">持有股數</th>
                            <th className="p-3 font-medium text-right">成本/現價</th>
                            <th className="p-3 font-medium text-right">殖利率(成本)</th>
                            <th className="p-3 font-medium text-right">持有市值</th>
                            <th className="p-3 font-medium text-right text-yellow-500">股息收益</th>
                            <th className="p-3 font-medium text-right">
                                <div className="flex items-center justify-end gap-1">
                                    未實現損益
                                    <div title="已扣除預估手續費與證交稅" className="cursor-help">
                                        <Info size={12} />
                                    </div>
                                </div>
                            </th>
                            <th className="p-3 font-medium text-right hidden sm:table-cell">最後更新</th>
                            <th className="p-3 font-medium text-center">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50 text-sm">
                        {inventory.map(pos => {
                            const performance = calculateStockPerformance(pos, transactions);
                            const isGain = performance.netProfit >= 0;
                            const isEnriching = enrichingIds.includes(pos.id);
                            
                            const STALE_THRESHOLD = 14 * 24 * 60 * 60 * 1000;
                            const isStale = !pos.lastUpdated || (Date.now() - (pos.lastUpdated || 0)) > STALE_THRESHOLD;
                            const weight = totalMarketValue > 0 ? (performance.marketValue / totalMarketValue) * 100 : 0;
                            const costYield = (pos.avgCost && pos.dividendPerShare) ? (pos.dividendPerShare / pos.avgCost) * 100 : 0;

                            return (
                                <tr key={pos.id} className="hover:bg-slate-700/30 transition-colors group">
                                    <td className="p-3">
                                        {isEnriching ? (
                                            <div className="flex items-center gap-2">
                                                <Loader2 size={14} className="animate-spin text-slate-500" />
                                                <div className="text-slate-400">查詢中...</div>
                                            </div>
                                        ) : (
                                            <div>
                                                <div className="font-bold text-white flex items-center gap-2">{pos.name}</div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <div className="text-xs text-slate-500 font-mono">{pos.symbol}</div>
                                                    {pos.stockCategory && 
                                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${
                                                            pos.isEtf ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' : 'bg-slate-700 text-slate-300 border-slate-600'
                                                        }`}>
                                                            {pos.stockCategory}
                                                        </span>
                                                    }
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-3 text-right font-mono text-slate-300 hidden lg:table-cell">{pos.shares?.toLocaleString()}</td>
                                    <td className="p-3 text-right">
                                        <div className="font-mono text-slate-200">{pos.avgCost?.toFixed(2)}</div>
                                        <div className="text-xs font-mono text-slate-500 flex items-center justify-end gap-1.5">
                                            {isStale && <span title="資料已過期 (超過14天)"><AlertTriangle size={12} className="text-amber-400" /></span>}
                                            {pos.currentPrice?.toFixed(2) || '-'}
                                        </div>
                                    </td>
                                    <td className="p-3 text-right">
                                        {editingDividendId === pos.id ? (
                                            <div className="space-y-1 w-40 ml-auto">
                                                <Input type="number" placeholder="每股配息" value={dividendValue} onChange={e => setDividendValue(e.target.value)} className="h-7 text-xs font-mono" />
                                                <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="h-7 text-xs font-mono" />
                                                <div className="flex gap-1 justify-end">
                                                    <button onClick={() => handleSaveDividend(pos)} className="p-1 rounded bg-primary/20 text-primary"><Check size={12}/></button>
                                                    <button onClick={handleCancelEditDividend} className="p-1 rounded bg-slate-700 text-slate-300"><X size={12}/></button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div onClick={() => handleStartEditDividend(pos)} className="cursor-pointer group/yield">
                                                {costYield > 0 ? (
                                                    <>
                                                        <div className="font-mono font-bold text-yellow-400">{costYield.toFixed(2)}%</div>
                                                        <div className="text-xs font-mono text-slate-500">{pos.paymentDate}</div>
                                                    </>
                                                ) : (
                                                    <span className="text-slate-500 text-xs group-hover/yield:text-white">未設定</span>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-3 text-right">
                                        <div className="font-mono font-bold text-white">{performance.marketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                        <div className="text-xs font-mono text-slate-500">({weight.toFixed(1)}%)</div>
                                    </td>
                                    <td className="p-3 text-right font-mono text-yellow-400">
                                        {performance.totalDividends > 0 ? `+${performance.totalDividends.toLocaleString()}` : '-'}
                                    </td>
                                    <td className="p-3 text-right">
                                        <div className={`font-mono font-bold ${isGain ? 'text-rose-400' : 'text-emerald-400'}`}>
                                            {performance.netProfit.toLocaleString(undefined, { signDisplay: 'always', maximumFractionDigits: 0 })}
                                        </div>
                                        <div className={`text-xs font-mono ${isGain ? 'text-rose-500/80' : 'text-emerald-500/80'}`}>
                                            ({performance.roi.toFixed(2)}%)
                                        </div>
                                    </td>
                                    <td className="p-3 text-right hidden sm:table-cell">
                                        <div className="text-xs font-mono text-slate-500">{formatDate(pos.lastUpdated)}</div>
                                    </td>
                                    <td className="p-3 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            {isStale && !isEnriching && (
                                                <button onClick={() => onEnrichSingle(pos.id)} className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-cyan-500/20 hover:text-cyan-400 transition-all" title="AI 更新此筆">
                                                    <RefreshCw size={18} />
                                                </button>
                                            )}
                                            <button onClick={() => onEdit(pos)} className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-primary/20 hover:text-primary transition-all" title="編輯">
                                                <Edit2 size={18} />
                                            </button>
                                            <button onClick={() => onDelete(pos.id)} className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-red-500/20 hover:text-red-500 transition-all" title="刪除">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {inventory.length === 0 && (
                    <div className="text-center py-16 text-slate-500 text-sm">
                        尚無庫存資料
                        <p className="text-xs mt-1">請使用「新增持股」功能新增</p>
                    </div>
                )}
            </div>
        </div>
    );
};