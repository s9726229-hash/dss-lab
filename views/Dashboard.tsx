import React, { useEffect, useState, useMemo } from 'react';
import { Card, Button } from '../components/ui';
import { Asset, Transaction, AssetType, RecurringItem, BudgetConfig, ViewState, StockSnapshot, StockTransaction } from '../types';
import { 
    Sparkles, TrendingUp, AlertTriangle, Wallet, CreditCard, 
    BarChart3, Target, Flag, Bell, ArrowRight, PieChart as PieIcon, LineChart as LineIcon
} from 'lucide-react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, AreaChart, Area, PieChart, Pie
} from 'recharts';
import { ASSET_TYPE_COLORS, ASSET_TYPE_LABELS } from '../constants';
import { getHistory } from '../services/storage';
import { calculateStockPerformance } from '../services/stock';
import { InvestmentStats } from '../components/investments/InvestmentStats';

interface DashboardProps {
  assets: Asset[];
  transactions: Transaction[];
  recurring: RecurringItem[];
  budgets: BudgetConfig[];
  stockHistory: StockSnapshot[];
  stockTransactions: StockTransaction[];
  onChangeView: (view: ViewState) => void;
  onAddTransaction: (t: Transaction) => void;
  onNavigateToTransactions: (filter: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  assets, 
  transactions, 
  recurring, 
  budgets,
  stockHistory,
  stockTransactions, 
  onChangeView, 
  onAddTransaction,
  onNavigateToTransactions 
}) => {
  const [netWorth, setNetWorth] = useState(0);
  const [totalAssets, setTotalAssets] = useState(0);
  const [totalDebt, setTotalDebt] = useState(0);
  
  const [activeMainChart, setActiveMainChart] = useState<'WATERFALL' | 'TREND' | 'CASH_FLOW' | 'MONTHLY_INCOME' | 'ANNUAL_INCOME'>('TREND');
  const [historyData, setHistoryData] = useState<any[]>([]);

  // Waterfall Chart Data
  const waterfallData = useMemo(() => {
    const cash = assets.filter(a => a.type === AssetType.CASH).reduce((sum, a) => sum + a.amount, 0);
    const stock = assets.filter(a => a.type === AssetType.STOCK).reduce((sum, a) => sum + a.amount, 0);
    const fund = assets.filter(a => [AssetType.FUND, AssetType.CRYPTO, AssetType.REAL_ESTATE, AssetType.OTHER].includes(a.type)).reduce((sum, a) => sum + a.amount, 0);
    const debt = totalDebt;
    return [
      { name: '現金', transparent: 0, value: cash, fill: '#38bdf8', label: cash },
      { name: '股票', transparent: cash, value: stock, fill: '#818cf8', label: stock },
      { name: '基金/其他', transparent: cash + stock, value: fund, fill: '#a78bfa', label: fund },
      { name: '總資產', transparent: 0, value: totalAssets, fill: '#10b981', label: totalAssets },
      { name: '負債', transparent: totalAssets - debt, value: debt, fill: '#ef4444', label: -debt },
      { name: '淨資產', transparent: 0, value: netWorth, fill: '#3b82f6', label: netWorth }
    ];
  }, [totalAssets, totalDebt, netWorth, assets]);

  // Quick Add State
  const [quickItem, setQuickItem] = useState('');
  const [quickAmount, setQuickAmount] = useState('');

  const calculateEstimatedMonthlyPayment = (debt: Asset) => {
      if (debt.type !== AssetType.DEBT || !debt.interestRate || !debt.termYears || !debt.amount) return 0;
      const graceYears = debt.interestOnlyPeriod || 0;
      const remainingYears = debt.termYears - graceYears;
      if (remainingYears <= 0) return 0;
      const p = debt.amount;
      const r = debt.interestRate / 100 / 12;
      const n = remainingYears * 12;
      if (r === 0) return p / n;
      return p * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
  };

  useEffect(() => {
    let assetsVal = 0;
    let liabilitiesVal = 0;

    assets.forEach(a => {
      const val = a.amount;
      if (a.type === AssetType.DEBT) {
        liabilitiesVal += val;
      } else {
        assetsVal += val;
      }
    });

    setNetWorth(assetsVal - liabilitiesVal);
    setTotalAssets(assetsVal);
    setTotalDebt(liabilitiesVal);
  }, [assets]);

  useEffect(() => {
    const history = getHistory();
    const dailyMap = new Map<string, any>();
    history.forEach(h => {
        const dist = h.assetDistribution || {};
        const debt = dist[AssetType.DEBT] || 0;
        const cash = (dist[AssetType.CASH] || 0) + (dist[AssetType.OTHER] || 0);
        const stock = dist[AssetType.STOCK] || 0;
        const fund = (dist[AssetType.FUND] || 0) + (dist[AssetType.CRYPTO] || 0) + (dist[AssetType.REAL_ESTATE] || 0);
        
        let tAssets = h.totalAssets;
        if (tAssets === 0 && h.netWorth !== 0) {
             tAssets = cash + stock + fund;
        }
        dailyMap.set(h.date, {
            date: h.date.substring(5),
            fullDate: h.date,
            totalAssets: Math.round(tAssets),
            totalDebt: Math.round(debt),
            netWorth: Math.round(h.netWorth),
            cash: Math.round(cash),
            stock: Math.round(stock),
            fund: Math.round(fund)
        });
    });

    let processed = Array.from(dailyMap.values()).sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime()).slice(-180);
    const todayFullDate = new Date().toISOString().split('T')[0];
    const todayIndex = processed.findIndex(p => p.fullDate === todayFullDate);
    const currentCash = assets.filter(a => a.type === AssetType.CASH || a.type === AssetType.OTHER).reduce((sum, a) => sum + a.amount, 0);
    const currentStock = assets.filter(a => a.type === AssetType.STOCK).reduce((sum, a) => sum + a.amount, 0);
    const currentFund = assets.filter(a => [AssetType.FUND, AssetType.CRYPTO, AssetType.REAL_ESTATE].includes(a.type)).reduce((sum, a) => sum + a.amount, 0);

    if (todayIndex !== -1) {
        processed[todayIndex].totalAssets = Math.round(totalAssets);
        processed[todayIndex].totalDebt = Math.round(totalDebt);
        processed[todayIndex].netWorth = Math.round(netWorth);
        processed[todayIndex].cash = Math.round(currentCash);
        processed[todayIndex].stock = Math.round(currentStock);
        processed[todayIndex].fund = Math.round(currentFund);
    } else {
        processed.push({
            date: todayFullDate.substring(5),
            fullDate: todayFullDate,
            totalAssets: Math.round(totalAssets),
            totalDebt: Math.round(totalDebt),
            netWorth: Math.round(netWorth),
            cash: Math.round(currentCash),
            stock: Math.round(currentStock),
            fund: Math.round(currentFund)
        });
    }
    setHistoryData([...processed]);
  }, [totalAssets, totalDebt, netWorth]);

  const dataByType = Object.values(AssetType).map(type => {
    if (type === AssetType.DEBT) return { name: ASSET_TYPE_LABELS[type], typeCode: type, value: 0 };
    const value = assets.filter(a => a.type === type).reduce((sum, a) => sum + a.amount, 0);
    return { name: ASSET_TYPE_LABELS[type] || type, typeCode: type, value };
  }).filter(d => d.value > 0);

  const inventory = useMemo(() => assets.filter(a => a.type === AssetType.STOCK), [assets]);
  const isAnyStockStale = useMemo(() => {
      const STALE_THRESHOLD = 14 * 24 * 60 * 60 * 1000;
      return inventory.some(stock => !stock.lastUpdated || (Date.now() - stock.lastUpdated) > STALE_THRESHOLD);
  }, [inventory]);

  const handleQuickAdd = () => {
      if (!quickItem || !quickAmount) return;
      const amountNum = Number(quickAmount);
      if (isNaN(amountNum) || amountNum <= 0) return;
      
      onAddTransaction({
          id: crypto.randomUUID(),
          date: new Date().toISOString().split('T')[0],
          amount: amountNum,
          category: '其他',
          item: quickItem,
          type: 'EXPENSE',
          source: 'MANUAL'
      });
      setQuickItem('');
      setQuickAmount('');
  };

  const hasRecordedToday = transactions.some(t => t.date === new Date().toISOString().split('T')[0]);

  // Derived Data for Charts & Radars
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // 1. Monthly Cash Flow Data
  const expenseCategories = useMemo(() => {
      return Array.from(new Set(transactions.filter(t => t.type === 'EXPENSE').map(t => t.category)));
  }, [transactions]);

  const cashFlowData = useMemo(() => {
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      return Array.from({ length: daysInMonth }, (_, i) => {
          const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
          
          const dayTxs = transactions.filter(t => t.date === dateStr);
          const income = dayTxs.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
          const expenseTxs = dayTxs.filter(t => t.type === 'EXPENSE');
          const expense = expenseTxs.reduce((s, t) => s + t.amount, 0);
          const dividend = dayTxs.filter(t => t.type === 'DIVIDEND').reduce((s, t) => s + t.amount, 0);

          const dayStockTxs = stockTransactions?.filter(t => t.date === dateStr && t.side === 'SELL') || [];
          const stockProfit = dayStockTxs.reduce((s, t) => s + (t.realizedProfit || 0), 0);

          const totalStockIncome = dividend + stockProfit;

          const result: any = {
              date: String(i + 1), // Day of month
              net: income + totalStockIncome - expense,
              income,
              expense,
              stockIncome: totalStockIncome
          };

          expenseCategories.forEach(cat => {
              const catTotal = expenseTxs.filter(t => t.category === cat).reduce((s, t) => s + t.amount, 0);
              if (catTotal > 0) result[`exp_${cat}`] = -catTotal;
          });

          return result;
      });
  }, [transactions, stockTransactions, currentMonth, currentYear, expenseCategories]);

  // 1.5 Historical Monthly Net Income
  const historicalMonthlyIncomeData = useMemo(() => {
      const data = [];
      const numMonths = 6; // Last 6 months
      for (let i = numMonths - 1; i >= 0; i--) {
          const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const year = targetDate.getFullYear();
          const month = targetDate.getMonth();
          const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

          // Income & Expenses from transactions
          const monthTxs = transactions.filter(t => {
              const d = new Date(t.date);
              return d.getFullYear() === year && d.getMonth() === month;
          });
          const income = monthTxs.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
          const expense = monthTxs.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);

          // Stock income
          const dividend = monthTxs.filter(t => t.type === 'DIVIDEND').reduce((s, t) => s + t.amount, 0);
          const monthStockTxs = stockTransactions?.filter(t => {
              if (t.side !== 'SELL') return false;
              const d = new Date(t.date);
              return d.getFullYear() === year && d.getMonth() === month;
          }) || [];
          const stockProfit = monthStockTxs.reduce((s, t) => s + (t.realizedProfit || 0), 0);
          const stockIncome = dividend + stockProfit;

          // Debt payments for this month
          let debtPayments = 0;
          assets.filter(a => a.type === AssetType.DEBT).forEach(debt => {
              if (debt.startDate) {
                  const start = new Date(debt.startDate);
                  if (start.getFullYear() < year || (start.getFullYear() === year && start.getMonth() <= month)) {
                      debtPayments += Math.round(calculateEstimatedMonthlyPayment(debt));
                  }
              } else {
                  debtPayments += Math.round(calculateEstimatedMonthlyPayment(debt));
              }
          });

          const totalExpense = expense + debtPayments;
          const netIncome = income + stockIncome - totalExpense;

          data.push({
              month: monthStr,
              netIncome,
              income,
              stockIncome,
              expense,
              debtPayments
          });
      }
      return data;
  }, [transactions, stockTransactions, assets, now]);

  // 1.6 Historical Annual Net Income
  const historicalAnnualIncomeData = useMemo(() => {
      const data = [];
      const numYears = 3; // Last 3 years
      for (let i = numYears - 1; i >= 0; i--) {
          const year = now.getFullYear() - i;
          const yearStr = `${year}年`;

          // Income & Expenses from transactions
          const yearTxs = transactions.filter(t => new Date(t.date).getFullYear() === year);
          const income = yearTxs.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
          const expense = yearTxs.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);

          // Stock income
          const dividend = yearTxs.filter(t => t.type === 'DIVIDEND').reduce((s, t) => s + t.amount, 0);
          const yearStockTxs = stockTransactions?.filter(t => t.side === 'SELL' && new Date(t.date).getFullYear() === year) || [];
          const stockProfit = yearStockTxs.reduce((s, t) => s + (t.realizedProfit || 0), 0);
          const stockIncome = dividend + stockProfit;

          // Debt payments for this year
          let debtPayments = 0;
          assets.filter(a => a.type === AssetType.DEBT).forEach(debt => {
              if (debt.startDate) {
                  const start = new Date(debt.startDate);
                  // Approximate: if started this year, count months from start to end of year or now.
                  // For simplicity, let's just count how many months it was active this year.
                  const startMonth = start.getFullYear() === year ? start.getMonth() : (start.getFullYear() < year ? 0 : 12);
                  const endMonth = now.getFullYear() === year ? now.getMonth() : 11;
                  const activeMonths = Math.max(0, endMonth - startMonth + 1);
                  debtPayments += Math.round(calculateEstimatedMonthlyPayment(debt)) * activeMonths;
              } else {
                  // Assume active for full 12 months if no start date, or up to current month if current year
                  const activeMonths = now.getFullYear() === year ? now.getMonth() + 1 : 12;
                  debtPayments += Math.round(calculateEstimatedMonthlyPayment(debt)) * activeMonths;
              }
          });

          const totalExpense = expense + debtPayments;
          const netIncome = income + stockIncome - totalExpense;

          data.push({
              year: yearStr,
              netIncome,
              income,
              stockIncome,
              expense,
              debtPayments
          });
      }
      return data;
  }, [transactions, stockTransactions, assets, now]);

  // 2. All Debts Overview with Grace Period
  const allDebtPayments = useMemo(() => {
      return assets.filter(a => a.type === AssetType.DEBT).map(debt => {
          let graceMonthsLeft = null;
          if (debt.startDate && debt.interestOnlyPeriod) {
              const start = new Date(debt.startDate);
              const graceEnd = new Date(start.setFullYear(start.getFullYear() + debt.interestOnlyPeriod));
              if (graceEnd > now) {
                  graceMonthsLeft = (graceEnd.getFullYear() - now.getFullYear()) * 12 + (graceEnd.getMonth() - now.getMonth());
              }
          }
          return {
              id: debt.id,
              name: debt.name,
              amount: debt.amount,
              estimatedPayment: Math.round(calculateEstimatedMonthlyPayment(debt)),
              graceMonthsLeft
          };
      }).sort((a, b) => b.estimatedPayment - a.estimatedPayment);
  }, [assets, now]);

  // 3. Budget Execution Progress
  const budgetProgressData = useMemo(() => {
      const currentMonthTransactions = transactions.filter(t => {
          const txDate = new Date(t.date);
          return txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth;
      });

      return budgets?.map(b => {
          const spent = currentMonthTransactions
              .filter(t => t.category === b.category && t.type === 'EXPENSE')
              .reduce((sum, t) => sum + t.amount, 0);
          return { 
              name: b.category, 
              spent, 
              limit: b.limit,
              percentage: b.limit > 0 ? (spent / b.limit) * 100 : 0 
          };
      }).sort((a, b) => b.percentage - a.percentage) || [];
  }, [budgets, transactions, currentMonth, currentYear]);

  return (
    <div className="space-y-6 animate-fade-in p-2 md:p-6 pb-24">
      {/* 1. Daily Reminder / Inline Quick Add */}
      {!hasRecordedToday && (
         <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg shadow-amber-500/5">
            <div className="flex items-center gap-3">
              <div className="bg-amber-500/20 p-2 rounded-full text-amber-500 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-amber-400 font-bold text-sm">今日尚未記帳</h3>
                <p className="text-slate-400 text-xs mt-0.5">順手記下一筆，讓財務更清晰。</p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
                <input 
                    type="text" 
                    placeholder="項目 (如: 晚餐)" 
                    value={quickItem} 
                    onChange={e => setQuickItem(e.target.value)} 
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500 w-full md:w-32 placeholder:text-slate-500" 
                    onKeyDown={e => e.key === 'Enter' && handleQuickAdd()}
                />
                <input 
                    type="number" 
                    placeholder="金額" 
                    value={quickAmount} 
                    onChange={e => setQuickAmount(e.target.value)} 
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500 w-full md:w-24 placeholder:text-slate-500" 
                    onKeyDown={e => e.key === 'Enter' && handleQuickAdd()}
                />
                <Button 
                    variant="primary" 
                    onClick={handleQuickAdd} 
                    disabled={!quickItem || !quickAmount} 
                    className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold px-4 py-1.5 text-sm whitespace-nowrap border-none disabled:opacity-50"
                >
                    快速記帳
                </Button>
            </div>
         </div>
      )}

      {/* 2. Key Metrics Cards (Interactive) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card 
            className="bg-gradient-to-br from-primary/20 to-slate-800 border-primary/30 relative overflow-hidden group cursor-pointer hover:scale-[1.02] hover:shadow-xl transition-all"
            onClick={() => onChangeView('ASSETS')}
        >
            <div className="absolute right-[-20px] top-[-20px] opacity-10 group-hover:opacity-20 transition-opacity">
                <Sparkles size={100} />
            </div>
            <div className="text-primary-300 text-sm font-medium mb-2 flex items-center gap-2">
                <TrendingUp size={16}/> 淨資產總額 (Net Worth)
            </div>
            <div className="text-4xl font-bold text-white tracking-tight font-mono">
              ${netWorth.toLocaleString()}
            </div>
            <div className="mt-4 text-xs text-slate-400 group-hover:text-primary-300 transition-colors">
               資產 - 負債 (系統即時結算)
            </div>
        </Card>
        
        <Card 
            className="cursor-pointer hover:scale-[1.02] hover:shadow-xl hover:border-emerald-500/50 transition-all group flex flex-col justify-between"
            onClick={() => onChangeView('ASSETS')}
        >
            <div>
                <div className="text-slate-400 text-sm font-medium mb-2 flex items-center gap-2 group-hover:text-emerald-400 transition-colors">
                    <Wallet size={16} className="text-emerald-400"/> 總資產 (Assets)
                </div>
                <div className="text-3xl font-bold text-white tracking-tight font-mono mb-2">
                  ${totalAssets.toLocaleString()}
                </div>
            </div>
            
            {/* Asset Allocation Breakdown */}
            {totalAssets > 0 && (
                <div className="mt-auto">
                    <div className="flex gap-x-3 gap-y-1 text-xs text-slate-400 flex-wrap">
                        {dataByType.sort((a, b) => b.value - a.value).slice(0, 3).map(d => (
                            <div key={d.typeCode} className="flex items-center gap-1 group-hover:text-slate-300 transition-colors">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ASSET_TYPE_COLORS[d.typeCode] || '#94a3b8' }}></div>
                                <span>{d.name} {((d.value / totalAssets) * 100).toFixed(0)}%</span>
                            </div>
                        ))}
                        {dataByType.length > 3 && <span className="text-xs">...</span>}
                    </div>
                </div>
            )}
        </Card>

        <Card 
            className="cursor-pointer hover:scale-[1.02] hover:shadow-xl hover:border-red-500/50 transition-all group flex flex-col justify-between"
            onClick={() => {
                window.location.hash = 'debt';
                onChangeView('ASSETS');
            }}
        >
            <div>
                <div className="text-slate-400 text-sm font-medium mb-2 flex items-center gap-2 group-hover:text-red-400 transition-colors">
                    <CreditCard size={16} className="text-red-400"/> 總負債 (Debt)
                </div>
                <div className="text-3xl font-bold text-red-400 tracking-tight font-mono mb-2">
                  ${totalDebt.toLocaleString()}
                </div>
            </div>

            {/* Debt Breakdown */}
            {totalDebt > 0 && (
                <div className="mt-auto">
                    <div className="flex gap-x-3 gap-y-1 text-xs text-slate-400 flex-wrap">
                        {assets.filter(a => a.type === AssetType.DEBT).sort((a, b) => b.amount - a.amount).slice(0, 3).map(d => (
                            <div key={d.id} className="flex items-center gap-1 group-hover:text-red-300 transition-colors">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                                <span>{d.name} {((d.amount / totalDebt) * 100).toFixed(0)}%</span>
                            </div>
                        ))}
                        {assets.filter(a => a.type === AssetType.DEBT).length > 3 && <span className="text-xs">...</span>}
                    </div>
                </div>
            )}
        </Card>
      </div>

      {/* Bento Grid layout */}
      <div className="flex flex-col gap-6">
          {/* Main View (Full width) - Charts Tabs */}
          <div className="w-full">
              <Card className="border-slate-700/50 bg-slate-900/40 h-[400px] flex flex-col">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-slate-800 pb-4">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(var(--color-primary),0.2)]">
                            <BarChart3 size={20}/>
                         </div>
                         <div>
                            <h3 className="text-lg font-bold text-white">
                                {activeMainChart === 'WATERFALL' ? '資產配置演進' : activeMainChart === 'TREND' ? '總資產與負債趨勢' : activeMainChart === 'MONTHLY_INCOME' ? '歷史月度淨收益' : activeMainChart === 'ANNUAL_INCOME' ? '歷史年度淨收益' : '本月金流與分類'}
                            </h3>
                            <p className="text-xs text-slate-400">
                                {activeMainChart === 'WATERFALL' ? '各類資產的成長貢獻' : activeMainChart === 'TREND' ? '歷史資產累積與淨值變化' : activeMainChart === 'MONTHLY_INCOME' ? '每月最終結算之正負收益' : activeMainChart === 'ANNUAL_INCOME' ? '年度最終結算之正負收益' : '每日收入與支出分佈 (含股票收益)'}
                            </p>
                         </div>
                      </div>
                      <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700 flex-wrap gap-1">
                          <button onClick={() => setActiveMainChart('TREND')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${activeMainChart === 'TREND' ? 'bg-primary text-white shadow' : 'text-slate-400 hover:text-white'}`}>資產趨勢</button>
                          <button onClick={() => setActiveMainChart('WATERFALL')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${activeMainChart === 'WATERFALL' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>資產演進</button>
                          <button onClick={() => setActiveMainChart('CASH_FLOW')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${activeMainChart === 'CASH_FLOW' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>本月金流</button>
                          <button onClick={() => setActiveMainChart('MONTHLY_INCOME')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${activeMainChart === 'MONTHLY_INCOME' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>月度收支</button>
                          <button onClick={() => setActiveMainChart('ANNUAL_INCOME')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${activeMainChart === 'ANNUAL_INCOME' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>年度收支</button>
                      </div>
                  </div>
                  
                  <div className="flex-1 w-full min-h-0">
                      {activeMainChart === 'WATERFALL' ? (
                          <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={historyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                  <defs>
                                      <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.8}/>
                                          <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.2}/>
                                      </linearGradient>
                                      <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor="#818cf8" stopOpacity={0.8}/>
                                          <stop offset="95%" stopColor="#818cf8" stopOpacity={0.2}/>
                                      </linearGradient>
                                      <linearGradient id="colorFund" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.8}/>
                                          <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.2}/>
                                      </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                  <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickCount={5} dy={10}/>
                                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${(val/10000).toFixed(0)}萬`} width={55}/>
                                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }} itemStyle={{ color: '#fff', fontSize: '12px', padding: 0 }} formatter={(val: number, name: string) => [`NT$ ${val.toLocaleString()}`, name === 'cash' ? '現金' : name === 'stock' ? '股票' : name === 'fund' ? '基金/其他' : name]}/>
                                  <Area type="monotone" dataKey="cash" name="現金" stroke="#38bdf8" fill="url(#colorCash)" />
                                  <Area type="monotone" dataKey="stock" name="股票" stroke="#818cf8" fill="url(#colorStock)" />
                                  <Area type="monotone" dataKey="fund" name="基金/其他" stroke="#a78bfa" fill="url(#colorFund)" />
                              </AreaChart>
                          </ResponsiveContainer>
                      ) : activeMainChart === 'TREND' ? (
                          <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={historyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                  <defs>
                                      <linearGradient id="colorDashAssets" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                      </linearGradient>
                                      <linearGradient id="colorDashDebt" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                      </linearGradient>
                                      <linearGradient id="colorDashNet" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                      </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                  <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickMargin={10} minTickGap={20} />
                                  <YAxis yAxisId="left" stroke="#64748b" fontSize={10} tickFormatter={(val) => `${(val / 10000).toFixed(0)}萬`} width={60} />
                                  <Tooltip 
                                      contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }}
                                      itemStyle={{ color: '#e2e8f0' }}
                                      formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name]}
                                  />
                                  <Area yAxisId="left" type="monotone" dataKey="totalAssets" name="總資產" stroke="#10b981" fill="url(#colorDashAssets)" strokeWidth={2} />
                                  <Area yAxisId="left" type="monotone" dataKey="totalDebt" name="總負債" stroke="#ef4444" fill="url(#colorDashDebt)" strokeWidth={2} />
                                  <Area yAxisId="left" type="monotone" dataKey="netWorth" name="淨資產" stroke="#3b82f6" fill="url(#colorDashNet)" strokeWidth={2} />
                              </AreaChart>
                          </ResponsiveContainer>
                      ) : activeMainChart === 'MONTHLY_INCOME' ? (
                          <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={historicalMonthlyIncomeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                  <XAxis dataKey="month" stroke="#64748b" fontSize={10} tickMargin={10} />
                                  <YAxis stroke="#64748b" fontSize={10} tickFormatter={(val) => `${(val / 10000).toFixed(0)}萬`} width={60} />
                                  <Tooltip 
                                      cursor={{ fill: '#334155', opacity: 0.2 }}
                                      content={({ active, payload, label }) => {
                                          if (active && payload && payload.length) {
                                              const data = payload[0].payload;
                                              const isPositive = data.netIncome >= 0;
                                              return (
                                                  <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-xl text-sm min-w-[150px]">
                                                      <p className="font-bold text-slate-300 mb-2 border-b border-slate-700 pb-1">{label}</p>
                                                      <div className="flex justify-between gap-4 mb-1">
                                                          <span className="text-slate-400">一般收入</span>
                                                          <span className="text-emerald-400 font-mono">+${data.income.toLocaleString()}</span>
                                                      </div>
                                                      <div className="flex justify-between gap-4 mb-1">
                                                          <span className="text-slate-400">股票收益</span>
                                                          <span className="text-sky-400 font-mono">+${data.stockIncome.toLocaleString()}</span>
                                                      </div>
                                                      <div className="flex justify-between gap-4 mb-1">
                                                          <span className="text-slate-400">一般支出</span>
                                                          <span className="text-rose-400 font-mono">-${data.expense.toLocaleString()}</span>
                                                      </div>
                                                      <div className="flex justify-between gap-4 mb-2">
                                                          <span className="text-slate-400">各項貸款預估</span>
                                                          <span className="text-rose-400 font-mono">-${data.debtPayments.toLocaleString()}</span>
                                                      </div>
                                                      <div className="flex justify-between gap-4 pt-2 border-t border-slate-700 font-bold">
                                                          <span className="text-slate-200">當月淨收益</span>
                                                          <span className={`font-mono ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                                                              {isPositive ? '+' : ''}${data.netIncome.toLocaleString()}
                                                          </span>
                                                      </div>
                                                  </div>
                                              );
                                          }
                                          return null;
                                      }}
                                  />
                                  <ReferenceLine y={0} stroke="#475569" strokeWidth={2} />
                                  <Bar dataKey="netIncome" radius={[4, 4, 4, 4]} maxBarSize={60}>
                                      {historicalMonthlyIncomeData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={entry.netIncome >= 0 ? '#10b981' : '#ef4444'} />
                                      ))}
                                  </Bar>
                              </BarChart>
                          </ResponsiveContainer>
                      ) : activeMainChart === 'ANNUAL_INCOME' ? (
                          <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={historicalAnnualIncomeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                  <XAxis dataKey="year" stroke="#64748b" fontSize={10} tickMargin={10} />
                                  <YAxis stroke="#64748b" fontSize={10} tickFormatter={(val) => `${(val / 10000).toFixed(0)}萬`} width={60} />
                                  <Tooltip 
                                      cursor={{ fill: '#334155', opacity: 0.2 }}
                                      content={({ active, payload, label }) => {
                                          if (active && payload && payload.length) {
                                              const data = payload[0].payload;
                                              const isPositive = data.netIncome >= 0;
                                              return (
                                                  <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-xl text-sm min-w-[150px]">
                                                      <p className="font-bold text-slate-300 mb-2 border-b border-slate-700 pb-1">{label}</p>
                                                      <div className="flex justify-between gap-4 mb-1">
                                                          <span className="text-slate-400">一般收入</span>
                                                          <span className="text-emerald-400 font-mono">+${data.income.toLocaleString()}</span>
                                                      </div>
                                                      <div className="flex justify-between gap-4 mb-1">
                                                          <span className="text-slate-400">股票收益</span>
                                                          <span className="text-sky-400 font-mono">+${data.stockIncome.toLocaleString()}</span>
                                                      </div>
                                                      <div className="flex justify-between gap-4 mb-1">
                                                          <span className="text-slate-400">一般支出</span>
                                                          <span className="text-rose-400 font-mono">-${data.expense.toLocaleString()}</span>
                                                      </div>
                                                      <div className="flex justify-between gap-4 mb-2">
                                                          <span className="text-slate-400">各項貸款預估</span>
                                                          <span className="text-rose-400 font-mono">-${data.debtPayments.toLocaleString()}</span>
                                                      </div>
                                                      <div className="flex justify-between gap-4 pt-2 border-t border-slate-700 font-bold">
                                                          <span className="text-slate-200">年度淨收益</span>
                                                          <span className={`font-mono ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                                                              {isPositive ? '+' : ''}${data.netIncome.toLocaleString()}
                                                          </span>
                                                      </div>
                                                  </div>
                                              );
                                          }
                                          return null;
                                      }}
                                  />
                                  <ReferenceLine y={0} stroke="#475569" strokeWidth={2} />
                                  <Bar dataKey="netIncome" radius={[4, 4, 4, 4]} maxBarSize={60}>
                                      {historicalAnnualIncomeData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={entry.netIncome >= 0 ? '#10b981' : '#ef4444'} />
                                      ))}
                                  </Bar>
                              </BarChart>
                          </ResponsiveContainer>
                      ) : (
                          <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={cashFlowData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                  <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => Math.abs(val) >= 10000 ? `${(val/10000).toFixed(0)}萬` : Math.abs(val) >= 1000 ? `${(val/1000).toFixed(0)}千` : `$${val}`} />
                                  <Tooltip cursor={{ fill: '#1e293b', opacity: 0.4 }} contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }} itemStyle={{ color: '#fff', fontSize: '12px' }} labelFormatter={(label) => `${currentMonth + 1}月${label}日`} formatter={(value: number, name: string) => { const isExp = name.startsWith('exp_'); const displayName = isExp ? name.replace('exp_', '') : name === 'income' ? '一般收入' : name === 'stockIncome' ? '股票收益' : name; return [`$${Math.abs(value).toLocaleString()}`, displayName]; }}/>
                                  <ReferenceLine y={0} stroke="#334155" />
                                  <Bar dataKey="income" name="income" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} maxBarSize={40} />
                                  <Bar dataKey="stockIncome" name="stockIncome" stackId="a" fill="#38bdf8" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                  {expenseCategories.map((cat, idx) => {
                                      const colors = ['#ef4444', '#f97316', '#f59e0b', '#ec4899', '#8b5cf6', '#d946ef', '#14b8a6', '#06b6d4'];
                                      return <Bar key={cat} dataKey={`exp_${cat}`} name={`exp_${cat}`} stackId="b" fill={colors[idx % colors.length]} radius={idx === 0 ? [0, 0, 4, 4] : [0, 0, 0, 0]} maxBarSize={40} />;
                                  })}
                              </BarChart>
                          </ResponsiveContainer>
                      )}
                  </div>
              </Card>
          </div>

          {/* Bottom layout */}
          <div className="w-full">
                 {/* Debt Overview Card */}
                 <Card className="border-slate-700/50 bg-slate-900/40 p-6 flex flex-col">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-slate-800 pb-4">
                          <div className="flex items-center gap-2">
                              <Target size={20} className="text-amber-400" />
                              <h3 className="font-bold text-white text-lg">每月還款總覽</h3>
                          </div>
                          {allDebtPayments.length > 0 && (
                              <div className="flex items-center gap-3 bg-red-500/10 px-4 py-2 rounded-lg border border-red-500/30">
                                  <span className="text-sm font-bold text-red-200">總計應繳</span>
                                  <span className="text-2xl font-black text-red-400 font-mono">
                                      ${allDebtPayments.reduce((s, d) => s + d.estimatedPayment, 0).toLocaleString()}
                                  </span>
                                  <span className="text-xs text-red-400/70">/ 月</span>
                              </div>
                          )}
                      </div>

                      {allDebtPayments.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {allDebtPayments.map(debt => (
                                  <div key={debt.id} className="flex items-center justify-between bg-slate-800/50 p-3 rounded-lg border border-slate-700 hover:border-slate-500 transition-colors">
                                      <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                                              <CreditCard size={14} className="text-red-400" />
                                          </div>
                                          <div className="flex flex-col">
                                              <div className="flex items-center gap-2">
                                                  <p className="font-bold text-slate-200 text-sm">{debt.name}</p>
                                                  {debt.graceMonthsLeft !== null && (
                                                      <div className="flex items-center gap-1 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                                          <AlertTriangle size={10} className="text-amber-400" />
                                                          <span className="text-[10px] font-bold text-amber-400">寬限 {debt.graceMonthsLeft} 月</span>
                                                      </div>
                                                  )}
                                              </div>
                                              <p className="text-xs text-slate-500">總額: ${debt.amount.toLocaleString()}</p>
                                          </div>
                                      </div>
                                      
                                      <div className="flex items-baseline gap-1 text-right">
                                          <span className="font-bold text-red-400 font-mono text-base">
                                              {debt.estimatedPayment > 0 ? `$${debt.estimatedPayment.toLocaleString()}` : '未設定'}
                                          </span>
                                          {debt.estimatedPayment > 0 && <span className="text-[10px] text-slate-500">/月</span>}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      ) : (
                          <div className="flex flex-col items-center justify-center text-center opacity-50 py-12 bg-slate-800/20 rounded-xl border border-slate-700/30 border-dashed">
                              <Flag size={40} className="text-slate-600 mb-3" />
                              <p className="text-slate-400 text-sm">目前沒有任何貸款項目</p>
                              <Button variant="ghost" onClick={() => { window.location.hash = 'debt'; onChangeView('ASSETS'); }} className="text-xs mt-2">前往設定</Button>
                          </div>
                      )}
                 </Card>
          </div>
      </div>
    </div>
  );
};
