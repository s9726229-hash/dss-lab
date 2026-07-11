
import React from 'react';
import { Card } from '../ui';
import { PieChart as PieIcon, BarChart3 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ASSET_TYPE_COLORS } from '../../constants';

interface AssetChartsProps {
  dataByType: any[];
  historyData: any[];
  activeChartTab: 'ALLOCATION' | 'TREND';
  totalAssetsVal: number;
}

export const AssetCharts: React.FC<AssetChartsProps> = ({ dataByType, historyData, activeChartTab, totalAssetsVal }) => {
  const [trendMode, setTrendMode] = React.useState<'TOTAL' | 'CATEGORY'>('TOTAL');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`lg:col-span-1 lg:block ${activeChartTab === 'ALLOCATION' ? 'block' : 'hidden'}`}>
            <Card className="h-[280px] lg:h-[340px] flex flex-col relative overflow-hidden bg-slate-800/80 border-slate-700">
                <h3 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-2">
                    <PieIcon size={16} className="text-primary"/> 資產配置佔比
                </h3>
                <div className="w-full h-full relative -mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={dataByType}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={2}
                            dataKey="value"
                            labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                            label={({ x, y, cx, name, value, percent }) => {
                                const valStr = value >= 10000 ? `${(value/10000).toFixed(0)}萬` : value.toLocaleString();
                                return (
                                    <text x={x} y={y} fill="#f1f5f9" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={12} fontWeight={500}>
                                        {`${name} ${valStr} (${(percent * 100).toFixed(1)}%)`}
                                    </text>
                                );
                            }}
                        >
                            {dataByType.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={ASSET_TYPE_COLORS[entry.typeCode] || '#94a3b8'} stroke="rgba(0,0,0,0)" />
                            ))}
                        </Pie>
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                            itemStyle={{ color: '#fff', fontSize: '12px' }}
                            formatter={(value: number) => `NT$ ${value.toLocaleString()}`}
                        />
                    </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute bottom-2 left-0 right-0 flex justify-center flex-wrap gap-x-4 gap-y-2 px-4 pointer-events-none">
                    {dataByType.slice(0, 4).map(d => (
                        <div key={d.typeCode} className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: ASSET_TYPE_COLORS[d.typeCode] }}></span>
                            <span className="text-xs text-slate-200 font-medium">{d.name}</span>
                        </div>
                    ))}
                    </div>
                    {totalAssetsVal === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm rounded-2xl z-10">
                        <span className="text-slate-400 text-sm">無資產數據</span>
                    </div>
                    )}
                </div>
            </Card>
        </div>

        <div className={`lg:col-span-2 lg:block ${activeChartTab === 'TREND' ? 'block' : 'hidden'}`}>
            <Card className="h-[280px] lg:h-[340px] flex flex-col bg-slate-800/80 border-slate-700">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                        <BarChart3 size={16} className="text-cyan-400"/> {trendMode === 'TOTAL' ? '總資產與負債趨勢' : '分類資產走勢'}
                    </h3>
                    <div className="flex bg-slate-900/50 rounded-lg p-0.5 border border-slate-700">
                        <button onClick={() => setTrendMode('TOTAL')} className={`px-2 py-1 text-[10px] sm:text-xs rounded-md transition-all ${trendMode === 'TOTAL' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300'}`}>總體</button>
                        <button onClick={() => setTrendMode('CATEGORY')} className={`px-2 py-1 text-[10px] sm:text-xs rounded-md transition-all ${trendMode === 'CATEGORY' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300'}`}>分類</button>
                    </div>
                </div>
                <div className="flex flex-wrap gap-4 text-xs mb-2">
                    {trendMode === 'TOTAL' ? (
                        <>
                            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> 總資產</div>
                            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"></span> 總負債</div>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500"></span> 現金存款</div>
                            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500"></span> 股票</div>
                            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500"></span> 基金</div>
                            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"></span> 總負債</div>
                        </>
                    )}
                </div>
                <div className="w-full h-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={historyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorAssets" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorDebt" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorFund" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis 
                                dataKey="date" 
                                stroke="#64748b" 
                                fontSize={10} 
                                tickLine={false} 
                                axisLine={false} 
                                tickCount={5} 
                                dy={10}
                            />
                            <YAxis 
                                stroke="#64748b" 
                                fontSize={10} 
                                tickLine={false} 
                                axisLine={false} 
                                tickFormatter={(val) => `${(val/10000).toFixed(0)}萬`} 
                                width={55}
                            />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                                itemStyle={{ fontSize: '12px', padding: 0 }}
                                formatter={(val: number) => `NT$ ${val.toLocaleString()}`}
                            />
                            {trendMode === 'TOTAL' ? (
                                <>
                                    <Area type="monotone" dataKey="totalAssets" name="總資產" stroke="#10b981" fill="url(#colorAssets)" strokeWidth={2} />
                                    <Area type="monotone" dataKey="totalDebt" name="總負債" stroke="#ef4444" fill="url(#colorDebt)" strokeWidth={2} />
                                </>
                            ) : (
                                <>
                                    <Area type="monotone" dataKey="totalStock" name="股票" stroke="#a855f7" fill="url(#colorStock)" strokeWidth={2} />
                                    <Area type="monotone" dataKey="totalFund" name="基金" stroke="#f59e0b" fill="url(#colorFund)" strokeWidth={2} />
                                    <Area type="monotone" dataKey="totalCash" name="現金存款" stroke="#3b82f6" fill="url(#colorCash)" strokeWidth={2} />
                                    <Area type="monotone" dataKey="totalDebt" name="總負債" stroke="#ef4444" fill="url(#colorDebt)" strokeWidth={2} />
                                </>
                            )}
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </Card>
        </div>
    </div>
  );
};
