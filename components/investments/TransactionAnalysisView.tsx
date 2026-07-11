import React, { useMemo } from 'react';
import { StockTransaction } from '../../types';
import { TransactionHistoryList } from './TransactionHistoryList';
import { Card } from '../ui';
import { BadgePercent, ArrowRightLeft, Repeat, Calculator, TrendingUp } from 'lucide-react';

interface TransactionAnalysisViewProps {
    transactions: StockTransaction[];
    stockNameMap: Record<string, string>;
    onToggleRecurring?: (id: string) => void;
    onBulkMarkRecurring?: (ids: string[]) => void;
}

const StatCard = ({ title, value, icon: Icon, colorClass, isCurrency = true, unit = '', isHighlight = false }: { title: string, value: number, icon: any, colorClass:string, isCurrency?: boolean, unit?: string, isHighlight?: boolean }) => {
    // Taiwan Stock Habit styling for highlighted card
    const valueColor = isHighlight 
        ? (value >= 0 ? 'text-red-400' : 'text-emerald-400') 
        : (!isCurrency || value >= 0 ? 'text-white' : 'text-red-400');
        
    return (
    <Card className={`p-4 ${isHighlight ? 'bg-gradient-to-br from-slate-800 to-slate-800 border-slate-600 shadow-md relative overflow-hidden' : 'bg-slate-800/50 border-slate-700'}`}>
        <div className="flex justify-between items-start mb-2 relative z-10">
            <span className={`text-xs font-bold uppercase ${isHighlight ? 'text-slate-300' : 'text-slate-400'}`}>{title}</span>
            <Icon size={16} className={colorClass} />
        </div>
        <div className={`text-2xl font-bold font-mono relative z-10 ${valueColor}`}>
            {isCurrency ? (
                <>
                    {value > 0 ? '+' : value < 0 ? '-' : ''}
                    {`$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                </>
            ) : (
                <>
                    {value > 0 && isHighlight ? '+' : ''}{value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    {unit && <span className="text-sm ml-1">{unit}</span>}
                </>
            )}
        </div>
        {isHighlight && (
            <div className={`absolute -bottom-4 -right-4 opacity-5 pointer-events-none ${value >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                <Icon size={80} />
            </div>
        )}
    </Card>
)};

export const TransactionAnalysisView: React.FC<TransactionAnalysisViewProps> = ({
    transactions,
    stockNameMap,
    onToggleRecurring,
    onBulkMarkRecurring,
}) => {
    
    const stats = useMemo(() => {
        let realizedProfit = 0;
        let totalCostBasis = 0;

        transactions.forEach(tx => {
            if (tx.side === 'SELL' && tx.realizedProfit) {
                realizedProfit += tx.realizedProfit;
                totalCostBasis += (tx.amount - tx.realizedProfit);
            }
        });

        const totalFees = transactions.reduce((sum, tx) => sum + tx.fees, 0);
        const netCashFlow = transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
        const tradeCount = transactions.length;
        
        const intervalROI = totalCostBasis > 0 ? (realizedProfit / totalCostBasis) * 100 : 0;

        return {
            realizedProfit,
            intervalROI,
            netCashFlow,
            totalFees,
            tradeCount
        };
    }, [transactions]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard title="區間實現總盈虧" value={stats.realizedProfit} icon={BadgePercent} colorClass={stats.realizedProfit >= 0 ? 'text-red-400' : 'text-emerald-400'} isHighlight />
                <StatCard title="區間實現報酬率" value={stats.intervalROI} icon={TrendingUp} colorClass={stats.intervalROI >= 0 ? 'text-red-400' : 'text-emerald-400'} isCurrency={false} unit="%" isHighlight />
                <StatCard title="區間淨現金流" value={stats.netCashFlow} icon={ArrowRightLeft} colorClass={stats.netCashFlow >= 0 ? 'text-sky-400' : 'text-orange-400'} />
                <StatCard title="成本損耗 (費用+稅)" value={stats.totalFees * -1} icon={Calculator} colorClass="text-slate-500" />
                <StatCard title="總交易次數" value={stats.tradeCount} icon={Repeat} isCurrency={false} colorClass="text-slate-400" unit="筆"/>
            </div>

            <TransactionHistoryList transactions={transactions} stockNameMap={stockNameMap} onToggleRecurring={onToggleRecurring} onBulkMarkRecurring={onBulkMarkRecurring} />
        </div>
    );
};