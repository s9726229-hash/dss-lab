
import React, { useState, useEffect } from 'react';
import { Asset, AssetType, Currency } from '../types';
import { ASSET_TYPE_LABELS } from '../constants';
import { getHistory } from '../services/storage';
import { calculateLoanBalance } from '../services/finance'; // Centralized function
import { Wallet, Plus, PieChart as PieIcon, BarChart3 } from 'lucide-react';

// New Components
import { AssetList } from '../components/assets/AssetList';
import { AssetFormModal } from '../components/assets/AssetFormModal';

interface AssetsProps {
  assets: Asset[];
  onAdd: (asset: Asset) => void;
  onUpdate: (asset: Asset) => void;
  onDelete: (id: string) => void;
}

type FilterType = 'ALL' | 'INVEST' | 'CASH' | 'DEBT';

export const Assets: React.FC<AssetsProps> = ({ assets, onAdd, onUpdate, onDelete }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Asset>>({});
  const [filterType, setFilterType] = useState<FilterType>('ALL');

  useEffect(() => {
    if (window.location.hash === '#debt') {
      setFilterType('DEBT');
      // Optional: Clear hash after using it so a refresh doesn't force it again
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);



  const filteredAssets = assets.filter(asset => {
    if (filterType === 'ALL') return true;
    if (filterType === 'CASH') return asset.type === AssetType.CASH || asset.type === AssetType.OTHER;
    if (filterType === 'DEBT') return asset.type === AssetType.DEBT;
    if (filterType === 'INVEST') {
      return [AssetType.STOCK, AssetType.FUND, AssetType.CRYPTO, AssetType.REAL_ESTATE].includes(asset.type);
    }
    return true;
  });

  const handleEdit = (asset: Asset) => {
    setFormData(asset);
    setEditingId(asset.id);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setFormData({
      type: AssetType.CASH,
      currency: Currency.TWD,
      exchangeRate: 1,
      amount: 0,
      originalAmount: 0,
      name: '',
      lastUpdated: Date.now()
    });
    setEditingId(null);
    setIsModalOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name || formData.originalAmount === undefined) return;
    
    let finalAmount = Number(formData.amount);
    if (formData.type === AssetType.DEBT) {
        // Use the centralized calculation logic
        const calculated = calculateLoanBalance(formData as Asset);
        finalAmount = calculated;
    } else if (formData.currency === Currency.TWD) {
        finalAmount = Number(formData.originalAmount);
    }

    const asset: Asset = {
      id: editingId || crypto.randomUUID(),
      name: formData.name,
      type: formData.type || AssetType.CASH,
      amount: finalAmount,
      originalAmount: Number(formData.originalAmount),
      currency: formData.currency || Currency.TWD,
      exchangeRate: Number(formData.exchangeRate || 1),
      lastUpdated: Date.now(),
      startDate: formData.startDate,
      interestRate: formData.interestRate ? Number(formData.interestRate) : undefined,
      termYears: formData.termYears ? Number(formData.termYears) : undefined,
      interestOnlyPeriod: formData.interestOnlyPeriod ? Number(formData.interestOnlyPeriod) : 0,
    };

    if (editingId) onUpdate(asset);
    else onAdd(asset);
    setIsModalOpen(false);
  };

  const calculateDaysSinceUpdate = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6 animate-fade-in p-2 md:p-6 pb-24">
      
      {/* Header */}
      <div className="flex justify-between items-center">
         <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Wallet className="text-emerald-400"/> 資產管理
            </h2>
            <p className="text-xs text-slate-400 mt-1">追蹤現金、房產與各類資產淨值總覽</p>
         </div>
         <button 
             onClick={handleAdd} 
             className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all active:scale-95"
         >
             <Plus size={16}/> 
             <span className="hidden md:inline">新增資產</span>
         </button>
      </div>



      <AssetList 
        filteredAssets={filteredAssets} 
        filterType={filterType} 
        setFilterType={setFilterType} 
        onEdit={handleEdit} 
        onDelete={onDelete}
        calculateDaysSinceUpdate={calculateDaysSinceUpdate}
      />

      <AssetFormModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        formData={formData} 
        setFormData={setFormData} 
        editingId={editingId} 
        onSubmit={handleSubmit} 
      />
    </div>
  );
};
