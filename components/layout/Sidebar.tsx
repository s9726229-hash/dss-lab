

import React from 'react';
import { ViewState, ApiKeyStatus } from '../../types';
import {
  Settings, BookOpen, Loader2, Eye, FlaskConical, TrendingUp
} from 'lucide-react';

interface SidebarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  isEnrichingInBackground?: boolean;
}

const ApiKeyStatusIndicator = ({ status }: { status: ApiKeyStatus }) => {
    const statusConfig = {
        unchecked: { color: 'bg-slate-500', textColor: 'text-slate-500', pulse: false, label: '未啟用', tooltip: 'AI 未啟用：未設定 API Key' },
        verifying: { color: 'bg-amber-500', textColor: 'text-amber-500', pulse: true, label: '驗證中', tooltip: 'AI 狀態：正在驗證...' },
        valid: { color: 'bg-emerald-500', textColor: 'emerald-500', pulse: false, label: 'AI 上線', tooltip: 'AI 上線：金鑰有效' },
        invalid: { color: 'bg-red-500', textColor: 'text-red-500', pulse: false, label: 'AI 離線', tooltip: 'AI 離線：金鑰無效' },
    };
    const { color, textColor, pulse, label, tooltip } = statusConfig[status];

    return (
        <div title={tooltip} className="flex items-center gap-1.5 ml-2 cursor-help">
            <div className={`w-2 h-2 rounded-full ${color} ${pulse ? 'animate-pulse' : ''} transition-colors`}></div>
            <span className={`text-[10px] font-bold ${textColor}`}>{label}</span>
        </div>
    );
};

const NavItem = ({ 
  view, current, icon: Icon, label, onClick, loading = false
}: { 
  view: ViewState; current: ViewState; icon: any; label: string; onClick: (v: ViewState) => void; loading?: boolean 
}) => {
  const isActive = view === current;
  return (
    <button
      onClick={() => onClick(view)}
      className={`flex items-center justify-between w-full p-3 rounded-xl transition-all duration-200 ${
        isActive 
          ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_0_15px_rgba(139,92,246,0.15)]' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100 border border-transparent'
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon size={20} />
        <span className="font-medium tracking-wide">{label}</span>
      </div>
      {loading && <Loader2 size={16} className="animate-spin text-slate-400" />}
    </button>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, isEnrichingInBackground = false }) => {
  const [apiStatus, setApiStatus] = React.useState({ finmind: 'online', twse: 'online' });

  React.useEffect(() => {
    const handleStatusChange = (e: any) => {
      setApiStatus(prev => ({ ...prev, [e.detail.api]: e.detail.status }));
    };
    window.addEventListener('api-status-change', handleStatusChange);
    return () => window.removeEventListener('api-status-change', handleStatusChange);
  }, []);

  return (
    <aside className="hidden md:flex flex-col w-64 p-6 border-r border-slate-800 h-screen sticky top-0 bg-[#0f172a] shrink-0">
      <div className="flex items-center gap-3 mb-10 px-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center shadow-lg shadow-primary/20">
          <span className="font-bold text-white text-lg">FT</span>
        </div>
        <div>
          <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            DSS Lab
          </h1>
          <div className="flex items-center gap-2 flex-wrap mt-1.5">
            <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">V7.8.0</span>
            <div className="flex items-center gap-1" title={apiStatus.finmind === 'online' ? "FinMind API 連線正常" : "FinMind API 連線失敗"}>
                <div className={`w-1.5 h-1.5 rounded-full ${apiStatus.finmind === 'online' ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]' : 'bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.6)]'}`}></div>
                <span className={`text-[9px] font-bold ${apiStatus.finmind === 'online' ? 'text-emerald-500/80' : 'text-red-500/80'}`}>FinMind</span>
            </div>
            <div className="flex items-center gap-1" title={apiStatus.twse === 'online' ? "TWSE Proxy 連線正常" : "TWSE Proxy 連線失敗"}>
                <div className={`w-1.5 h-1.5 rounded-full ${apiStatus.twse === 'online' ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]' : 'bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.6)]'}`}></div>
                <span className={`text-[9px] font-bold ${apiStatus.twse === 'online' ? 'text-emerald-500/80' : 'text-red-500/80'}`}>TWSE</span>
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-2">
        <NavItem view="INVESTMENTS" current={currentView} icon={TrendingUp} label="股票投資" onClick={onChangeView} loading={isEnrichingInBackground} />
        <NavItem view="WATCHLIST" current={currentView} icon={Eye} label="選股掃描" onClick={onChangeView} />
        <NavItem view="DSS_LAB" current={currentView} icon={FlaskConical} label="DSS 實驗室" onClick={onChangeView} />

        <div className="pt-4 mt-2 border-t border-slate-800 space-y-2">
          <NavItem view="TECH_DOCS" current={currentView} icon={BookOpen} label="技術說明" onClick={onChangeView} />
        </div>
      </nav>

      <div className="p-4 mt-auto">
         <button onClick={() => onChangeView('SETTINGS')} className="flex items-center justify-center w-full text-slate-400 hover:text-white transition-colors py-2 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-slate-600">
           <Settings size={16} className="mr-2"/> <span className="text-sm">系統設定</span>
         </button>
      </div>
    </aside>
  );
};