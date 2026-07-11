
import React from 'react';
import { ViewState } from '../types';
import { Sidebar } from './layout/Sidebar';
import { MobileHeader } from './layout/MobileHeader';
import { MobileBottomNav } from './layout/MobileBottomNav';

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  isEnrichingInBackground?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onChangeView, isEnrichingInBackground = false }) => {
  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col md:flex-row font-sans">

      {/* Desktop Sidebar */}
      <Sidebar currentView={currentView} onChangeView={onChangeView} isEnrichingInBackground={isEnrichingInBackground} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        
        {/* Mobile Header (Hidden on Desktop) */}
        <MobileHeader onChangeView={onChangeView} />

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
           {children}
        </div>
        
      </main>

      {/* Mobile Bottom Navigation (Hidden on Desktop) */}
      <MobileBottomNav currentView={currentView} onChangeView={onChangeView} />
      
    </div>
  );
};
