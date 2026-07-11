import { useState } from 'react';
import { Asset, AssetType } from '../types';
import * as storage from '../services/storage';
import { enrichStockBasicInfo, enrichStockDividendInfo, fetchMarketRegime } from '../services/stock';

interface UseStockEnrichmentProps {
  setToast: (toast: { message: string; count: number } | null) => void;
}

type EnrichStatusType = 'price' | 'dividend';
type EnrichFunction = (stock: Asset) => Promise<Partial<Asset> | null>;

export const useStockEnrichment = ({ setToast }: UseStockEnrichmentProps) => {
  const [enrichStatus, setEnrichStatus] = useState({
    price: { isUpdating: false, progress: { current: 0, total: 0 } },
    dividend: { isUpdating: false, progress: { current: 0, total: 0 } },
  });

  const BATCH_SIZE = 3; // Number of parallel requests

  const enrichData = async (
    type: EnrichStatusType,
    enrichFn: EnrichFunction,
    stocksToUpdate: Asset[],
    onSuccess: (newAssets: Asset[]) => void
  ) => {
    setEnrichStatus(prev => ({ ...prev, [type]: { isUpdating: true, progress: { current: 0, total: stocksToUpdate.length } } }));
    setToast({ message: `${type === 'price' ? '快速更新' : '深度分析'}：正在更新 ${stocksToUpdate.length} 筆資料...`, count: stocksToUpdate.length });

    const currentAssets = storage.getAssets();
    let hasError = false;
    let processedCount = 0;

    // Pre-warm market regime cache before parallel execution
    await fetchMarketRegime(true);

    for (let i = 0; i < stocksToUpdate.length; i += BATCH_SIZE) {
      const batch = stocksToUpdate.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (stock) => {
        try {
          if (!stock.symbol) return;
          const info = await enrichFn(stock);
          
          const assetIndex = currentAssets.findIndex(a => a.id === stock.id);
          if (assetIndex !== -1 && info) {
            const existingAsset = currentAssets[assetIndex];
            const updatedAsset: Asset = { ...existingAsset, ...info, lastUpdated: Date.now() };

            if (type === 'price' && info.currentPrice) {
                 updatedAsset.amount = (Number(existingAsset.shares) || 0) * (Number(info.currentPrice) || 0);
            }
            currentAssets[assetIndex] = updatedAsset;
          }
        } catch (error) {
          console.error(`Enrichment failed for ${stock.symbol}:`, error);
          hasError = true;
        } finally {
          processedCount++;
          setEnrichStatus(prev => ({
            ...prev,
            [type]: { isUpdating: true, progress: { current: processedCount, total: stocksToUpdate.length } }
          }));
        }
      }));
    }

    storage.saveAssets(currentAssets);
    onSuccess(currentAssets);

    setToast({ message: hasError ? `部分資料更新失敗` : `${stocksToUpdate.length} 筆資料更新完成！`, count: stocksToUpdate.length });
    setTimeout(() => setToast(null), 3000);
    setEnrichStatus(prev => ({ ...prev, [type]: { isUpdating: false, progress: { current: 0, total: 0 } } }));
  };

  const getStocksToUpdate = (idsToEnrich: string[] | null = null): Asset[] => {
    const inventory = storage.getAssets().filter(a => a.type === AssetType.STOCK);
    if (idsToEnrich) {
      return inventory.filter(s => idsToEnrich.includes(s.id));
    }
    if (inventory.length === 0) {
      setToast({ message: `庫存中沒有持股可供更新`, count: 0 });
      setTimeout(() => setToast(null), 3000);
      return [];
    }
    const STALE_THRESHOLD = 14 * 24 * 60 * 60 * 1000;
    const priorityStocks = inventory.filter(s => !s.name || s.name === s.symbol || !s.currentPrice || !s.lastUpdated || (Date.now() - (s.lastUpdated || 0)) > STALE_THRESHOLD);
    return priorityStocks.length > 0 ? priorityStocks : inventory;
  };

  const updatePrices = (idsToEnrich: string[] | null = null, onSuccess: (newAssets: Asset[]) => void) => {
    if (enrichStatus.price.isUpdating || enrichStatus.dividend.isUpdating) return;
    const stocksToUpdate = getStocksToUpdate(idsToEnrich);
    if (stocksToUpdate.length === 0) return;
    enrichData('price', enrichStockBasicInfo, stocksToUpdate, onSuccess);
  };

  const updateDividends = (idsToEnrich: string[] | null = null, onSuccess: (newAssets: Asset[]) => void) => {
    if (enrichStatus.price.isUpdating || enrichStatus.dividend.isUpdating) return;
    const stocksToUpdate = getStocksToUpdate(idsToEnrich);
    if (stocksToUpdate.length === 0) return;
    enrichData('dividend', enrichStockDividendInfo, stocksToUpdate, onSuccess);
  };

  return { enrichStatus, updatePrices, updateDividends };
};
