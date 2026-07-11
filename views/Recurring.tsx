

import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button, Modal, Input, Select } from '../components/ui';
import { RecurringItem } from '../types';
import { 
  RefreshCw, CheckCircle2, Wallet, Flame, 
  PiggyBank, Sparkles, Calendar, Trash2, Settings2, CalendarClock, Plus,
  Clock
} from 'lucide-react';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../constants';

interface RecurringProps {
  items: RecurringItem[];
  executedLog: Record<string, string[]>;
  onAdd: (item: RecurringItem) => void;
  onExecute: (item: RecurringItem, date: string) => void;
  onDelete: (id: string) => void;
}

const CATEGORY_KEYWORDS: Record<string, string> = {
  'netflix': '娛樂', 'spotify': '娛樂', 'youtube': '娛樂', 'disney': '娛樂', 'game': '娛樂', 'steam': '娛樂',
  '房租': '居住', '水電': '居住', '瓦斯': '居住', '管理費': '居住', '房貸': '居住',
  '健身': '醫療', '保險': '醫療', '健保': '醫療',
  '手機': '帳單', '網路': '帳單', '電信': '帳單', '信用卡': '帳單',
  '薪水': '薪資', '薪資': '薪資', '獎金': '獎金',
  '股息': '股息', '配息': '股息',
  '捷運': '交通', '月票': '交通', '車貸': '交通',
  '老婆': '家庭', '家用': '家庭', '雜費': '家庭', '孝親': '家庭', '小孩': '家庭', '學費': '教育'
};

export const Recurring: React.FC<RecurringProps> = ({ items, executedLog, onAdd, onExecute, onDelete }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<RecurringItem>>({
    type: 'EXPENSE',
    frequency: 'MONTHLY',
    dayOfMonth: 1,
    monthOfYear: 1
  });



  const stats = useMemo(() => {
    let income = 0;
    let expense = 0;
    items.forEach(item => {
      const monthlyAmount = item.frequency === 'YEARLY' ? Math.round(item.amount / 12) : item.amount;
      if (item.type === 'INCOME') income += monthlyAmount;
      else expense += monthlyAmount;
    });
    return { 
      income, 
      expense, 
      balance: income - expense, 
      savingsRate: income > 0 ? ((income - expense) / income) * 100 : 0 
    };
  }, [items]);

  const currentMonthKey = new Date().toISOString().substring(0, 7); // YYYY-MM
  const currentMonth = new Date().getMonth() + 1;

  const isExecuted = (id: string) => {
    return executedLog[id]?.includes(currentMonthKey);
  };

  const handleOpenModal = () => {
    setFormData({ 
        type: 'EXPENSE', 
        frequency: 'MONTHLY', 
        dayOfMonth: 1, 
        monthOfYear: currentMonth,
        category: '家庭' 
    });
    setIsModalOpen(true);
  };

  const handleNameBlur = () => {
    if (formData.name) {
      const lowerName = formData.name.toLowerCase();
      for (const key in CATEGORY_KEYWORDS) {
        if (lowerName.includes(key)) {
          setFormData(prev => ({ ...prev, category: CATEGORY_KEYWORDS[key] }));
          break;
        }
      }
    }
  };

  const handleSubmit = () => {
    if(!formData.name || !formData.amount) return;
    onAdd({
        id: crypto.randomUUID(),
        name: formData.name,
        amount: Number(formData.amount),
        category: formData.category || '其他',
        type: formData.type as 'EXPENSE' | 'INCOME',
        frequency: (formData.frequency as 'MONTHLY' | 'YEARLY') || 'MONTHLY',
        dayOfMonth: Number(formData.dayOfMonth) || 1,
        monthOfYear: formData.frequency === 'YEARLY' ? (Number(formData.monthOfYear) || 1) : undefined
    });
    setIsModalOpen(false);
  };



  return (
    <div className="space-y-6 animate-fade-in p-2 md:p-6 pb-24">
       
       <div className="flex justify-between items-center mb-6">
         <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <CalendarClock className="text-cyan-400"/> 固定收支
            </h2>
            <p className="text-xs text-slate-400 mt-1">管理訂閱服務、房租與定期扣款項目</p>
         </div>
         <button 
             onClick={handleOpenModal} 
             className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition-all active:scale-95"
             title="新增固定項目"
         >
            <Plus size={16}/> 
            <span className="hidden md:inline">新增固定項目</span>
         </button>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 flex items-center justify-between relative overflow-hidden group">
             <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors"></div>
             <div>
                <p className="text-slate-400 text-sm font-medium mb-1">每月固定總收入 (含年攤提)</p>
                <h3 className="text-3xl font-bold text-emerald-400 font-mono tracking-tight">
                   ${stats.income.toLocaleString()}
                </h3>
             </div>
             <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                <Wallet size={24} />
             </div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 flex items-center justify-between relative overflow-hidden group">
             <div className="absolute right-0 top-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl group-hover:bg-red-500/10 transition-colors"></div>
             <div>
                <p className="text-slate-400 text-sm font-medium mb-1">每月固定總支出 (含年攤提)</p>
                <h3 className="text-3xl font-bold text-red-400 font-mono tracking-tight">
                   ${stats.expense.toLocaleString()}
                </h3>
             </div>
             <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 border border-red-500/20">
                <Flame size={24} />
             </div>
          </div>
       </div>

       <div className="bg-[#151f32] border border-slate-700 rounded-2xl p-5 flex flex-col md:flex-row items-center gap-6 shadow-xl relative overflow-hidden">
          <div className="flex-1 space-y-1 z-10 w-full">
             <div className="flex items-center gap-2 mb-2">
                <Sparkles size={16} className="text-cyan-400 animate-pulse"/>
                <h3 className="font-bold text-white text-lg">財務狀況健康簡單診斷</h3>
             </div>
             <div className="flex gap-6 text-sm">
                <div>
                   <span className="text-slate-400 block text-xs">預估每月結餘</span>
                   <span className={`font-mono text-lg font-bold ${stats.balance >= 0 ? 'text-white' : 'text-red-400'}`}>
                      ${stats.balance.toLocaleString()}
                   </span>
                </div>
                <div>
                   <span className="text-slate-400 block text-xs">儲蓄率</span>
                   <span className={`font-mono text-lg font-bold ${stats.savingsRate > 20 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {stats.savingsRate.toFixed(1)}%
                   </span>
                </div>
             </div>
          </div>
          <div className="absolute left-0 bottom-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-primary opacity-50"></div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map(item => {
             const executed = isExecuted(item.id);
             const isYearlyDue = item.frequency === 'YEARLY' && item.monthOfYear === currentMonth;
             const dateLabel = item.frequency === 'YEARLY' 
                ? `每年 ${item.monthOfYear} 月 ${item.dayOfMonth} 號`
                : `每月 ${item.dayOfMonth} 號`;
             
             // Calculate visual status
             const isOverdue = !executed && new Date().getDate() >= item.dayOfMonth;
             
             return (
               <div key={item.id} className={`bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden flex flex-col transition-all hover:border-slate-600 hover:shadow-lg ${executed ? 'opacity-80' : 'border-l-4 border-l-primary'}`}>
                  <div className="p-5 flex-1 relative">
                     <div className="flex justify-between items-start mb-3">
                        <div className="flex gap-2">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-700 text-slate-300 border border-slate-600">
                                {item.category}
                            </span>
                            {item.frequency === 'YEARLY' && (
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${isYearlyDue ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                                    {isYearlyDue ? '本月到期' : '年繳'}
                                </span>
                            )}
                        </div>
                        <button 
                           onClick={() => onDelete(item.id)} 
                           className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-red-500/20 hover:text-red-500 transition-all"
                        >
                           <Trash2 size={18}/>
                        </button>
                     </div>
                     
                     <h3 className="text-xl font-bold text-white mb-1 truncate" title={item.name}>{item.name}</h3>
                     
                     <div className="flex items-center gap-2 text-slate-400 text-xs mb-4">
                        <Calendar size={12}/> {dateLabel}
                     </div>

                     <div className={`text-2xl font-mono font-bold ${item.type === 'INCOME' ? 'text-emerald-400' : 'text-red-400'}`}>
                        ${item.amount.toLocaleString()}
                     </div>
                  </div>

                  {/* Status Bar */}
                  <div className={`p-2.5 border-t border-slate-700/50 flex items-center justify-center gap-2 text-xs font-bold ${executed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-900/50 text-slate-400'}`}>
                     {executed ? (
                         <>
                            <CheckCircle2 size={14} /> 本月已自動入帳
                         </>
                     ) : (
                         <>
                            <Clock size={14} /> {isOverdue ? '等待系統排程...' : '等待到期自動入帳'}
                         </>
                     )}
                  </div>
               </div>
             );
          })}
          
          {items.length === 0 && (
             <div onClick={handleOpenModal} className="col-span-full border-2 border-dashed border-slate-700 rounded-2xl h-40 flex flex-col items-center justify-center text-slate-500 hover:text-primary hover:border-primary/50 hover:bg-slate-800/50 cursor-pointer transition-all gap-2">
                <RefreshCw size={24} className="mb-2"/>
                <p>尚無固定項目，點擊新增</p>
             </div>
          )}
       </div>

       <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="新增固定項目">
           {/* Modal content unchanged */}
          <div className="space-y-6">
             <div>
                <label className="block text-sm text-slate-400 mb-2 font-medium">項目名稱 (Name)</label>
                <Input 
                    placeholder="例如：Netflix、房貸、年繳保費..." 
                    value={formData.name || ''} 
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    onBlur={handleNameBlur}
                    className="text-lg bg-slate-900 border-slate-700 focus:border-primary"
                />
             </div>

             <div>
                <label className="block text-sm text-slate-400 mb-2 font-medium">收支類型 (Type)</label>
                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={() => setFormData({...formData, type: 'EXPENSE'})}
                        className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-200 group ${
                            formData.type === 'EXPENSE' 
                            ? 'bg-red-500/20 border-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.3)]' 
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800 hover:border-slate-600'
                        }`}
                    >
                        <Flame size={28} className={`mb-2 ${formData.type === 'EXPENSE' ? 'text-white' : 'text-red-400'} group-hover:scale-110 transition-transform`} />
                        <span className="text-sm font-bold">固定支出 (Expense)</span>
                    </button>
                    <button 
                        onClick={() => setFormData({...formData, type: 'INCOME'})}
                        className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-200 group ${
                            formData.type === 'INCOME' 
                            ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]' 
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800 hover:border-slate-600'
                        }`}
                    >
                        <Wallet size={28} className={`mb-2 ${formData.type === 'INCOME' ? 'text-white' : 'text-emerald-400'} group-hover:scale-110 transition-transform`} />
                        <span className="text-sm font-bold">固定收入 (Income)</span>
                    </button>
                </div>
             </div>

             <div className="relative border border-slate-700 rounded-xl p-4 bg-slate-900/30">
                 <div className="absolute -top-3 left-3 bg-slate-800 px-2 text-xs font-bold text-cyan-400 flex items-center gap-1">
                    <Settings2 size={12}/> 設定細節
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4 mb-4">
                     <div>
                        <label className="block text-[10px] text-slate-500 mb-1 uppercase">頻率</label>
                        <Select 
                            value={formData.frequency} 
                            onChange={e => setFormData({...formData, frequency: e.target.value as 'MONTHLY' | 'YEARLY'})} 
                            className="bg-slate-900 h-12"
                        >
                            <option value="MONTHLY">每月 (Monthly)</option>
                            <option value="YEARLY">每年 (Yearly)</option>
                        </Select>
                     </div>
                     <div>
                        <label className="block text-[10px] text-slate-500 mb-1 uppercase">金額</label>
                        <Input 
                            type="number" 
                            value={formData.amount || ''} 
                            onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})}
                            className="font-mono text-xl h-12 bg-slate-900 border-slate-700 focus:border-primary"
                            placeholder="0"
                        />
                     </div>
                 </div>

                 <div className="pt-3 border-t border-slate-700/50">
                    <label className="block text-[10px] text-slate-500 mb-2 uppercase flex items-center gap-2">
                        <CalendarClock size={12}/> 扣款/入帳日
                    </label>
                    <div className="flex gap-2">
                        {formData.frequency === 'YEARLY' && (
                            <div className="w-1/2">
                                <Select 
                                    value={formData.monthOfYear} 
                                    onChange={e => setFormData({...formData, monthOfYear: parseFloat(e.target.value)})} 
                                    className="bg-slate-900"
                                >
                                    {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                                        <option key={m} value={m}>{m} 月</option>
                                    ))}
                                </Select>
                            </div>
                        )}
                        <div className="relative flex-1">
                            <Input 
                                type="number" 
                                placeholder="1-31" 
                                value={formData.dayOfMonth || ''} 
                                onChange={e => setFormData({...formData, dayOfMonth: parseFloat(e.target.value)})}
                                className="font-mono pr-8" 
                            />
                            <span className="absolute right-3 top-2.5 text-slate-500 text-xs font-bold">日</span>
                        </div>
                    </div>
                 </div>
             </div>

             <div>
               <label className="block text-sm text-slate-400 mb-2 font-medium">類別 (Category)</label>
               <Select 
                  value={formData.category} 
                  onChange={e => setFormData({...formData, category: e.target.value})}
                  className="bg-slate-900 border-slate-700 h-12 text-lg"
               >
                  <option value="">請選擇類別</option>
                  {(formData.type === 'EXPENSE' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map(c => (
                     <option key={c} value={c}>{c}</option>
                  ))}
               </Select>
             </div>

             <Button className="w-full py-3.5 text-lg font-bold shadow-xl shadow-primary/20 mt-2" onClick={handleSubmit}>
                確認新增
             </Button>
          </div>
       </Modal>
    </div>
  );
};
