import React from 'react';
import { Input } from '../ui';
import { Calendar, Search } from 'lucide-react';

export type TimeRange = 'MONTH' | 'QUARTER' | 'HALF_YEAR' | 'YEAR' | 'ALL' | 'CUSTOM';

interface TransactionFiltersProps {
  filter: string;
  setFilter: (val: string) => void;
  timeRange: TimeRange;
  setTimeRange: (val: TimeRange) => void;
  dateRangeLabel: string;
  customStart: string;
  setCustomStart: (val: string) => void;
  customEnd: string;
  setCustomEnd: (val: string) => void;
}

const timeRangeOptions: { value: TimeRange; label: string }[] = [
    { value: 'MONTH', label: '月' },
    { value: 'QUARTER', label: '季' },
    { value: 'HALF_YEAR', label: '半年' },
    { value: 'YEAR', label: '年度' },
    { value: 'ALL', label: '全部' },
    { value: 'CUSTOM', label: '自定義' },
];

export const TransactionFilters: React.FC<TransactionFiltersProps> = ({
  filter, setFilter,
  timeRange, setTimeRange,
  dateRangeLabel,
  customStart, setCustomStart,
  customEnd, setCustomEnd
}) => {
  return (
    <div className="space-y-2">
        <div className="relative w-full group">
              <div className="absolute left-3 top-2.5 text-slate-500 group-focus-within:text-primary transition-colors">
                <Search size={16}/>
              </div>
              <Input 
                 placeholder="搜尋交易項目、分類..." 
                 className="pl-9 h-10 bg-slate-900 border-slate-700 text-sm w-full focus:ring-primary/50"
                 value={filter}
                 onChange={e => setFilter(e.target.value)}
              />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 flex-wrap">
            <div className="flex items-center gap-2">
              {timeRangeOptions.map((opt) => (
                  <button
                      key={opt.value}
                      onClick={() => setTimeRange(opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex-shrink-0 ${
                          timeRange === opt.value 
                          ? 'bg-slate-700 text-white ring-1 ring-slate-500 shadow-sm' 
                          : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
                      }`}
                  >
                      {opt.label}
                  </button>
              ))}
            </div>
            <div className="ml-auto text-[10px] text-slate-500 font-mono whitespace-nowrap flex items-center bg-slate-900/80 px-2 py-1 rounded border border-slate-800">
                 <Calendar size={10} className="mr-1.5"/> {dateRangeLabel}
            </div>
        </div>

        {/* Custom Date Inputs (Conditional) */}
        {timeRange === 'CUSTOM' && (
            <div className="flex items-center gap-2 bg-slate-900/80 p-2 rounded-lg border border-slate-700 animate-fade-in">
                <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-8 text-xs p-1"/>
                <span className="text-slate-500 text-xs">~</span>
                <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-8 text-xs p-1"/>
            </div>
        )}
    </div>
  );
};