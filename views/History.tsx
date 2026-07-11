import React from 'react';
import { Bot, GitCommit, Clock, CheckCircle2, FlaskConical, Bug, Wrench, CalendarCheck, Info, BookOpen, ListTree, LayoutPanelLeft, GitBranch, PlusCircle, FileText, Tags, FileUp, Sparkles, ShieldCheck, BrainCircuit, FilePenLine, Edit, Pointer, Pencil, Wifi, Layers, CircleDot, MessageSquareText, Camera, Zap, FileSearch, Trash2, TrendingUp, Calculator, GitMerge, UserCheck, Code, Scissors, Timer, Download, RefreshCw, Rocket, AppWindow, Columns, Paintbrush, SlidersHorizontal, Split, Gauge, LayoutGrid, Key, Filter, ClipboardList, Mic, PieChart, Globe } from 'lucide-react';
import { Card } from '../components/ui';

const logs = [
    {
    build: "7.0.3",
    date: "2026-05-30",
    title: "PWA 部署與精準解析 (Update)",
    status: "verified",
    changes: [
      {
        icon: AppWindow,
        color: 'text-emerald-400',
        text: "**PWA 升級**：導入 vite-plugin-pwa，支援將網頁封裝為可安裝的應用程式 (APK/PWA)。"
      },
      {
        icon: FileSearch,
        color: 'text-sky-400',
        text: "**精準解析**：優化股票交易 CSV 解析邏輯，確實抓取並保留股票中文名稱，解決僅顯示代號的問題。"
      },
      {
        icon: ShieldCheck,
        color: 'text-amber-400',
        text: "**效能與安全**：關閉且封裝內部 AI API 請求，改採純粹的本地解析架構，確保資料穩固與反應速度。"
      }
    ]
  },
    {
    build: "7.0.2",
    date: "2026-03-03",
    title: "介面體驗同步 (UI Patch)",
    status: "verified",
    changes: [
      {
        icon: LayoutGrid,
        color: 'text-violet-400',
        text: "**UI 統一**：歷史交易明細表格改版，欄位與視覺風格與庫存列表完全同步。"
      },
      {
        icon: AppWindow,
        color: 'text-slate-400',
        text: "**體驗優化**：強化表格標題的置頂懸浮效果 (Sticky Header)。"
      }
    ]
  },
    {
    build: "7.0.1",
    date: "2026-03-01",
    title: "名稱在地化修復 (Hotfix)",
    status: "verified",
    changes: [
      {
        icon: Globe,
        color: 'text-sky-400',
        text: "**中文正名**：修正更新股價時名稱變為英文的問題，強制鎖定繁體中文來源 (Yahoo TW)。"
      }
    ]
  },
    {
    build: "7.0.0",
    date: "2026-02-28",
    title: "雙核極速引擎 (Major Update)",
    status: "verified",
    changes: [
      {
        icon: Rocket,
        color: 'text-cyan-400',
        text: "**雙核極速引擎**：股價與股息查詢全面導入平行多工技術，速度提升 300%。"
      },
      {
        icon: ShieldCheck,
        color: 'text-emerald-400',
        text: "**智能數據修復**：股息源切換至 HiStock 並加入 20% 防呆，徹底解決 ETF 缺漏與個股異常值。"
      },
      {
        icon: LayoutGrid,
        color: 'text-violet-400',
        text: "**介面升級**：持股數量獨立欄位，資訊閱讀更清晰。"
      }
    ]
  },
    {
    build: "6.9.1",
    date: "2026-02-27",
    title: "股息引擎升級 & 介面增強",
    status: "verified",
    changes: [
      {
        icon: Wrench,
        color: 'text-sky-400',
        text: "**核心升級**：股息搜尋引擎切換至 Goodinfo 策略，大幅提升資料完整率。"
      },
      {
        icon: Calculator,
        color: 'text-teal-400',
        text: "**邏輯優化**：採用 TTM (近一年合計) 算法，精準計算 ETF 與個股年化回報。"
      },
      {
        icon: LayoutGrid,
        color: 'text-violet-400',
        text: "**介面增強**：新增持有股數顯示與頻率中文化。"
      }
    ]
  }
];

const StatusBadge = ({ status }: { status: string }) => {
  const isVerifying = status === 'verifying';
  const title = isVerifying 
    ? "此版本的變更正在等待您的確認。" 
    : "此版本的變更已被後續的操作確認完成。";

  if (isVerifying) {
    return (
      <span title={title} className="flex items-center gap-1.5 text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-1 rounded-full cursor-help">
        <Clock size={12} />
        驗證中 (Verifying)
      </span>
    );
  }
  return (
    <span title={title} className="flex items-center gap-1.5 text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded-full cursor-help">
      <CheckCircle2 size={12} />
      驗證通過 (Verified)
    </span>
  );
};

export const HistoryView: React.FC = () => {
  return (
    <div className="space-y-8 animate-fade-in p-2 md:p-6 pb-24">
      <div className="bg-gradient-to-r from-cyan-500/10 to-slate-800 p-8 rounded-2xl border border-cyan-500/20 shadow-2xl relative overflow-hidden">
         <div className="absolute right-0 top-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>
         <h2 className="text-3xl font-bold text-white flex items-center gap-3 relative z-10">
            <Bot className="text-cyan-400"/> AI 調校日誌
         </h2>
         <p className="text-slate-300 mt-2 relative z-10">追蹤 AI 開發助理對此應用程式的每一次調整與優化紀錄。</p>
      </div>

      <div className="relative pl-4 border-l-2 border-slate-700 ml-4">
        {logs.slice(0, 10).map((log, index) => (
          <div key={index} className="mb-10 pl-8 relative">
            <div className="absolute -left-[11px] top-1 w-5 h-5 bg-slate-800 border-4 border-primary rounded-full ring-8 ring-slate-900"></div>
            
            <Card className="shadow-lg hover:border-slate-600 transition-colors">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-slate-500 bg-slate-900 px-2 py-1 rounded-md border border-slate-700">
                          Build {log.build}
                        </span>
                        <span className="text-xs text-slate-400">{log.date}</span>
                    </div>
                    <StatusBadge status={log.status} />
                </div>
                
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                   <GitCommit className="text-primary/70" size={20}/> {log.title}
                </h3>
                
                <ul className="mt-4 space-y-3 list-none">
                    {log.changes.map((change, i) => {
                        const Icon = change.icon;
                        return (
                            <li key={i} className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                                <Icon size={20} className={`${change.color} mt-0.5 shrink-0`} />
                                <p className="text-slate-300 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: change.text.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-white">$1</strong>') }} />
                            </li>
                        );
                    })}
                </ul>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
};