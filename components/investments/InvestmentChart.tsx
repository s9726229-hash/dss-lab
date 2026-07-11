
import React, { useState } from 'react';
import { StockSnapshot } from '../../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Treemap } from 'recharts';
import { BarChart3, AppWindow, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '../ui';

export type ChartType = 'TREND' | 'ALLOCATION';

interface InvestmentChartProps {
    history: StockSnapshot[];
    allocationData: { name: string; value: number; roi: number; }[];
    chartType: ChartType;
    onSetChartType: (type: ChartType) => void;
}

const getColorByROI = (roi: number) => {
    // Green for negative ROI (#22c55e -> hsl(145, 63%, 49%))
    if (roi < 0) {
        // Map ROI from 0% to -50% to a lightness from 65% to 35%
        const intensity = Math.min(1.0, Math.abs(roi) / 50.0); // Normalize, capped at 50% loss for max color
        const lightness = 65 - (intensity * 30); // Range: 65% (light green) -> 35% (dark green)
        return `hsl(145, 63%, ${lightness}%)`;
    }
    // Red for positive ROI (#ef4444 -> hsl(359, 84%, 60%))
    if (roi > 0) {
        // Map ROI from 0% to 100% to a lightness from 75% to 50%
        const intensity = Math.min(1.0, roi / 100.0); // Normalize, capped at 100% gain
        const lightness = 75 - (intensity * 25); // Range: 75% (light red) -> 50% (deep red)
        return `hsl(359, 84%, ${lightness}%)`;
    }
    // Grey for zero ROI
    return '#64748b';
};


const CustomizedTreemapContent = (props: any) => {
    const { root, depth, x, y, width, height, index, name, value, roi } = props;
    const total = root.value;
    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
    
    // Don't render text for very small boxes
    if (width < 60 || height < 40) return null;

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                style={{
                    fill: getColorByROI(roi),
                    stroke: '#0f172a',
                    strokeWidth: 2,
                    strokeOpacity: 1,
                }}
            />
            <text x={x + width / 2} y={y + height / 2 + 7} textAnchor="middle" fill="#fff" fontSize={14} fontWeight="bold">
                {name}
            </text>
            <text x={x + width / 2} y={y + height / 2 + 25} textAnchor="middle" fill="#fff" fillOpacity={0.8} fontSize={10}>
                {percentage}%
            </text>
        </g>
    );
};

export const InvestmentChart: React.FC<InvestmentChartProps> = ({ history, allocationData, chartType, onSetChartType }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    const trendChartData = history.map(snap => ({
        date: snap.date.substring(5), // MM-DD
        市值: snap.totalMarketValue,
    }));

    return (
        <div>
            <button 
                onClick={() => setIsExpanded(!isExpanded)} 
                className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-slate-400 hover:bg-slate-700 hover:text-white transition-all text-sm font-bold"
            >
                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                {isExpanded ? '隱藏圖表分析' : '展開圖表分析'}
            </button>

            {isExpanded && (
                <div className="mt-4 animate-fade-in">
                    <Card className="flex flex-col h-96">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                                {chartType === 'TREND' 
                                    ? <><BarChart3 size={16} className="text-cyan-400"/> 市值趨勢</>
                                    : <><AppWindow size={16} className="text-amber-400"/> 持股分佈 (報酬率驅動)</>
                                }
                            </h3>
                            <div className="flex p-1 bg-slate-900 rounded-lg border border-slate-700">
                                <button onClick={() => onSetChartType('TREND')} className={`px-3 py-1 text-xs font-bold rounded ${chartType === 'TREND' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>趨勢</button>
                                <button onClick={() => onSetChartType('ALLOCATION')} className={`px-3 py-1 text-xs font-bold rounded ${chartType === 'ALLOCATION' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>分佈</button>
                            </div>
                        </div>
                        <div className="flex-1 w-full min-h-0">
                            {chartType === 'TREND' ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={trendChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                        <defs>
                                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.5}/>
                                        <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val: number) => `${(val/10000).toFixed(0)}萬`} />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                                            itemStyle={{ fontSize: '12px', color: '#fff' }}
                                            formatter={(val: number) => `NT$ ${val.toLocaleString()}`}
                                        />
                                        <Area type="monotone" dataKey="市值" stroke="#8b5cf6" fill="url(#colorValue)" strokeWidth={2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    {allocationData.length > 0 ? (
                                        <Treemap
                                            data={allocationData}
                                            dataKey="value"
                                            aspectRatio={4 / 3}
                                            stroke="#fff"
                                            content={<CustomizedTreemapContent />}
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-slate-500">
                                            無持股數據可供分析
                                        </div>
                                    )}
                                </ResponsiveContainer>
                            )}
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};
