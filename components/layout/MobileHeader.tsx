
import React from 'react';
import { ViewState } from '../../types';
import { Settings } from 'lucide-react';

interface MobileHeaderProps {
  onChangeView: (view: ViewState) => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({ onChangeView }) => {
  return (
    <header className="md:hidden h-16 bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-6 z-20 shrink-0 sticky top-0">
      <div className="font-bold text-lg flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center shadow-lg shadow-primary/20">
           <span className="font-bold text-white text-xs">FT</span>
        </div>
        FinTrack AI
      </div>
      
      <div className="ml-auto">
         <button onClick={() => onChangeView('SETTINGS')} className="p-2 text-slate-400 hover:text-white transition-colors">
            <Settings size={24} />
         </button>
      </div>
    </header>
  );
};
