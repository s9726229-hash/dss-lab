
import React from 'react';
import { Card } from '../ui';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';

interface TransactionStatsProps {
  income: number;
  expense: number;
  balance: number;
}

export const TransactionStats: React.FC<TransactionStatsProps> = ({ income, expense, balance }) => {
  return (
    <>
      {/* Mobile: Compact Dashboard */}
      <div className="md:hidden flex items-center justify-between bg-slate-800 rounded-xl p-3 border border-slate-700/50 mb-3 shadow-inner">
         <div className="flex flex-col">
             <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Balance (結餘)</span>
             <span className={`text-2xl font-mono font-bold ${balance >= 0 ? 'text-white' : 'text-red-400'}`}>
                 ${balance.toLocaleString()}
             </span>
         </div>
         <div className="flex flex-col items-end gap-1">
             <div className="flex items-center gap-2 text-xs">
                <span className="text-emerald-400 font-mono font-medium">+${income.toLocaleString()}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
             </div>
             <div className="flex items-center gap-2 text-xs">
                <span className="text-rose-400 font-mono font-medium">-${expense.toLocaleString()}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
             </div>
         </div>
      </div>

      {/* Desktop: Expanded Cards */}
      <div className="hidden md:grid grid-cols-3 gap-4 mb-4">
          <Card className="p-4 bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
              <div className="flex justify-between items-start mb-2">
                  <span className="text-slate-400 text-xs font-bold uppercase">總結餘 (Balance)</span>
                  <Wallet size={16} className="text-primary"/>
              </div>
              <div className={`text-2xl font-bold font-mono ${balance >= 0 ? 'text-white' : 'text-red-400'}`}>
                  ${balance.toLocaleString()}
              </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
              <div className="flex justify-between items-start mb-2">
                  <span className="text-emerald-400/80 text-xs font-bold uppercase">總收入 (Income)</span>
                  <TrendingUp size={16} className="text-emerald-500"/>
              </div>
              <div className="text-2xl font-bold text-emerald-400 font-mono">
                  +${income.toLocaleString()}
              </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
              <div className="flex justify-between items-start mb-2">
                  <span className="text-rose-400/80 text-xs font-bold uppercase">總支出 (Expense)</span>
                  <TrendingDown size={16} className="text-rose-500"/>
              </div>
              <div className="text-2xl font-bold text-rose-400 font-mono">
                  -${expense.toLocaleString()}
              </div>
          </Card>
      </div>
    </>
  );
};
