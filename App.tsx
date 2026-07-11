
import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './views/Dashboard';
import { Assets } from './views/Assets';
import { Transactions } from './views/Transactions';
import { Recurring } from './views/Recurring';
import { Settings } from './views/Settings';
import { GuideView } from './views/Guide';
import { Budget } from './views/Budget';
import { Investments } from './views/Investments';
import { TechDocs } from './views/TechDocs';
import { Watchlist } from './views/Watchlist';
import { DSSLab } from './views/DSSLab';
import { ViewState, Asset, Transaction, RecurringItem, AssetType, BudgetConfig, ApiKeyStatus, StockSnapshot, StockTransaction, Currency } from './types';
import * as storage from './services/storage';
import { calculateLoanBalance } from './services/finance';
import { CheckCircle2, X } from 'lucide-react';
import { useAutoTasks } from './hooks/useAutoTasks';
import { useStockEnrichment } from './hooks/useStockEnrichment';
import { useDailySnapshot } from './hooks/useDailySnapshot';

// Helper function to normalize stock symbols for comparison
const toNumericString = (s: string | undefined): string => {
    if (!s) return '';
    // Converts "0050", "50.0", "50" to "50" for consistent matching.
    const num = parseInt(s, 10);
    return isNaN(num) ? s.trim().toUpperCase() : String(num); // Keep non-numeric symbols as is
};


export default function App() {
  const [view, setView] = useState<ViewState>('DASHBOARD');
  
  // App State
  const [assets, setAssets] = useState<Asset[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurring, setRecurring] = useState<RecurringItem[]>([]);
  const [recurringExecuted, setRecurringExecuted] = useState<Record<string, string[]>>({});
  const [budgets, setBudgets] = useState<BudgetConfig[]>([]);
  const [stockHistory, setStockHistory] = useState<StockSnapshot[]>([]);
  const [stockTransactions, setStockTransactions] = useState<StockTransaction[]>([]);

  const [toast, setToast] = useState<{message: string, count: number} | null>(null);
  const [transactionFilter, setTransactionFilter] = useState('');

  // --- Refactored Hooks for Background Tasks ---
  // FIX: Destructure correct return values from the useStockEnrichment hook and derive the isEnrichingInBackground state.
  const { enrichStatus, updatePrices, updateDividends } = useStockEnrichment({ setToast });
  const isEnrichingInBackground = enrichStatus.price.isUpdating || enrichStatus.dividend.isUpdating;
  const { takePortfolioSnapshot, takeStockSnapshot } = useDailySnapshot({ assets, transactions, setStockHistory });

  const refreshData = useCallback(async () => {
    setAssets(storage.getAssets());
    setTransactions(storage.getTransactions());
    setRecurring(storage.getRecurring());
    setRecurringExecuted(storage.getRecurringExecuted());
    setBudgets(storage.getBudgets());
    setStockHistory(storage.getStockHistory());
    setStockTransactions(storage.getStockTransactions());
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // --- Auto-Update Debt Balances ---
  useEffect(() => {
    if (assets.length === 0) return;
    
    let updatedCount = 0;
    const newAssets = assets.map(asset => {
        if (asset.type === AssetType.DEBT && asset.startDate && asset.originalAmount) {
            const calculatedBalance = calculateLoanBalance(asset);
            if (Math.abs(calculatedBalance - asset.amount) > 1) {
                updatedCount++;
                return { ...asset, amount: calculatedBalance, lastUpdated: Date.now() };
            }
        }
        return asset;
    });

    if (updatedCount > 0) {
        setAssets(newAssets);
        storage.saveAssets(newAssets);
        setToast({ message: `已自動更新 ${updatedCount} 筆貸款的本月剩餘本金`, count: updatedCount });
        setTimeout(() => setToast(null), 5000);
    }
  }, [assets]); // Dependency is now correct

  // --- Auto-Execute Recurring Items Hook ---
  useAutoTasks({
      transactions,
      recurring,
      recurringExecuted,
      setTransactions,
      setRecurringExecuted,
      setToast
  });

  // Asset Handlers
  const addAsset = (asset: Asset) => {
    setAssets(prev => {
        const updated = [...prev, asset];
        storage.saveAssets(updated);
        return updated;
    });
  };

  const updateAsset = (asset: Asset) => {
    setAssets(prev => {
        const updated = prev.map(a => a.id === asset.id ? asset : a);
        storage.saveAssets(updated);
        return updated;
    });
  };

  const updateMultipleAssets = (updatedAssets: Asset[]) => {
    setAssets(prev => {
        const updatedMap = new Map(updatedAssets.map(a => [a.id, a]));
        const updated = prev.map(a => updatedMap.has(a.id) ? updatedMap.get(a.id)! : a);
        storage.saveAssets(updated);
        return updated;
    });
  };

  const deleteAsset = (id: string) => {
    setAssets(prev => {
        const updated = prev.filter(a => a.id !== id);
        storage.saveAssets(updated);
        return updated;
    });
  };

  // Transaction Handlers
  const addTransaction = (t: Transaction) => {
    addBatchTransactions([t]);
  };
  
  const addBatchTransactions = (ts: Transaction[]) => {
    if (ts.length === 0) return;
    const latest = storage.getTransactions();
    const updated = [...latest, ...ts];
    setTransactions(updated);
    storage.saveTransactions(updated);

    if (ts.length === 1) {
        setToast({ message: `記帳成功！${ts[0].item} $${ts[0].amount}`, count: 1 });
    } else {
        setToast({ message: `已成功分析並記錄 ${ts.length} 筆交易`, count: ts.length });
    }
    setTimeout(() => setToast(null), 3000);
  };

  const updateTransaction = (t: Transaction) => {
    const updated = transactions.map(txn => txn.id === t.id ? t : txn);
    setTransactions(updated);
    storage.saveTransactions(updated);
    setToast({ message: `更新成功！${t.item}`, count: 1 });
    setTimeout(() => setToast(null), 3000);
  };

  const deleteTransaction = (id: string) => {
    const updated = transactions.filter(t => t.id !== id);
    setTransactions(updated);
    storage.saveTransactions(updated);
  };

  // Recurring Handlers
  const addRecurring = (item: RecurringItem) => {
    const updated = [...recurring, item];
    setRecurring(updated);
    storage.saveRecurring(updated);
  };

  const deleteRecurring = (id: string) => {
    const updated = recurring.filter(r => r.id !== id);
    setRecurring(updated);
    storage.saveRecurring(updated);
  };

  // Budget Handlers
  const updateBudgets = (newBudgets: BudgetConfig[]) => {
      setBudgets(newBudgets);
      storage.saveBudgets(newBudgets);
      setToast({ message: '預算設定已更新', count: 1 });
      setTimeout(() => setToast(null), 3000);
  };
  
  const handleToggleRecurringTransaction = (id: string) => {
      const updatedTxs = stockTransactions.map(tx => tx.id === id ? { ...tx, isRecurring: !tx.isRecurring } : tx);
      setStockTransactions(updatedTxs);
      storage.saveStockTransactions(updatedTxs);
  };

  const handleBulkMarkRecurringTransactions = (ids: string[]) => {
      const idSet = new Set(ids);
      const updatedTxs = stockTransactions.map(tx => idSet.has(tx.id) ? { ...tx, isRecurring: true } : tx);
      setStockTransactions(updatedTxs);
      storage.saveStockTransactions(updatedTxs);
      setToast({ message: `已標記 ${ids.length} 筆定期定額交易`, count: ids.length });
      setTimeout(() => setToast(null), 3000);
  };

  const handleImportTransactions = (newlyParsedTxs: StockTransaction[]) => {
      const currentTxs = storage.getStockTransactions();
      const existingTxSignatures = new Set(currentTxs.map(tx => 
          `${tx.date}-${tx.symbol}-${tx.shares}-${tx.price}-${tx.side}`
      ));

      const newUniqueTxs = newlyParsedTxs.filter(newTx => {
          const signature = `${newTx.date}-${newTx.symbol}-${newTx.shares}-${newTx.price}-${newTx.side}`;
          return !existingTxSignatures.has(signature);
      });

      if (newUniqueTxs.length > 0) {
          const updatedTxs = [...currentTxs, ...newUniqueTxs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setStockTransactions(updatedTxs);
          storage.saveStockTransactions(updatedTxs);
          setToast({ message: `成功匯入 ${newUniqueTxs.length} 筆新交易紀錄`, count: newUniqueTxs.length });
          setTimeout(() => setToast(null), 5000);
      } else {
          setToast({ message: '沒有新的交易紀錄可供匯入', count: 0 });
          setTimeout(() => setToast(null), 3000);
      }
  };
  
  const handleImportInventory = (parsedAssets: Partial<Asset>[]) => {
    const currentAssets = storage.getAssets();
    const stockMap = new Map<string, Asset>(
        currentAssets
            .filter(a => a.type === AssetType.STOCK && a.symbol)
            .map(a => [toNumericString(a.symbol), a])
    );

    let newAssetsCount = 0;
    let updatedAssetsCount = 0;

    parsedAssets.forEach(parsed => {
        const normalizedSymbol = toNumericString(parsed.symbol);
        if (!normalizedSymbol) return;

        const existing = stockMap.get(normalizedSymbol);

        if (existing) {
            const newShares = parsed.shares !== undefined ? parsed.shares : existing.shares;
            const newCurrentPrice = parsed.currentPrice !== undefined ? parsed.currentPrice : existing.currentPrice;
            const newAmount = (newShares || 0) * (newCurrentPrice || 0);
            
            const updatedAsset: Asset = {
                ...existing,
                name: parsed.name !== undefined ? parsed.name : existing.name,
                shares: newShares,
                avgCost: parsed.avgCost !== undefined ? parsed.avgCost : existing.avgCost,
                currentPrice: newCurrentPrice,
                amount: newAmount,
                lastUpdated: Date.now(),
            };
            stockMap.set(normalizedSymbol, updatedAsset);
            updatedAssetsCount++;
        } else {
            const newShares = parsed.shares !== undefined ? parsed.shares : 0;
            const newCurrentPrice = parsed.currentPrice !== undefined ? parsed.currentPrice : 0;
            const newAmount = newShares * newCurrentPrice;

            const newAsset: Asset = {
                id: crypto.randomUUID(),
                type: AssetType.STOCK,
                currency: Currency.TWD,
                exchangeRate: 1,
                name: parsed.name || parsed.symbol || '',
                symbol: parsed.symbol,
                shares: newShares,
                avgCost: parsed.avgCost !== undefined ? parsed.avgCost : 0,
                currentPrice: newCurrentPrice,
                amount: newAmount,
                lastUpdated: Date.now(),
            };
            stockMap.set(normalizedSymbol, newAsset);
            newAssetsCount++;
        }
    });

    const nonStockAssets = currentAssets.filter(a => a.type !== AssetType.STOCK);
    const finalAssets = [...nonStockAssets, ...Array.from(stockMap.values())];

    setAssets(finalAssets);
    storage.saveAssets(finalAssets);
    
    setToast({ message: `庫存同步完成：新增 ${newAssetsCount} 筆，更新 ${updatedAssetsCount} 筆`, count: newAssetsCount + updatedAssetsCount });
    setTimeout(() => setToast(null), 5000);
  };

  // FIX: Replaced old enrichment handler with new handlers for price and dividend updates to match the useStockEnrichment hook.
  const handleEnrichmentSuccess = (newAssetsState: Asset[]) => {
    // This onSuccess callback ensures state is updated and snapshots are taken AFTER enrichment is complete.
    setAssets(newAssetsState);
    takeStockSnapshot(newAssetsState, storage.getTransactions());
    takePortfolioSnapshot(newAssetsState);
  };

  const handleUpdatePrices = (idsToEnrich: string[] | null = null) => {
    updatePrices(idsToEnrich, handleEnrichmentSuccess);
  };

  const handleUpdateDividends = (idsToEnrich: string[] | null = null) => {
    updateDividends(idsToEnrich, handleEnrichmentSuccess);
  };

  return (
    <Layout 
      currentView={view} 
      onChangeView={setView} 
      isEnrichingInBackground={isEnrichingInBackground}
    >
      {view === 'DASHBOARD' && <Dashboard 
          assets={assets} 
          transactions={transactions} 
          recurring={recurring} 
          budgets={budgets}
          stockHistory={stockHistory}
          stockTransactions={stockTransactions}
          onChangeView={setView}
          onAddTransaction={addTransaction}
          onNavigateToTransactions={(filter) => {
              setTransactionFilter(filter);
              setView('TRANSACTIONS');
          }}
      />}
      {view === 'ASSETS' && <Assets assets={assets} onAdd={addAsset} onUpdate={updateAsset} onDelete={deleteAsset} />}
      {/* FIX: Pass the correct props to the Investments component as per its definition in types.ts. */}
      <div className={view === 'INVESTMENTS' ? 'block' : 'hidden'}>
        <Investments assets={assets} stockHistory={stockHistory} stockTransactions={stockTransactions} transactions={transactions} onAdd={addAsset} onUpdate={updateAsset} onUpdateMultiple={updateMultipleAssets} onDelete={deleteAsset} enrichStatus={enrichStatus} onUpdatePrices={handleUpdatePrices} onUpdateDividends={handleUpdateDividends} onImportTransactions={handleImportTransactions} onImportInventory={handleImportInventory} onToggleRecurringTransaction={handleToggleRecurringTransaction} onBulkMarkRecurringTransactions={handleBulkMarkRecurringTransactions} isActiveView={view === 'INVESTMENTS'} />
      </div>
      {view === 'TRANSACTIONS' && <Transactions transactions={transactions} onAdd={addTransaction} onUpdate={updateTransaction} onDelete={deleteTransaction} initialFilter={transactionFilter} />}
      {view === 'BUDGET' && <Budget transactions={transactions} budgets={budgets} onUpdateBudgets={updateBudgets} />}
      {view === 'RECURRING' && <Recurring items={recurring} executedLog={recurringExecuted} onAdd={addRecurring} onDelete={deleteRecurring} onExecute={() => {}} />}
      <div className={view === 'WATCHLIST' ? 'block' : 'hidden'}>
        <Watchlist isActiveView={view === 'WATCHLIST'} />
      </div>
      {view === 'DSS_LAB' && <DSSLab stockTransactions={stockTransactions} />}
      {view === 'GUIDE' && <GuideView />}
      {view === 'TECH_DOCS' && <TechDocs />}
      {view === 'SETTINGS' && <Settings onDataChange={refreshData} />}
      {toast && (
        <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 z-[60] animate-fade-in">
           <div className="bg-white/20 p-1 rounded-full">
              <CheckCircle2 size={20} />
           </div>
           <span className="font-medium text-sm">{toast.message}</span>
           <button onClick={() => setToast(null)} className="ml-2 opacity-80 hover:opacity-100">
              <X size={16} />
           </button>
        </div>
      )}
    </Layout>
  );
}
