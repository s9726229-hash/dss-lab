
import React, { useMemo } from 'react';
import { Card } from '../ui';
import { Wallet, TrendingUp, TrendingDown, Percent, Info, AlertTriangle, Coins } from 'lucide-react';
import { Asset } from '../../types';
import { calculateStockPerformance } from '../../services/stock';

interface InvestmentStatsProps {
    inventory: Asset[];
    isDataStale: boolean;
    compact?: boolean;
}

const StatCard = ({ title, value, icon: Icon, colorClass, isCurrency = true, tooltip, staleTooltip }: any) => (
    <Card className={`p-4 bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 hover:border-current transition-colors ${colorClass} ${staleTooltip ? 'border-amber-500/30' : ''}`}>
        <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-1.5">
                <span className={`text-xs font-bold uppercase`}>{title}</span>
                {tooltip && (
                    <div title={tooltip} className="cursor-help">
                        <Info size={12} className="text-slate-500" />
                    </div>
                )}
                {staleTooltip && (
                    <div title={staleTooltip} className="cursor-help">
                        <AlertTriangle size={12} className="text-amber-400 animate-pulse" />
                    </div>
                )}
            </div>
            <Icon size={16} />
        </div>
        <div className={`text-2xl font-bold font-mono`}>
            {isCurrency && (value > 0 ? '+' : value < 0 ? '' : '')}
            {isCurrency ? `$${isCurrency && value < 0 ? Math.abs(value).toLocaleString() : value.toLocaleString()}` : `${value.toFixed(2)}%`}
        </div>
    </Card>
);

export const InvestmentStats: React.FC<InvestmentStatsProps> = ({ inventory, isDataStale, compact = false }) => {
    const stats = useMemo(() => {
        let totalMarketValue = 0;
        let totalCost = 0;
        let totalEstimatedDividends = 0;

        inventory.forEach(stock => {
            const performance = calculateStockPerformance(stock);
            totalMarketValue += performance.marketValue;
            totalCost += performance.totalCost;
            if (stock.dividendPerShare && stock.shares) {
                totalEstimatedDividends += stock.dividendPerShare * stock.shares;
            }
        });

        const totalPL = totalMarketValue - totalCost;
        return {
            totalMarketValue,
            totalPL,
            totalPLPercent: totalCost > 0 ? (totalPL / totalCost) * 100 : 0,
            totalEstimatedDividends,
        };
    }, [inventory]);

    const isGain = stats.totalPL >= 0;
    const plColorClass = isGain ? 'text-rose-400' : 'text-emerald-400';

    if (compact) {
        return (
            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                    <span className="text-xs text-slate-400 mb-1">庫存總市值</span>
                    <span className="text-xl font-bold font-mono text-white">${stats.totalMarketValue.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-xs text-slate-400 mb-1">未實現損益</span>
                    <span className={`text-xl font-bold font-mono ${stats.totalPL > 0 ? 'text-red-400' : stats.totalPL < 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {stats.totalPL > 0 ? '+' : ''}{stats.totalPL.toLocaleString(undefined, {maximumFractionDigits:0})}
                        <span className="text-xs ml-1 opacity-80">({stats.totalPLPercent.toFixed(1)}%)</span>
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 relative">
            <Card className="p-4 bg-gradient-to-br from-primary/20 to-slate-800 border-primary/30">
                <div className="flex justify-between items-start mb-2">
                    <span className="text-primary-300 text-xs font-bold uppercase">總市值</span>
                    <Wallet size={16} className="text-primary"/>
                </div>
                <div className="text-2xl font-bold font-mono text-white">
                    ${stats.totalMarketValue.toLocaleString()}
                </div>
            </Card>

            <StatCard 
                title="總損益"
                value={stats.totalPL}
                icon={isGain ? TrendingUp : TrendingDown}
                colorClass={plColorClass}
                tooltip="已扣除預估手續費與證交稅"
                staleTooltip={isDataStale ? "部分數據已過期，可能影響損益精確度" : null}
            />

            <StatCard 
                title="總報酬率"
                value={stats.totalPLPercent}
                icon={Percent}
                colorClass={plColorClass}
                isCurrency={false}
                staleTooltip={isDataStale ? "部分數據已過期，可能影響損益精確度" : null}
            />
            
            <Card className="p-4 bg-gradient-to-br from-amber-800/20 to-slate-800 border-amber-500/30">
                <div className="flex justify-between items-start mb-2">
                    <span className="text-amber-300/80 text-xs font-bold uppercase">年預估配息</span>
                    <Coins size={16} className="text-amber-500"/>
                </div>
                <div className="text-2xl font-bold font-mono text-amber-400">
                    +${stats.totalEstimatedDividends.toLocaleString()}
                </div>
            </Card>
        </div>
    );
};