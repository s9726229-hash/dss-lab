import React, { useState, useEffect } from 'react';
import { Modal, Button, Input } from '../ui';
import { StockPosition } from '../../types';
import { BrainCircuit, FilePenLine, Trash2, ShieldCheck } from 'lucide-react';

interface InvestmentAIModalProps {
    isOpen: boolean;
    uploadResult: Partial<StockPosition>[];
    onClose: () => void;
    onConfirm: (finalPositions: StockPosition[]) => void;
}

export const InvestmentAIModal: React.FC<InvestmentAIModalProps> = ({ isOpen, uploadResult, onClose, onConfirm }) => {
    const [positions, setPositions] = useState<Partial<StockPosition>[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editData, setEditData] = useState<Partial<StockPosition>>({});

    useEffect(() => {
        if (isOpen) {
            // Assign temporary IDs for editing purposes
            setPositions(uploadResult.map(p => ({ ...p, id: crypto.randomUUID() })));
        }
    }, [isOpen, uploadResult]);

    const handleEdit = (pos: Partial<StockPosition>) => {
        setEditingId(pos.id!);
        setEditData(pos);
    };

    const handleSave = () => {
        setPositions(positions.map(p => p.id === editingId ? editData : p));
        setEditingId(null);
    };
    
    const handleRemove = (id: string) => {
        setPositions(positions.filter(p => p.id !== id));
    };

    const handleConfirm = () => {
        const finalPositions = positions.map(p => {
            const shares = Number(p.shares) || 0;
            const avgCost = Number(p.avgCost) || 0;
            const currentPrice = Number(p.currentPrice) || 0;
            const marketValue = shares * currentPrice;
            const unrealizedPL = marketValue - (shares * avgCost);
            const costBasis = shares * avgCost;
            const unrealizedPLPercent = costBasis > 0 ? (unrealizedPL / costBasis) * 100 : 0;

            return {
                ...p,
                id: p.id!,
                shares,
                avgCost,
                currentPrice,
                marketValue,
                unrealizedPL,
                unrealizedPLPercent
            } as StockPosition;
        });
        onConfirm(finalPositions);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="AI 智慧匯入預覽">
            <div className="space-y-4">
                <div className="bg-violet-500/10 p-3 rounded-lg border border-violet-500/20 text-xs text-slate-300 leading-relaxed flex items-start gap-3">
                    <BrainCircuit size={20} className="text-violet-400 mt-0.5 shrink-0"/>
                    <span>
                        <span className="font-bold text-white">請仔細核對 AI 辨識結果。</span>
                        您可以在此處編輯或移除任何不正確的項目，確認後再匯入您的庫存。
                    </span>
                </div>
                
                <div className="max-h-80 overflow-y-auto space-y-2 pr-2">
                    {positions.map(pos => {
                        if (editingId === pos.id) {
                            return (
                                <div key={pos.id} className="bg-slate-700/80 p-3 rounded-lg space-y-3 border border-primary/50 shadow-lg">
                                    <Input value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} className="h-8 text-sm"/>
                                    <div className="grid grid-cols-3 gap-2">
                                        <Input placeholder="代號" value={editData.symbol || ''} onChange={e => setEditData({...editData, symbol: e.target.value})} className="h-8 text-sm"/>
                                        <Input type="number" placeholder="股數" value={editData.shares} onChange={e => setEditData({...editData, shares: Number(e.target.value)})} className="h-8 text-sm"/>
                                        <Input type="number" placeholder="成本" value={editData.avgCost} onChange={e => setEditData({...editData, avgCost: Number(e.target.value)})} className="h-8 text-sm"/>
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <Button onClick={() => setEditingId(null)} variant="secondary" className="px-2 py-1 text-xs">取消</Button>
                                        <Button onClick={handleSave} className="px-2 py-1 text-xs">儲存</Button>
                                    </div>
                                </div>
                            );
                        }
                        return (
                            <div key={pos.id} className="bg-slate-800 p-2.5 rounded-lg flex justify-between items-center text-sm group hover:bg-slate-700/50">
                                <div>
                                    <p className="font-bold text-white">{pos.name} <span className="text-xs text-slate-500">{pos.symbol}</span></p>
                                    <p className="text-xs text-slate-400">
                                        {pos.shares} 股 @ {pos.avgCost}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleEdit(pos)} className="p-1.5 text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                        <FilePenLine size={14}/>
                                    </button>
                                    <button onClick={() => handleRemove(pos.id!)} className="p-1.5 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 size={14}/>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="flex gap-2 pt-4 border-t border-slate-700">
                    <Button variant="secondary" onClick={onClose} className="flex-1">取消</Button>
                    <Button onClick={handleConfirm} className="flex-1">
                        <ShieldCheck size={16} className="mr-2"/> 確認並儲存庫存
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
