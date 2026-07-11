import React, { useState, useEffect } from 'react';
import { Modal, Button, Input } from '../ui';
import { Asset, AssetType, Currency } from '../../types';
import { lookupStockName } from '../../services/stock';

interface InvestmentInputModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (asset: Asset) => void;
    editingAsset: Asset | null;
}

export const InvestmentInputModal: React.FC<InvestmentInputModalProps> = ({ isOpen, onClose, onSave, editingAsset }) => {
    const [formData, setFormData] = useState<Partial<Asset>>({});
    const [lookupName, setLookupName] = useState<string | null>(null);
    const [isLooking, setIsLooking] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFormData(editingAsset || {
                type: AssetType.STOCK,
                currency: Currency.TWD,
                exchangeRate: 1,
            });
            setLookupName(editingAsset?.name && editingAsset.name !== editingAsset.symbol ? editingAsset.name : null);
        }
    }, [isOpen, editingAsset]);

    const handleSymbolBlur = async (symbol: string) => {
        const s = symbol.trim();
        if (!s) return;
        setIsLooking(true);
        const name = await lookupStockName(s);
        setIsLooking(false);
        if (name) {
            setLookupName(name);
            setFormData(prev => ({ ...prev, name }));
        } else {
            setLookupName(null);
        }
    };

    const handleSave = () => {
        if (!formData.symbol || !formData.shares || !formData.avgCost) {
            alert('請填寫所有必填欄位');
            return;
        }
        
        const shares = Number(formData.shares) || 0;
        const avgCost = Number(formData.avgCost) || 0;

        const finalAsset: Asset = {
            id: editingAsset?.id || crypto.randomUUID(),
            name: formData.name || formData.symbol,
            type: AssetType.STOCK,
            currency: Currency.TWD,
            exchangeRate: 1,
            lastUpdated: Date.now(),
            symbol: formData.symbol,
            shares: shares,
            avgCost: avgCost,
            amount: shares * avgCost, // Initial amount based on cost, will be updated by enrichment
            ...editingAsset, // Preserve other fields during edit
            ...formData // Apply changes
        } as Asset;
        
        onSave(finalAsset);
        onClose();
    };

    const handleFieldChange = (field: keyof Asset, value: string | number) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={editingAsset ? '編輯持股' : '新增持股'}>
            <div className="space-y-4">
                <p className="text-sm text-slate-400">請輸入持股基本資訊，詳細名稱與市價可稍後使用「AI 補完」功能自動填入。</p>
                <div>
                    <label className="text-xs text-slate-400">股票代號</label>
                    <Input
                        autoFocus
                        value={formData.symbol || ''}
                        onChange={e => { handleFieldChange('symbol', e.target.value); setLookupName(null); }}
                        onBlur={e => handleSymbolBlur(e.target.value)}
                        placeholder="例如: 2330 或 00878"
                    />
                    <div className="h-5 mt-1">
                        {isLooking && <p className="text-xs text-slate-500">查詢中...</p>}
                        {!isLooking && lookupName && (
                            <p className="text-xs text-emerald-400 font-bold">✓ {lookupName}</p>
                        )}
                        {!isLooking && !lookupName && formData.symbol && (
                            <p className="text-xs text-slate-500">（找不到股票名稱，將以代號儲存）</p>
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-slate-400">持有股數</label>
                        <Input type="number" value={formData.shares || ''} onChange={e => handleFieldChange('shares', Number(e.target.value))} placeholder="1000" />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400">平均成本</label>
                        <Input type="number" value={formData.avgCost || ''} onChange={e => handleFieldChange('avgCost', Number(e.target.value))} placeholder="650.0" />
                    </div>
                </div>

                <div className="pt-4 flex gap-2">
                    <Button variant="secondary" onClick={onClose} className="flex-1">取消</Button>
                    <Button onClick={handleSave} className="flex-1">
                        {editingAsset ? '儲存變更' : '確認新增'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
