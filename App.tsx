
import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from './components/Layout';
import { Settings } from './views/Settings';
import { TechDocs } from './views/TechDocs';
import { Watchlist } from './views/Watchlist';
import { DSSLab } from './views/DSSLab';
import { Investments } from './views/Investments';
import { ViewState, Asset, AssetType, Currency, StockSnapshot, StockTransaction, Transaction } from './types';
import * as storage from './services/storage';
import { useStockEnrichment } from './hooks/useStockEnrichment';
import { useDailySnapshot } from './hooks/useDailySnapshot';

// Helper function to normalize stock symbols for comparison
const toNumericString = (s: string | undefined): string => {
    if (!s) return '';
    const num = parseInt(s, 10);
    return isNaN(num) ? s.trim().toUpperCase() : String(num);
};

export default function App() {
  const [view, setView] = useState<ViewState>('WATCHLIST');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stockHistory, setStockHistory] = useState<StockSnapshot[]>([]);
  const [stockTransactions, setStockTransactions] = useState<StockTransaction[]>([]);

  const { enrichStatus, updatePrices, updateDividends } = useStockEnrichment({ setToast: () => {} });
  const { takePortfolioSnapshot, takeStockSnapshot } = useDailySnapshot({ assets, transactions, setStockHistory });

  const refreshData = useCallback(() => {
    setAssets(storage.getAssets());
    setTransactions(storage.getTransactions());
    setStockHistory(storage.getStockHistory());
    setStockTransactions(storage.getStockTransactions());
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

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
      }
  };

  const handleImportInventory = (parsedAssets: Partial<Asset>[]) => {
    const currentAssets = storage.getAssets();
    const stockMap = new Map<string, Asset>(
        currentAssets
            .filter(a => a.type === AssetType.STOCK && a.symbol)
            .map(a => [toNumericString(a.symbol), a])
    );

    parsedAssets.forEach(parsed => {
        const normalizedSymbol = toNumericString(parsed.symbol);
        if (!normalizedSymbol) return;

        const existing = stockMap.get(normalizedSymbol);

        if (existing) {
            const newShares = parsed.shares !== undefined ? parsed.shares : existing.shares;
            const newCurrentPrice = parsed.currentPrice !== undefined ? parsed.currentPrice : existing.currentPrice;
            const newAmount = (newShares || 0) * (newCurrentPrice || 0);

            stockMap.set(normalizedSymbol, {
                ...existing,
                name: parsed.name !== undefined ? parsed.name : existing.name,
                shares: newShares,
                avgCost: parsed.avgCost !== undefined ? parsed.avgCost : existing.avgCost,
                currentPrice: newCurrentPrice,
                amount: newAmount,
                lastUpdated: Date.now(),
            });
        } else {
            const newShares = parsed.shares !== undefined ? parsed.shares : 0;
            const newCurrentPrice = parsed.currentPrice !== undefined ? parsed.currentPrice : 0;
            const newAmount = newShares * newCurrentPrice;

            stockMap.set(normalizedSymbol, {
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
            });
        }
    });

    const nonStockAssets = currentAssets.filter(a => a.type !== AssetType.STOCK);
    const finalAssets = [...nonStockAssets, ...Array.from(stockMap.values())];

    setAssets(finalAssets);
    storage.saveAssets(finalAssets);
  };

  const handleEnrichmentSuccess = (newAssetsState: Asset[]) => {
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
    <Layout currentView={view} onChangeView={setView} isEnrichingInBackground={enrichStatus.price.isUpdating || enrichStatus.dividend.isUpdating}>
      <div className={view === 'INVESTMENTS' ? 'block' : 'hidden'}>
        <Investments
          assets={assets}
          stockHistory={stockHistory}
          stockTransactions={stockTransactions}
          transactions={transactions}
          onAdd={addAsset}
          onUpdate={updateAsset}
          onUpdateMultiple={updateMultipleAssets}
          onDelete={deleteAsset}
          enrichStatus={enrichStatus}
          onUpdatePrices={handleUpdatePrices}
          onUpdateDividends={handleUpdateDividends}
          onImportTransactions={handleImportTransactions}
          onImportInventory={handleImportInventory}
          onToggleRecurringTransaction={handleToggleRecurringTransaction}
          onBulkMarkRecurringTransactions={handleBulkMarkRecurringTransactions}
          isActiveView={view === 'INVESTMENTS'}
        />
      </div>
      <div className={view === 'WATCHLIST' ? 'block' : 'hidden'}>
        <Watchlist isActiveView={view === 'WATCHLIST'} />
      </div>
      {view === 'DSS_LAB' && <DSSLab stockTransactions={stockTransactions} />}
      {view === 'TECH_DOCS' && <TechDocs />}
      {view === 'SETTINGS' && <Settings onDataChange={refreshData} />}
    </Layout>
  );
}
