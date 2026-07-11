import React, { useState, useEffect } from 'react';
import { Modal, Button, Input } from '../ui';
import { Asset } from '../../types';
import { parseStockInput } from '../../services/stock';
import { BrainCircuit, Wand2, FilePenLine, Trash2, ShieldCheck, Info } from 'lucide-react';

interface InvestmentAIInputModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (stocks: Partial<Asset>[]) => void;
}

// Temporary ID for local state management
type ParsedStock = Partial<Asset> & { tempId: string };

export const InvestmentAIInputModal: React.FC<InvestmentAIInputModalProps> = ({ isOpen, onClose, onSave }) => {
    const [inputText, setInputText] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [parsedStocks, setParsedStocks] = useState<ParsedStock[]>([]);
    
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editData, setEditData] = useState<Partial<Asset>>({});

    useEffect(() => {
        if (!isOpen) {
            // Reset state on close
            setInputText('');
            setParsedStocks([]);
            setIsAnalyzing(false);
            setEditingId(null);
        }
    }, [isOpen]);

    const handleAnalyze = async () => {
        if (!inputText.trim()) return;
        setIsAnalyzing(true);
        const result = await parseStockInput(inputText);
        if (result) {
            setParsedStocks(result.map(p => ({ ...p, tempId: crypto.randomUUID() })));
        } else {
            alert('AI 解析失敗，請檢查您的輸入或 API Key。');
        }
        setIsAnalyzing(false);
    };

    const handleEdit = (stock: ParsedStock) => {
        setEditingId(stock.tempId);
        setEditData(stock);
    };

    const handleSaveEdit = () => {
        if (!editingId) return;
        setParsedStocks(parsedStocks.map(p => p.tempId === editingId ? { ...p, ...editData } : p));
        setEditingId(null);
    };

    const handleRemove = (tempId: string) => {
        setParsedStocks(parsedStocks.filter(p => p.tempId !== tempId));
    };

    const handleConfirm = () => {
        onSave(parsedStocks);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="AI 智慧輸入">
            <div className="space-y-4">
                {parsedStocks.length === 0 ? (
                    <>
                        <div className="relative">
                            <textarea
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder={"請輸入持股資訊，每行一筆。例如：\n2330 1張 650.5\n00878 5000股 22.8"}
                                className="w-full h-36 bg-slate-900 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 focus:border-primary focus:ring-1 focus:ring-primary resize-none"
                            />
                        </div>
                        <p className="text-xs text-slate-500 flex items-start gap-1.5">
                            <Info size={16} className="shrink-0"/> AI 將自動解析「代號」、「股數」（支援 "張" 和 "股"）與「成本」。
                        </p>
                        <Button 
                            onClick={handleAnalyze} 
                            disabled={isAnalyzing || !inputText.trim()}
                            loading={isAnalyzing}
                            className="w-full py-3"
                        >
                            <Wand2 size={16} /> {isAnalyzing ? '分析中...' : '分析文字並預覽'}
                        </Button>
                    </>
                ) : (
                    <>
                        <div className="bg-violet-500/10 p-3 rounded-lg border border-violet-500/20 text-xs text-slate-300 flex items-start gap-3">
                           <BrainCircuit size={20} className="text-violet-400 mt-0.5 shrink-0"/>
                           <span>
                               <strong className="text-white">請仔細核對 AI 辨識結果。</strong>
                               您可以在此處編輯或移除任何不正確的項目，確認後再匯入庫存。
                           </span>
                        </div>
                        <div className="max-h-80 overflow-y-auto space-y-2 pr-2">
                            {parsedStocks.map(stock => {
                                if (editingId === stock.tempId) {
                                    return (
                                        <div key={stock.tempId} className="bg-slate-700/80 p-3 rounded-lg space-y-3 border border-primary/50 shadow-lg">
                                            <div className="grid grid-cols-3 gap-2">
                                                <Input placeholder="代號" value={editData.symbol || ''} onChange={e => setEditData({...editData, symbol: e.target.value})} className="h-8 text-sm"/>
                                                <Input type="number" placeholder="股數" value={editData.shares || ''} onChange={e => setEditData({...editData, shares: Number(e.target.value)})} className="h-8 text-sm"/>
                                                <Input type="number" placeholder="成本" value={editData.avgCost || ''} onChange={e => setEditData({...editData, avgCost: Number(e.target.value)})} className="h-8 text-sm"/>
                                            </div>
                                            <div className="flex gap-2 justify-end">
                                                <Button onClick={() => setEditingId(null)} variant="secondary" className="px-2 py-1 text-xs">取消</Button>
                                                <Button onClick={handleSaveEdit} className="px-2 py-1 text-xs">儲存</Button>
                                            </div>
                                        </div>
                                    );
                                }
                                return (
                                    <div key={stock.tempId} className="bg-slate-800 p-2.5 rounded-lg flex justify-between items-center text-sm group hover:bg-slate-700/50">
                                        <div>
                                            <p className="font-bold text-white">{stock.symbol}</p>
                                            <p className="text-xs text-slate-400 font-mono">
                                                {stock.shares?.toLocaleString()} 股 @ ${stock.avgCost}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEdit(stock)} className="p-1.5 text-slate-500 hover:text-white">
                                                <FilePenLine size={14}/>
                                            </button>
                                            <button onClick={() => handleRemove(stock.tempId)} className="p-1.5 text-slate-500 hover:text-red-400">
                                                <Trash2 size={14}/>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                         <div className="flex gap-2 pt-4 border-t border-slate-700">
                            <Button variant="secondary" onClick={() => setParsedStocks([])} className="flex-1">返回編輯文字</Button>
                            <Button onClick={handleConfirm} className="flex-1">
                                <ShieldCheck size={16}/> 確認並匯入 {parsedStocks.length} 筆
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};
