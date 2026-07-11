

import React from 'react';
import { ViewState } from '../../types';
import { LayoutGrid, PieChart, ScrollText, CalendarClock, Target, TrendingUp } from 'lucide-react';

interface MobileBottomNavProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
}

const NavItemMobile = ({ 
  view, current, icon: Icon, onClick 
}: { 
  view: ViewState; current: ViewState; icon: any; onClick: (v: ViewState) => void 
}) => {
  const isActive = view === current;
  return (
    <button
      onClick={() => onClick(view)}
      className={`flex flex-col items-center justify-center w-full h-full transition-all active:scale-95 ${
        isActive 
          ? 'text-primary' 
          : 'text-slate-500 hover:text-slate-300'
      }`}
    >
      <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-primary/10 shadow-[0_0_10px_rgba(139,92,246,0.2)]' : ''}`}>
         <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
      </div>
    </button>
  );
};

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ currentView, onChangeView }) => {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 pb-safe z-50">
      <div className="grid grid-cols-6 h-16">
        <NavItemMobile view="DASHBOARD" current={currentView} icon={LayoutGrid} onClick={onChangeView} />
        <NavItemMobile view="ASSETS" current={currentView} icon={PieChart} onClick={onChangeView} />
        <NavItemMobile view="INVESTMENTS" current={currentView} icon={TrendingUp} onClick={onChangeView} />
        <NavItemMobile view="TRANSACTIONS" current={currentView} icon={ScrollText} onClick={onChangeView} />
        <NavItemMobile view="RECURRING" current={currentView} icon={CalendarClock} onClick={onChangeView} />
        <NavItemMobile view="BUDGET" current={currentView} icon={Target} onClick={onChangeView} />
      </div>
    </div>
  );
};
