

import React, { useMemo, useState } from 'react';
import { Transaction, BudgetConfig } from '../types';
import { EXPENSE_CATEGORIES } from '../constants';
import { Card, Button, Input, Modal } from '../components/ui';
import { Target, AlertTriangle, Zap, Wallet, PlusCircle, TrendingUp, Info } from 'lucide-react';
import { getRecurring, getAssets } from '../services/storage';

interface BudgetProps {
  transactions: Transaction[];
  budgets: BudgetConfig[];
  onUpdateBudgets: (budgets: BudgetConfig[]) => void;
}

export const Budget: React.FC<BudgetProps> = ({ transactions, budgets, onUpdateBudgets }) => {
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<string>('');

  // 1. Calculate Monthly Spending per Category & Context for AI
  const { categorySpend, totalBudgetLimit, trackedSpend, largeExpenses, financialContext } = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const catSpend: Record<string, number> = {};
    
    // Filter for current month EXPENSE transactions
    const monthTransactions = transactions.filter(t => {
      if (t.type !== 'EXPENSE') return false;
      const tDate = new Date(t.date);
      return tDate >= startOfMonth && tDate <= now;
    });

    monthTransactions.forEach(t => {
      catSpend[t.category] = (catSpend[t.category] || 0) + t.amount;
    });

    // --- Logic 1: Budget Execution Rate ---
    // Only sum up spending for categories that ACTUALLY have a budget set > 0.
    let trackedSpendSum = 0;
    let totalLimitSum = 0;

    budgets.forEach(b => {
        if (b.limit > 0) {
            totalLimitSum += b.limit;
            trackedSpendSum += (catSpend[b.category] || 0);
        }
    });

    // --- Logic 4: Large Expenses ---
    // Exclude: Investment category AND Fixed Recurring (Auto-Executed)
    // Strategy: Top 5 absolute highest expenses
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const large = transactions
        .filter(t => 
            t.type === 'EXPENSE' && 
            new Date(t.date) >= thirtyDaysAgo && 
            t.category !== '投資' && // Exclude Investments
            !t.note?.includes('Auto-Executed') // Exclude Fixed Recurring
        )
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

    // Financial Context for Simulator
    const assets = getAssets();
    const recurring = getRecurring();
    
    let monthlyIncome = recurring.filter(r => r.type === 'INCOME').reduce((sum, r) => sum + (r.frequency === 'YEARLY' ? r.amount/12 : r.amount), 0);
    monthlyIncome += 5000; // Baseline buffer

    const monthlyFixedExpenses = recurring.filter(r => r.type === 'EXPENSE').reduce((sum, r) => sum + (r.frequency === 'YEARLY' ? r.amount/12 : r.amount), 0);
    
    const currentCash = assets.filter(a => a.type === 'CASH').reduce((sum, a) => sum + a.amount, 0);
    const netWorth = assets.reduce((sum, a) => a.type === 'DEBT' ? sum - a.amount : sum + a.amount, 0);

    return { 
        categorySpend: catSpend, 
        totalBudgetLimit: totalLimitSum,
        trackedSpend: trackedSpendSum,
        largeExpenses: large, 
        financialContext: { monthlyIncome, monthlyFixedExpenses, currentCash, netWorth }
    };
  }, [transactions, budgets]);

  const handleSetBudget = (category: string) => {
    const limit = parseInt(editAmount);
    if (isNaN(limit)) return;
    
    const newBudgets = budgets.filter(b => b.category !== category);
    if (limit > 0) {
        newBudgets.push({ category, limit });
    }
    onUpdateBudgets(newBudgets);
    setEditingCategory(null);
  };

  const openBudgetEdit = (cat: string, currentLimit: number) => {
      setEditingCategory(cat);
      setEditAmount(currentLimit > 0 ? currentLimit.toString() : '');
  };

  const totalPercent = totalBudgetLimit > 0 ? (trackedSpend / totalBudgetLimit) * 100 : 0;
  let totalStatusColor = 'bg-emerald-500';
  if (totalPercent > 80) totalStatusColor = 'bg-amber-500';
  if (totalPercent > 100) totalStatusColor = 'bg-red-500';

  // Logic 2: Filter Categories (Remove '投資')
  const DISPLAY_CATEGORIES = EXPENSE_CATEGORIES.filter(c => c !== '投資');

  return (
    <div className="space-y-6 animate-fade-in p-2 md:p-6 pb-24">
      
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
         <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Target className="text-rose-400"/> 預算與分析
            </h2>
            <p className="text-xs text-slate-400 mt-1">設定月度預算上限 • 監控異常大額消費</p>
         </div>
      </div>

      {/* SECTION 1: Overall Health (Full Width) */}
      <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
          <div className="flex justify-between items-end mb-2">
              <div>
                  <h3 className="text-slate-400 text-xs font-bold uppercase flex items-center gap-2">
                      <Wallet size={14}/> 本月總預算執行率 (已設定項目)
                  </h3>
                  <div className="text-3xl font-bold text-white font-mono mt-1">
                      ${trackedSpend.toLocaleString()} <span className="text-sm text-slate-500 font-normal">/ ${totalBudgetLimit.toLocaleString()}</span>
                  </div>
              </div>
              <div className="text-right">
                  <span className={`text-xl font-bold ${totalPercent > 100 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {totalPercent.toFixed(1)}%
                  </span>
              </div>
          </div>
          <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden">
                <div className={`h-full ${totalStatusColor} transition-all duration-1000 ease-out`} style={{ width: `${Math.min(totalPercent, 100)}%` }}></div>
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-500">
              <Info size={12}/>
              <span>此進度條僅統計「已設定預算」的類別。未設定預算或不可控的支出（如固定房貸）不會計入，以免影響評估。</span>
          </div>
      </Card>

      {/* SECTION 2: Category Grid (Main Content) */}
      <div>
          <h3 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2">
              <Zap size={16} className="text-amber-400"/> 各類別預算監控 (排除投資)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {DISPLAY_CATEGORIES.map(cat => {
                  const budget = budgets.find(b => b.category === cat);
                  const limit = budget?.limit || 0;
                  const spent = categorySpend[cat] || 0;
                  const percent = limit > 0 ? (spent / limit) * 100 : 0;
                  let barColor = 'bg-emerald-500';
                  if (percent > 80) barColor = 'bg-amber-500';
                  if (percent > 100) barColor = 'bg-red-500';

                  return (
                      <div key={cat} className="bg-slate-800 border border-slate-700 p-4 rounded-xl relative overflow-hidden group hover:border-slate-600 transition-colors">
                          <div className="flex justify-between items-start mb-2 relative z-10">
                              <div>
                                  <h4 className="font-bold text-white">{cat}</h4>
                                  <p className="text-xs text-slate-400 mt-0.5">已支出: ${spent.toLocaleString()}</p>
                              </div>
                              <div className="text-right">
                                  {limit > 0 ? (
                                      <div onClick={() => openBudgetEdit(cat, limit)} className="cursor-pointer hover:opacity-80">
                                        <p className="text-[10px] text-slate-500 uppercase font-bold">預算上限</p>
                                        <p className="font-mono font-bold text-white text-sm">${limit.toLocaleString()}</p>
                                      </div>
                                  ) : (
                                      <button onClick={() => openBudgetEdit(cat, 0)} className="text-xs bg-slate-700 hover:bg-slate-600 px-2.5 py-1.5 rounded-lg text-slate-300 flex items-center gap-1 transition-colors">
                                          <PlusCircle size={14}/> 設定
                                      </button>
                                  )}
                              </div>
                          </div>
                          
                          {/* Progress Bar */}
                          {limit > 0 && (
                              <div className="h-1.5 w-full bg-slate-900 rounded-full mt-3 relative z-10">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-500 ${barColor}`} 
                                    style={{ width: `${Math.min(percent, 100)}%` }}
                                  ></div>
                              </div>
                          )}

                          {/* Over Budget Warning Background */}
                          {percent > 100 && (
                              <div className="absolute right-[-10px] bottom-[-10px] opacity-5 pointer-events-none">
                                  <AlertTriangle size={80} className="text-red-500"/>
                              </div>
                          )}
                      </div>
                  );
              })}
          </div>
      </div>

      <div className="pt-4 border-t border-slate-800">
          
          {/* 3.1 Large Expense Radar */}
          <Card className="border-rose-500/20 bg-gradient-to-b from-slate-800 to-slate-900 h-full max-w-2xl">
              <h3 className="text-sm font-bold text-rose-400 mb-4 flex items-center gap-2">
                  <TrendingUp size={16}/> 異常大額支出雷達
              </h3>
              <div className="flex items-center gap-2 mb-3 bg-rose-500/10 p-2 rounded text-[10px] text-rose-300 border border-rose-500/20">
                  <AlertTriangle size={12}/>
                  <span>系統僅監控前 5 大單筆消費 (排除投資/固定扣款)</span>
              </div>
              
              <div className="space-y-2 mb-4">
                  {largeExpenses.length > 0 ? largeExpenses.map(t => (
                      <div key={t.id} className="flex justify-between items-center p-2.5 bg-slate-800/50 rounded border border-slate-700/50 hover:bg-slate-800 transition-colors">
                          <div>
                              <div className="text-sm font-bold text-white truncate max-w-[120px]">{t.item}</div>
                              <div className="text-[10px] text-slate-500">{t.date} • {t.category}</div>
                          </div>
                          <div className="font-mono font-bold text-rose-400 text-sm">
                              -${t.amount.toLocaleString()}
                          </div>
                      </div>
                  )) : (
                      <div className="text-center py-8 text-slate-600 text-xs border border-dashed border-slate-800 rounded-lg">
                          近 30 天無異常大額支出
                          <br/>保持良好的消費習慣！
                      </div>
                  )}
              </div>
          </Card>
      </div>

      {/* Edit Budget Modal */}
      <Modal isOpen={!!editingCategory} onClose={() => setEditingCategory(null)} title={`設定 ${editingCategory} 預算`}>
          <div className="space-y-4">
              <p className="text-sm text-slate-400">請輸入此分類的每月預算上限金額。設定為 0 則刪除預算限制。</p>
              <div>
                  <label className="block text-xs text-slate-500 mb-1">金額 (TWD)</label>
                  <Input 
                    type="number" 
                    value={editAmount} 
                    onChange={e => setEditAmount(e.target.value)} 
                    autoFocus
                    placeholder="例如：15000"
                    className="text-lg bg-slate-900 border-slate-700 focus:border-primary"
                  />
              </div>
              <div className="flex gap-2 pt-2">
                  <Button variant="secondary" onClick={() => setEditingCategory(null)} className="flex-1">取消</Button>
                  <Button onClick={() => editingCategory && handleSetBudget(editingCategory)} className="flex-1">確認設定</Button>
              </div>
          </div>
      </Modal>



    </div>
  );
};
