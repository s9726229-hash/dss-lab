
import React from 'react';
import { ArrowUpCircle, ArrowDownCircle, CheckCircle2, Search, Pencil, Trash2, Coins } from 'lucide-react';
import { Transaction } from '../../types';

interface TransactionListProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onEdit: (t: Transaction) => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({ transactions, onDelete, onEdit }) => {

  const getIcon = (type: Transaction['type']) => {
      switch(type) {
          case 'INCOME':
              return <div className="p-2.5 rounded-full shrink-0 bg-emerald-500/10 text-emerald-500"><ArrowUpCircle size={18}/></div>;
          case 'EXPENSE':
              return <div className="p-2.5 rounded-full shrink-0 bg-rose-500/10 text-rose-500"><ArrowDownCircle size={18}/></div>;
          case 'DIVIDEND':
              return <div className="p-2.5 rounded-full shrink-0 bg-amber-500/10 text-amber-500"><Coins size={18}/></div>;
          default:
              return null;
      }
  };
  
  const getAmountStyle = (type: Transaction['type']) => {
      switch(type) {
          case 'INCOME':
              return 'text-emerald-400';
          case 'DIVIDEND':
              return 'text-amber-400';
          case 'EXPENSE':
              return 'text-slate-200';
          default:
              return 'text-slate-200';
      }
  };

  const formatAmount = (t: Transaction) => {
      const prefix = t.type === 'EXPENSE' ? '-' : '+';
      return `${prefix}$${t.amount.toLocaleString()}`;
  };


  return (
    <div className="max-h-[600px] flex flex-col">
      <h3 className="sticky top-0 z-20 bg-slate-900 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 border-b border-slate-700 px-3">
          交易歷史
          <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-[10px] border border-slate-700">{transactions.length}</span>
      </h3>
      
      {/* Sticky Header Row */}
      <div className="sticky top-[45px] z-10 flex items-center bg-slate-900/95 backdrop-blur-sm px-3 py-2 border-b border-slate-700 text-xs text-slate-400 uppercase tracking-wider font-medium">
          <div className="flex-1" style={{ paddingLeft: '50px' }}>項目</div>
          <div className="w-28 flex-shrink-0 text-right pr-4">金額</div>
          <div className="w-[88px] flex-shrink-0 text-center">操作</div>
      </div>

      <div className="overflow-y-auto flex-1 space-y-2 px-1 pt-1">
          {transactions.map(t => (
          <div key={t.id} className="bg-slate-800 border border-slate-700 p-3 rounded-xl flex items-center group hover:border-slate-600 transition-all shadow-sm">
              <div className="flex-1 flex items-center gap-3 min-w-0">
                  {getIcon(t.type)}
                  <div className="min-w-0">
                      <div className="font-bold text-white text-sm flex items-center gap-1.5 truncate">
                          {t.item}
                          {t.invoiceId && <CheckCircle2 size={10} className="text-primary"/>}
                      </div>
                      <div className="text-[10px] text-slate-400 flex gap-1.5 items-center">
                          <span className="font-mono">{t.date}</span>
                          <span className="w-0.5 h-0.5 rounded-full bg-slate-500"></span>
                          <span>{t.category}</span>
                      </div>
                  </div>
              </div>

              <div className="w-28 flex-shrink-0 text-right pr-4">
                  <span className={`font-mono text-base font-bold whitespace-nowrap ${getAmountStyle(t.type)}`}>
                    {formatAmount(t)}
                  </span>
              </div>

              <div className="w-[88px] flex-shrink-0">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => onEdit(t)} className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-primary/20 hover:text-primary transition-all" title="編輯">
                        <Pencil size={18}/>
                    </button>
                    <button onClick={() => onDelete(t.id)} className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-red-500/20 hover:text-red-500 transition-all" title="刪除">
                        <Trash2 size={18}/>
                    </button>
                  </div>
              </div>
          </div>
          ))}
          {transactions.length === 0 && (
              <div className="text-center py-16 border-2 border-dashed border-slate-800 rounded-xl">
                  <Search size={32} className="mx-auto text-slate-600 mb-2"/>
                  <p className="text-slate-500 text-sm">找不到符合條件的交易紀錄</p>
                  <p className="text-xs text-slate-600 mt-1">請嘗試調整搜尋關鍵字或時間區間</p>
              </div>
          )}
        </div>
    </div>
  );
};