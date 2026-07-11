
import React from 'react';
import { Modal, Input, Select, Button } from '../ui';
import { Asset, AssetType, Currency } from '../../types';
import { calculateLoanBalance } from '../../services/finance';
import { Wallet, TrendingUp, Landmark, Bitcoin, Home, CreditCard, Coins, Calendar, Calculator } from 'lucide-react';

interface AssetFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  formData: Partial<Asset>;
  setFormData: (data: Partial<Asset>) => void;
  editingId: string | null;
  onSubmit: () => void;
}

const TYPE_CONFIG: Record<AssetType, { icon: any, label: string, colorClass: string }> = {
  [AssetType.CASH]: { icon: Wallet, label: '現金/存款', colorClass: 'text-emerald-400' },
  [AssetType.STOCK]: { icon: TrendingUp, label: '股票投資', colorClass: 'text-violet-400' },
  [AssetType.FUND]: { icon: Landmark, label: '共同基金', colorClass: 'text-pink-400' },
  [AssetType.CRYPTO]: { icon: Bitcoin, label: '加密貨幣', colorClass: 'text-amber-400' },
  [AssetType.REAL_ESTATE]: { icon: Home, label: '房地產', colorClass: 'text-cyan-400' },
  [AssetType.DEBT]: { icon: CreditCard, label: '負債/貸款', colorClass: 'text-red-400' },
  [AssetType.OTHER]: { icon: Coins, label: '其他資產', colorClass: 'text-slate-400' },
};

export const AssetFormModal: React.FC<AssetFormModalProps> = ({ 
  isOpen, onClose, formData, setFormData, editingId, onSubmit 
}) => {
    
  const handleAmountChange = (key: 'originalAmount' | 'exchangeRate', value: number) => {
      const newData = { ...formData, [key]: value };
      const safeVal = isNaN(value) ? 0 : value;
      newData[key] = safeVal;

      if (newData.currency !== Currency.TWD) {
          const org = newData.originalAmount || 0;
          const rate = newData.exchangeRate || 1;
          newData.amount = Math.round(org * rate);
      } else if (key === 'originalAmount') {
          if (formData.type !== AssetType.DEBT) {
              newData.amount = safeVal;
          }
      }
      setFormData(newData);
  };

  const calculatedPreview = formData.type === AssetType.DEBT && formData.startDate && formData.originalAmount 
    ? calculateLoanBalance(formData as Asset) 
    : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editingId ? "編輯資產" : "新增資產"}>
        <div className="space-y-6">
          <div>
            <label className="block text-sm text-slate-400 mb-2 font-medium">資產名稱 (Name)</label>
            <Input 
                value={formData.name || ''} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                placeholder="例如：薪轉戶、台積電 (2330)、富邦房貸..."
                className="text-lg bg-slate-900 border-slate-700 focus:border-primary"
            />
          </div>

          <div>
             <label className="block text-sm text-slate-400 mb-2 font-medium">資產類別 (Type)</label>
             <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                    AssetType.CASH, AssetType.STOCK, AssetType.FUND,
                    AssetType.CRYPTO, AssetType.REAL_ESTATE, AssetType.DEBT
                ].map((type) => {
                    const config = TYPE_CONFIG[type];
                    const isSelected = formData.type === type;
                    const isDebt = type === AssetType.DEBT;
                    let bgClass = "bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800 hover:border-slate-600";
                    if (isSelected) {
                        if (isDebt) bgClass = "bg-red-500/20 border-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.3)]";
                        else bgClass = "bg-primary/20 border-primary text-white shadow-[0_0_10px_rgba(139,92,246,0.3)]";
                    }

                    return (
                        <button
                            key={type}
                            onClick={() => setFormData({...formData, type: type})}
                            className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-200 group ${bgClass}`}
                        >
                            <config.icon size={24} className={`mb-2 ${isSelected ? 'text-white' : config.colorClass} group-hover:scale-110 transition-transform`} />
                            <span className="text-xs font-bold">{config.label}</span>
                        </button>
                    )
                })}
             </div>
          </div>

          <div className="relative border border-slate-700 rounded-xl p-4 bg-slate-900/30">
             <div className="absolute -top-3 left-3 bg-slate-800 px-2 text-xs font-bold text-amber-400 flex items-center gap-1">
                <Coins size={12}/> {formData.type === AssetType.DEBT ? '貸款原始金額' : '金額與幣別'}
             </div>
             <div className="flex gap-4">
                 <div className="w-1/3">
                    <label className="block text-[10px] text-slate-500 mb-1 uppercase">幣別</label>
                    <Select value={formData.currency} onChange={e => {
                        setFormData({...formData, currency: e.target.value as Currency});
                        if(e.target.value === Currency.TWD) handleAmountChange('exchangeRate', 1);
                    }} className="bg-slate-900 h-12">
                        {Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}
                    </Select>
                 </div>
                 <div className="flex-1">
                    <label className="block text-[10px] text-slate-500 mb-1 uppercase">
                        {formData.type === AssetType.DEBT ? '原始貸款總額 (Original)' : `金額 (${formData.currency})`}
                    </label>
                    <Input 
                        type="number" 
                        value={formData.originalAmount || ''} 
                        onChange={e => handleAmountChange('originalAmount', parseFloat(e.target.value))}
                        className="font-mono text-xl h-12 bg-slate-900 border-slate-700 focus:border-primary"
                        placeholder="0.00"
                    />
                 </div>
             </div>
             {formData.currency !== Currency.TWD && (
                 <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between animate-fade-in">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">匯率</span>
                        <Input 
                            type="number" 
                            value={formData.exchangeRate || ''} 
                            onChange={e => handleAmountChange('exchangeRate', parseFloat(e.target.value))}
                            className="font-mono text-sm w-20 py-1 px-2 h-auto"
                        />
                    </div>
                    <div className="text-right">
                        <span className="text-xs text-slate-500 mr-2">折合台幣</span>
                        <span className="text-base font-bold text-emerald-400 font-mono">NT$ {formData.amount?.toLocaleString()}</span>
                    </div>
                 </div>
             )}
             
             {formData.type === AssetType.DEBT && formData.startDate && (
                 <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between animate-fade-in">
                    <div className="text-xs text-slate-400 flex items-center gap-1">
                        <Calculator size={12}/> 系統試算當前剩餘本金
                    </div>
                    <div className="text-right">
                        <span className="text-base font-bold text-red-400 font-mono">
                            ${calculatedPreview !== null ? calculatedPreview.toLocaleString() : '-'}
                        </span>
                    </div>
                 </div>
             )}
          </div>

          {formData.type === AssetType.DEBT && (
             <div className="bg-red-500/5 p-4 rounded-xl border border-red-500/20 space-y-4 animate-fade-in">
                <h4 className="text-sm font-bold text-red-300 flex items-center gap-2">
                    <CreditCard size={16}/> 貸款詳細資訊
                </h4>
                <div>
                     <label className="block text-xs text-red-400/70 mb-1 flex items-center gap-1">
                         <Calendar size={12}/> 貸款起始日 (Start Date)
                     </label>
                     <Input 
                        type="date"
                        className="border-red-500/30 focus:border-red-500 bg-red-500/5 text-red-100"
                        value={formData.startDate || ''}
                        onChange={e => setFormData({...formData, startDate: e.target.value})}
                     />
                </div>
                <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] text-red-400/70 mb-1">年利率 (%)</label>
                      <Input 
                        className="border-red-500/30 focus:border-red-500 bg-red-500/5 text-red-100 placeholder-red-800" 
                        type="number" 
                        value={formData.interestRate || ''} 
                        onChange={e => setFormData({...formData, interestRate: parseFloat(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-red-400/70 mb-1">總年期 (年)</label>
                      <Input 
                        className="border-red-500/30 focus:border-red-500 bg-red-500/5 text-red-100 placeholder-red-800" 
                        type="number" 
                        value={formData.termYears || ''} 
                        onChange={e => setFormData({...formData, termYears: parseFloat(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-red-400/70 mb-1">寬限期 (年)</label>
                      <Input 
                        className="border-red-500/30 focus:border-red-500 bg-red-500/5 text-red-100 placeholder-red-800" 
                        type="number" 
                        placeholder="0"
                        value={formData.interestOnlyPeriod || ''} 
                        onChange={e => setFormData({...formData, interestOnlyPeriod: parseFloat(e.target.value)})}
                      />
                    </div>
                </div>
                <p className="text-[10px] text-red-400/50">
                    * 系統將依據起始日自動攤提本金，您無需手動更新餘額。
                </p>
             </div>
          )}

          <div className="pt-2">
            <Button className="w-full py-3.5 text-lg font-bold shadow-xl shadow-primary/20" onClick={onSubmit}>
                {editingId ? '儲存變更' : '確認新增資產'}
            </Button>
          </div>
        </div>
    </Modal>
  );
};
