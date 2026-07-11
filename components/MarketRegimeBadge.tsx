import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { MarketRegime } from '../types';

interface MarketRegimeBadgeProps {
    regime: MarketRegime | null;
}

export const MarketRegimeBadge: React.FC<MarketRegimeBadgeProps> = ({ regime }) => {
    if (regime === MarketRegime.NORMAL) {
        return (
            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                <ShieldAlert size={14}/> 🟢 平穩模式
            </span>
        );
    }
    if (regime === MarketRegime.CONSERVATIVE) {
        return (
            <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1" title="大盤 Bias20 <= -5% 或 單日跌幅 <= -3% 或 連3虧">
                <ShieldAlert size={14}/> 🟡 保守模式 (大盤大跌或連虧)
            </span>
        );
    }
    if (regime === MarketRegime.DEFENSIVE) {
        return (
            <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1" title="大盤 Bias20 <= -10% 或 單日跌幅 <= -5%">
                <ShieldAlert size={14}/> 🔴 防禦模式 (大盤&lt;-10%或暴跌&gt;5%)
            </span>
        );
    }
    return null;
};

