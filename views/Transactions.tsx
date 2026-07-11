import React, { useState, useMemo, useRef } from 'react';
import { Transaction } from '../types';
import { 
  ScrollText, Plus, ChevronDown, ChevronUp, PieChart, UploadCloud, FileCheck2, Loader2, AlertTriangle, Pencil, X
} from 'lucide-react';
import { Button, Modal, Input, Select } from '../components/ui';
import { EXPENSE_CATEGORIES } from '../constants';

// Import New Refactored Components
import { TransactionStats } from '../components/transactions/TransactionStats';
import { TransactionFilters, TimeRange } from '../components/transactions/TransactionFilters';
import { TransactionCharts } from '../components/transactions/TransactionCharts';
import { TransactionList } from '../components/transactions/TransactionList';
import { AddTransactionModal } from '../components/transactions/TransactionModals';

interface TransactionsProps {
  transactions: Transaction[];
  onAdd: (t: Transaction) => void;
  onUpdate: (t: Transaction) => void;
  onDelete: (id: string) => void;
  initialFilter?: string;
}

interface ParsedInvoice {
    invoiceId: string;
    date: string;
    storeName: string;
    amount: number;
    items: string[];
}

interface ImportStats {
    total: number;
    new: number;
    skipped: number;
}

export const Transactions: React.FC<TransactionsProps> = ({ transactions, onAdd, onUpdate, onDelete, initialFilter = '' }) => {
  const [filter, setFilter] = useState(initialFilter);
  
  React.useEffect(() => {
    if (initialFilter) {
      setFilter(initialFilter);
    }
  }, [initialFilter]);
  const [timeRange, setTimeRange] = useState<TimeRange>('MONTH');
  const [showCharts, setShowCharts] = useState(false);
  
  // Custom Date Range State
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // UI State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  
  // Invoice Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [newInvoices, setNewInvoices] = useState<Transaction[]>([]);
  const [importStats, setImportStats] = useState<ImportStats>({ total: 0, new: 0, skipped: 0 });
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // --- New V5.5: Inline Editing State ---
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Transaction>>({});

  // --- V6.5.0 Refactored Data Processing ---
  const { filteredTransactions, dateRangeLabel } = useMemo(() => {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date(now);

    const formatDate = (d: Date) => `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;

    switch (timeRange) {
        case 'MONTH':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            break;
        case 'QUARTER':
            const quarter = Math.floor(now.getMonth() / 3);
            startDate = new Date(now.getFullYear(), quarter * 3, 1);
            endDate = new Date(now.getFullYear(), quarter * 3 + 3, 0);
            break;
        case 'HALF_YEAR':
            const half = Math.floor(now.getMonth() / 6); // 0 for H1, 1 for H2
            startDate = new Date(now.getFullYear(), half * 6, 1);
            endDate = new Date(now.getFullYear(), half * 6 + 6, 0);
            break;
        case 'YEAR':
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31);
            break;
        case 'CUSTOM':
            startDate = customStart ? new Date(customStart) : new Date(0);
            endDate = customEnd ? new Date(customEnd) : new Date();
            break;
        case 'ALL':
            startDate = new Date(0); // 1970/01/01
            endDate = new Date(); // Today
            break;
    }

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    
    const label = timeRange === 'ALL'
        ? '所有紀錄'
        : `${formatDate(startDate)} ~ ${formatDate(endDate)}`;

    const processedTransactions = transactions.filter(t => {
        if (!t.date) return false;
        
        const tDate = new Date(t.date);
        if (tDate < startDate || tDate > endDate) return false;

        if (filter) {
            const lowerFilter = filter.toLowerCase();
            return t.item.toLowerCase().includes(lowerFilter) || t.category.toLowerCase().includes(lowerFilter);
        }
        return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return { filteredTransactions: processedTransactions, dateRangeLabel: label };
  }, [transactions, timeRange, customStart, customEnd, filter]);
  
  // Layer 2: Calculate aggregate stats based on filtered data.
  const rangeStats = useMemo(() => {
    let income = 0;
    let expense = 0;
    filteredTransactions.forEach(t => {
      if (t.type === 'INCOME') income += t.amount;
      else expense += t.amount;
    });
    return { income, expense, balance: income - expense };
  }, [filteredTransactions]);
  
  // Layer 3: Format data for charts, also based on filtered data.
  const { dailyTrendData, expenseStructure } = useMemo(() => {
    const catMap: Record<string, number> = {};
    const dailyMap: Record<string, { income: number, expense: number }> = {};

    filteredTransactions.forEach(t => {
        if (t.type === 'EXPENSE') {
          catMap[t.category] = (catMap[t.category] || 0) + t.amount;
        }

        if (!dailyMap[t.date]) dailyMap[t.date] = { income: 0, expense: 0 };
        if (t.type === 'INCOME') dailyMap[t.date].income += t.amount;
        else dailyMap[t.date].expense += t.amount;
    });
    
    const trendData = Object.keys(dailyMap).sort().map(date => ({
        day: date.substring(5), // MM-DD
        income: dailyMap[date].income,
        expense: dailyMap[date].expense
    }));
    
    const totalExpense = rangeStats.expense;
    const structureData = Object.keys(catMap).map(cat => ({
        name: cat,
        value: catMap[cat],
        percent: totalExpense > 0 ? (catMap[cat] / totalExpense) * 100 : 0
    })).sort((a, b) => b.value - a.value);

    return { dailyTrendData: trendData, expenseStructure: structureData };
  }, [filteredTransactions, rangeStats.expense]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target?.result as string;
        await parseInvoiceCSV(text);
        setIsParsing(false);
    };
    reader.readAsText(file, 'utf-8');
    event.target.value = ''; // Reset file input
  };
  
  const parseInvoiceCSV = async (csvText: string) => {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    const invoiceMap = new Map<string, ParsedInvoice>();

    lines.forEach(line => {
        const parts = line.split('|');
        if (parts[0] === 'M') {
            const dateStr = parts[3];
            invoiceMap.set(parts[6], {
                invoiceId: parts[6],
                date: `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}`,
                storeName: parts[5],
                amount: parseInt(parts[7], 10),
                items: [],
            });
        } else if (parts[0] === 'D') {
            const invoice = invoiceMap.get(parts[1]);
            if (invoice) {
                invoice.items.push(parts[3]);
            }
        }
    });

    const parsedInvoices = Array.from(invoiceMap.values());
    const existingInvoiceIds = new Set(transactions.map(t => t.invoiceId));
    
    const newTransactions = parsedInvoices
        .filter(p => !existingInvoiceIds.has(p.invoiceId))
        .map((p): Transaction => {
            let category = '購物'; // Default

            return {
                id: crypto.randomUUID(),
                date: p.date,
                amount: p.amount,
                category,
                item: `[發票] ${p.storeName}`,
                note: p.items.join(', '),
                type: 'EXPENSE',
                invoiceId: p.invoiceId,
                source: 'INVOICE_CSV',
            };
        });
    
    setNewInvoices(newTransactions);
    setImportStats({
        total: parsedInvoices.length,
        new: newTransactions.length,
        skipped: parsedInvoices.length - newTransactions.length,
    });
    setIsImportModalOpen(true);
  };
  
  const handleConfirmImport = () => {
      newInvoices.forEach(t => onAdd(t));
      setIsImportModalOpen(false);
      setNewInvoices([]);
  };

  const handleModalSubmit = (t: Transaction) => {
      if (editingTransaction) {
          onUpdate(t);
      } else {
          onAdd(t);
      }
      setIsAddModalOpen(false);
      setEditingTransaction(null);
  };
  
  const handleModalClose = () => {
      setIsAddModalOpen(false);
      setEditingTransaction(null);
  };
  
  const handleStartEdit = (t: Transaction) => {
      setEditingTransaction(t);
  };

  // --- V5.5: Edit Handlers ---
  const handleStartInvoiceEdit = (transaction: Transaction) => {
      setEditingInvoiceId(transaction.id);
      setEditFormData({ ...transaction });
  };

  const handleCancelInvoiceEdit = () => {
      setEditingInvoiceId(null);
      setEditFormData({});
  };

  const handleSaveInvoiceEdit = () => {
      if (!editingInvoiceId) return;
      const updatedInvoices = newInvoices.map(inv => 
          inv.id === editingInvoiceId ? { ...inv, ...editFormData, amount: Number(editFormData.amount) } as Transaction : inv
      );
      setNewInvoices(updatedInvoices);
      handleCancelInvoiceEdit();
  };

  return (
    <div className="space-y-6 animate-fade-in p-2 md:p-6 pb-24">
      
      {/* Header */}
      <div className="flex justify-between items-center">
         <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <ScrollText className="text-amber-400" size={24}/> 收支記帳
            </h2>
            <p className="text-xs text-slate-400 mt-1">記錄每日開銷、收入與發票管理</p>
         </div>
         <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv"
              className="hidden"
            />
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsing}
              className="bg-slate-700 hover:bg-slate-600"
            >
              {isParsing ? <Loader2 size={16} className="animate-spin"/> : <UploadCloud size={16}/>}
              <span className="hidden md:inline">{isParsing ? '解析中...' : '匯入電子發票'}</span>
            </Button>
            <button 
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg shadow-lg shadow-primary/20 transition-all active:scale-95"
            >
                <Plus size={20}/> 
                <span className="hidden md:inline font-bold text-sm">新增紀錄</span>
            </button>
         </div>
      </div>

      {/* Stats & Filters */}
      <div>
          <TransactionStats 
            income={rangeStats.income} 
            expense={rangeStats.expense} 
            balance={rangeStats.balance} 
          />

          <TransactionFilters
            filter={filter} setFilter={setFilter}
            timeRange={timeRange} setTimeRange={setTimeRange}
            dateRangeLabel={dateRangeLabel}
            customStart={customStart} setCustomStart={setCustomStart}
            customEnd={customEnd} setCustomEnd={setCustomEnd}
          />
      </div>

      <div className="mt-4 mb-4">
          <button 
             onClick={() => setShowCharts(!showCharts)}
             className="w-full py-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-white transition-all"
          >
             {showCharts ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
             {showCharts ? '隱藏分析圖表' : '展開圖表分析 (趨勢與支出結構)'}
             {!showCharts && <PieChart size={14} className="ml-1 opacity-50"/>}
          </button>
      </div>

      {showCharts && (
          <TransactionCharts 
            dailyTrendData={dailyTrendData} 
            expenseStructure={expenseStructure} 
            hasExpense={rangeStats.expense > 0} 
          />
      )}

      <TransactionList 
        transactions={filteredTransactions} 
        onDelete={onDelete} 
        onEdit={handleStartEdit}
      />

      <AddTransactionModal 
        isOpen={isAddModalOpen || !!editingTransaction} 
        onClose={handleModalClose} 
        onSubmit={handleModalSubmit}
        editingData={editingTransaction}
      />
      
      <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title="電子發票匯入預覽">
          <div className="space-y-4">
              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 grid grid-cols-3 divide-x divide-slate-700 text-center">
                  <div>
                      <p className="text-xs text-slate-400">CSV總筆數</p>
                      <p className="text-xl font-bold font-mono text-white">{importStats.total}</p>
                  </div>
                  <div>
                      <p className="text-xs text-slate-400">本次新增</p>
                      <p className="text-xl font-bold font-mono text-emerald-400">{importStats.new}</p>
                  </div>
                  <div>
                      <p className="text-xs text-slate-400">重複跳過</p>
                      <p className="text-xl font-bold font-mono text-slate-500">{importStats.skipped}</p>
                  </div>
              </div>
              
              <h4 className="text-sm font-bold text-slate-300 pt-2">預計匯入 {importStats.new} 筆新交易：</h4>
              
              <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                  {newInvoices.map(t => (
                      editingInvoiceId === t.id ? (
                        <div key={t.id} className="bg-slate-700/80 p-3 rounded-lg space-y-3 border border-primary/50 shadow-lg">
                            <div>
                                <label className="text-xs text-slate-400">項目</label>
                                <Input value={editFormData.item} onChange={e => setEditFormData({...editFormData, item: e.target.value})} className="h-8 text-sm"/>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs text-slate-400">類別</label>
                                    <Select value={editFormData.category} onChange={e => setEditFormData({...editFormData, category: e.target.value})} className="h-8 text-sm">
                                        {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </Select>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400">金額</label>
                                    <Input type="number" value={editFormData.amount} onChange={e => setEditFormData({...editFormData, amount: Number(e.target.value)})} className="h-8 text-sm font-mono"/>
                                </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <Button onClick={handleCancelInvoiceEdit} variant="secondary" className="px-2 py-1 text-xs">取消</Button>
                                <Button onClick={handleSaveInvoiceEdit} className="px-2 py-1 text-xs">儲存</Button>
                            </div>
                        </div>
                      ) : (
                        <div key={t.id} className="bg-slate-800 p-2 rounded-lg flex justify-between items-center text-sm group hover:bg-slate-700/50">
                            <div>
                                <p className="font-bold text-white">{t.item}</p>
                                <p className="text-xs text-slate-400">{t.date} • {t.category}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <p className="font-mono text-slate-300">${t.amount.toLocaleString()}</p>
                                <button onClick={() => handleStartInvoiceEdit(t)} className="p-1.5 text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Pencil size={12}/>
                                </button>
                            </div>
                        </div>
                      )
                  ))}
                  {newInvoices.length === 0 && (
                    <div className="text-center py-10 text-slate-500 text-sm">
                        沒有可匯入的新發票紀錄。
                    </div>
                  )}
              </div>

              <div className="flex gap-2 pt-4 border-t border-slate-700">
                  <Button variant="secondary" onClick={() => setIsImportModalOpen(false)} className="flex-1">取消</Button>
                  <Button onClick={handleConfirmImport} disabled={newInvoices.length === 0} className="flex-1">
                      <FileCheck2 size={16} className="mr-2"/> 確認匯入
                  </Button>
              </div>
          </div>
      </Modal>
    </div>
  );
};