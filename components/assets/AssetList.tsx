
import React from 'react';
import { Asset, AssetType, Currency } from '../../types';
import { ASSET_TYPE_COLORS, ASSET_TYPE_LABELS } from '../../constants';
import { Edit2, Trash2, AlertCircle } from 'lucide-react';

interface AssetListProps {
  filteredAssets: Asset[];
  filterType: string;
  setFilterType: (type: any) => void;
  onEdit: (asset: Asset) => void;
  onDelete: (id: string) => void;
  calculateDaysSinceUpdate: (timestamp: number) => number;
}

export const AssetList: React.FC<AssetListProps> = ({ 
  filteredAssets, filterType, setFilterType, onEdit, onDelete, calculateDaysSinceUpdate 
}) => {
  const formatDate = (timestamp: number | undefined) => {
    if (!timestamp) return '-';
    try {
        return new Date(timestamp).toLocaleDateString('sv-SE'); // YYYY-MM-DD
    } catch {
        return '-';
    }
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-xl max-h-[600px] flex flex-col">
         <div className="flex items-center gap-2 p-4 border-b border-slate-700 bg-slate-800/50 overflow-x-auto no-scrollbar shrink-0">
             {[
                 { id: 'ALL', label: '全部' },
                 { id: 'INVEST', label: '股票/基金' },
                 { id: 'CASH', label: '現金/存款' },
                 { id: 'DEBT', label: '負債/貸款' },
             ].map(tab => (
                 <button
                    key={tab.id}
                    onClick={() => setFilterType(tab.id)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                        filterType === tab.id 
                        ? 'bg-slate-700 text-white shadow-sm ring-1 ring-slate-600' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                    }`}
                 >
                    {tab.label}
                 </button>
             ))}
         </div>

         <div className="overflow-y-auto flex-1">
            <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-900 border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wider">
                        <th className="p-4 font-medium">資產名稱</th>
                        <th className="p-4 font-medium hidden md:table-cell">類別</th>
                        <th className="p-4 font-medium text-right">金額 (TWD)</th>
                        <th className="p-4 font-medium text-right hidden sm:table-cell">最後更新</th>
                        <th className="p-4 font-medium text-center">操作</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50 text-sm">
                    {filteredAssets.map(asset => {
                        const daysOld = calculateDaysSinceUpdate(asset.lastUpdated);
                        const isStale = daysOld > 14;
                        return (
                            <tr key={asset.id} className="hover:bg-slate-700/30 transition-colors group">
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-1 h-8 rounded-full`} style={{ backgroundColor: ASSET_TYPE_COLORS[asset.type] }}></div>
                                        <div>
                                            <div className="font-bold text-white text-sm flex items-center gap-2">
                                                {asset.name}
                                                {isStale && asset.type !== AssetType.DEBT && <span title="資料已超過14天未更新"><AlertCircle size={14} className="text-amber-500" /></span>}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="md:hidden px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[9px] text-slate-400">
                                                    {ASSET_TYPE_LABELS[asset.type]}
                                                </span>
                                                {asset.currency !== Currency.TWD && (
                                                    <span className="text-[10px] text-slate-500 font-mono">
                                                        {asset.currency} {asset.originalAmount?.toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 hidden md:table-cell">
                                    <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-400 font-medium">
                                        {ASSET_TYPE_LABELS[asset.type]}
                                    </span>
                                </td>
                                <td className="p-4 text-right">
                                    <div className={`font-mono font-bold text-[15px] ${asset.type === AssetType.DEBT ? 'text-red-400' : 'text-emerald-400'}`}>
                                        {asset.type === AssetType.DEBT ? '-' : ''}${asset.amount.toLocaleString()}
                                    </div>
                                    {(asset.type === AssetType.STOCK || asset.type === AssetType.FUND) && asset.avgCost && asset.shares ? (
                                        <div className="mt-1 flex justify-end">
                                            {(() => {
                                                const totalCost = asset.avgCost! * asset.shares!;
                                                const unrealized = asset.amount - totalCost;
                                                const roi = totalCost > 0 ? (unrealized / totalCost) * 100 : 0;
                                                const isProfit = unrealized >= 0;
                                                return (
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-0.5 ${isProfit ? 'bg-red-500/20 text-red-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                                                        {isProfit ? '+$' : '-$'}{Math.abs(unrealized).toLocaleString(undefined, {maximumFractionDigits:0})} ({isProfit ? '+' : ''}{roi.toFixed(1)}%)
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    ) : null}
                                    {asset.type === AssetType.DEBT && asset.originalAmount && (asset.originalAmount > 0) ? (
                                        <div className="mt-2 w-full max-w-[120px] ml-auto">
                                            {(() => {
                                                const paid = asset.originalAmount! - asset.amount;
                                                // Handle case where debt has grown past original amount
                                                const percent = paid >= 0 ? (paid / asset.originalAmount!) * 100 : 0; 
                                                return (
                                                    <div className="flex flex-col gap-1">
                                                        <div className="w-full bg-slate-700/80 rounded-full h-1.5 overflow-hidden">
                                                            <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}></div>
                                                        </div>
                                                        <span className="text-[9px] text-slate-500 font-medium text-right">已還款 {percent.toFixed(1)}%</span>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    ) : null}
                                </td>
                                <td className="p-4 text-right hidden sm:table-cell">
                                    <div className="text-xs font-mono text-slate-500">{formatDate(asset.lastUpdated)}</div>
                                </td>
                                <td className="p-4 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                        <button onClick={() => onEdit(asset)} className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-primary/20 hover:text-primary transition-all" title="編輯">
                                            <Edit2 size={18}/>
                                        </button>
                                        <button onClick={() => onDelete(asset.id)} className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-red-500/20 hover:text-red-500 transition-all" title="刪除">
                                            <Trash2 size={18}/>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
         </div>
      </div>
  );
};
