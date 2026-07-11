import React, { useState, useEffect, useRef } from 'react';
import { Mic, X, Check, BrainCircuit, Loader2 } from 'lucide-react';
import { parseTransactionInput } from '../services/gemini';
import { Transaction, IWindow } from '../types';

interface VoiceInputFabProps {
  onAddBatchTransactions: (ts: Transaction[]) => void;
  hasApiKey: boolean;
}

export const VoiceInputFab: React.FC<VoiceInputFabProps> = ({ onAddBatchTransactions, hasApiKey }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // FIX: Cast to unknown first to handle non-standard browser APIs for SpeechRecognition.
    const SpeechRecognition = (window as unknown as IWindow).SpeechRecognition || (window as unknown as IWindow).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'zh-TW';

      recognition.onresult = (event: any) => {
        let final = '';
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        setTranscript(prev => prev + final);
        setInterimText(interim);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech Recognition Error", event.error);
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleRecording = () => {
    if (!hasApiKey && !isRecording) {
      alert("請先在設定頁面輸入 Gemini API Key");
      return;
    }
    
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      setTranscript('');
      setInterimText('');
      recognitionRef.current?.start();
      setIsRecording(true);
      if (!isOpen) setIsOpen(true);
    }
  };

  const handleAiAnalysis = async () => {
    if (!transcript.trim()) return;
    setIsProcessing(true);
    const results = await parseTransactionInput(transcript);
    
    if (results && Array.isArray(results) && results.length > 0) {
      const newTransactions: Transaction[] = results.map(tx => ({
        id: crypto.randomUUID(),
        date: tx.date || new Date().toISOString().split('T')[0],
        amount: Number(tx.amount) || 0,
        category: tx.category || '其他',
        item: tx.item || '未知項目',
        type: (tx.type === 'INCOME' || tx.type === 'EXPENSE') ? tx.type : 'EXPENSE',
        note: `語音智慧入帳: "${transcript}"`,
        source: 'AI_VOICE'
      }));
      onAddBatchTransactions(newTransactions);
      setIsOpen(false);
      setTranscript('');
    } else {
      alert("AI 無法解析您的語音，請嘗試更清楚地描述。");
    }
    setIsProcessing(false);
  };
  
  if (!hasApiKey) return null;

  return (
    <div className="fixed bottom-24 md:bottom-8 right-4 md:right-6 z-[100]">
      {isOpen && (
        <div className="absolute bottom-20 right-0 w-80 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-4 animate-fade-in">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-white font-bold flex items-center gap-2">
              <BrainCircuit size={18} className="text-primary" /> 語音智慧記帳
            </h3>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">
              <X size={18} />
            </button>
          </div>

          <div className="bg-slate-900 rounded-xl p-3 mb-4 min-h-[100px] max-h-40 overflow-y-auto text-sm">
            <p className="text-white">{transcript}</p>
            <p className="text-slate-500 italic">{interimText}</p>
            {!transcript && !interimText && <p className="text-slate-600">請開始說話，例如：「早餐50、午餐100」</p>}
          </div>

          <div className="flex gap-2">
            <button
              onClick={toggleRecording}
              className={`flex-1 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${
                isRecording ? 'bg-red-500/20 text-red-500 border border-red-500/50 animate-pulse' : 'bg-slate-700 text-slate-200'
              }`}
            >
              <Mic size={16} /> {isRecording ? '停止錄音' : '繼續錄音'}
            </button>
            
            {transcript && !isRecording && (
              <button
                onClick={handleAiAnalysis}
                disabled={isProcessing}
                className="flex-[1.5] bg-primary text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50"
              >
                {isProcessing ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                🤖 AI 分析並確認入帳
              </button>
            )}
          </div>
        </div>
      )}

      <button
        onClick={toggleRecording}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 ${
          isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-primary text-white'
        }`}
      >
        <Mic size={24} />
      </button>
    </div>
  );
};
