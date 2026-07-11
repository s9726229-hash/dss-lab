import { useEffect, useCallback } from 'react';
import { Asset, Transaction, AssetType, StockSnapshot } from '../types';
import * as storage from '../services/storage';
import { calculateStockPerformance } from '../services/stock';

interface UseDailySnapshotProps {
  assets: Asset[];
  transactions: Transaction[];
  setStockHistory: React.Dispatch<React.SetStateAction<StockSnapshot[]>>;
}

export const useDailySnapshot = ({ assets, transactions, setStockHistory }: UseDailySnapshotProps) => {
  const takePortfolioSnapshot = useCallback((currentAssets: Asset[]) => {
    let assetsVal = 0;
    let liabilitiesVal = 0;
    const distribution: any = {};
    currentAssets.forEach(a => {
      const val = a.amount;
      if (a.type === AssetType.DEBT) liabilitiesVal += val;
      else assetsVal += val;
      distribution[a.type] = (distribution[a.type] || 0) + val;
    });
    const snapshot = {
      date: new Date().toISOString().split('T')[0],
      totalAssets: assetsVal,
      totalLiabilities: liabilitiesVal,
      netWorth: assetsVal - liabilitiesVal,
      assetDistribution: distribution
    };
    const history = storage.getHistory();
    const today = new Date().toISOString().split('T')[0];
    const filteredHistory = history.filter(h => h.date !== today);
    filteredHistory.push(snapshot);
    if (filteredHistory.length > 365) filteredHistory.shift();
    storage.saveHistory(filteredHistory);
  }, []);

  const takeStockSnapshot = useCallback((currentAssets: Asset[], currentTransactions: Transaction[]) => {
    const stocks = currentAssets.filter(a => a.type === AssetType.STOCK);
    const today = new Date().toISOString().split('T')[0];
    const history = storage.getStockHistory();

    let snapshot: StockSnapshot;
    if (stocks.length === 0) {
      snapshot = { date: today, totalMarketValue: 0, totalUnrealizedPL: 0, positions: [] };
    } else {
      let totalMarketValue = 0;
      let totalUnrealizedPL = 0;
      const positions: { symbol: string; marketValue: number }[] = [];

      stocks.forEach(stock => {
        if (stock.symbol) {
          const performance = calculateStockPerformance(stock, currentTransactions);
          totalMarketValue += performance.marketValue;
          totalUnrealizedPL += performance.netProfit;
          positions.push({ symbol: stock.symbol, marketValue: performance.marketValue });
        }
      });
      snapshot = { date: today, totalMarketValue, totalUnrealizedPL, positions };
    }

    const filteredHistory = history.filter(h => h.date !== today);
    filteredHistory.push(snapshot);
    if (filteredHistory.length > 365) filteredHistory.shift();
    storage.saveStockHistory(filteredHistory);
    setStockHistory(filteredHistory);
  }, [setStockHistory]);

  useEffect(() => {
    if (assets.length === 0) return;

    // 選項A: 每當資產異動時，就覆寫/更新今天的快照
    takePortfolioSnapshot(assets);
    takeStockSnapshot(assets, transactions);
  }, [assets, transactions, takePortfolioSnapshot, takeStockSnapshot]);

  return { takePortfolioSnapshot, takeStockSnapshot };
};
