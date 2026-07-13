import React, { useState } from 'react';
import { BookOpen, LineChart, ShieldAlert, CheckCircle2, TrendingUp, Lightbulb, Zap, FileText, GitBranch, FlaskConical, HelpCircle } from 'lucide-react';
import { getTechParameters } from '../services/storage';
import { SignalFlowchart } from '../components/SignalFlowchart';


const DSSLabParamGuide: React.FC = () => (
    <div className="space-y-6">
        <p className="text-sm text-slate-400 leading-relaxed px-1">
            核心目標：從歷史交易紀錄回推「如果進出場時機更精準，技術指標門檻應設多少」，再用統計方法驗證這些門檻是否真的有效（而非只是擬合歷史雜訊）。
        </p>

        {/* ── 流程示意圖 ── */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-slate-300 mb-4">流程示意圖</h3>
            <div className="overflow-x-auto">
                <svg viewBox="0 0 610 145" width="100%" xmlns="http://www.w3.org/2000/svg" style={{minWidth:'460px',display:'block'}}>
                    <defs>
                        <marker id="dss-a" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                            <path d="M0,0 L7,3.5 L0,7 Z" fill="#475569"/>
                        </marker>
                    </defs>

                    {/* ── 主流程：6個方塊 ── */}
                    {/* Box 1: 匯入 x=2 */}
                    <rect x="2" y="5" width="82" height="54" rx="8" fill="rgba(14,165,233,0.12)" stroke="rgba(14,165,233,0.55)" strokeWidth="1.5"/>
                    <text x="43" y="27" textAnchor="middle" fill="#7dd3fc" fontSize="11" fontWeight="bold">① 匯入</text>
                    <text x="43" y="42" textAnchor="middle" fill="#94a3b8" fontSize="10">CSV 交易</text>
                    <text x="43" y="54" textAnchor="middle" fill="#64748b" fontSize="9">紀錄</text>

                    <line x1="85" y1="32" x2="100" y2="32" stroke="#475569" strokeWidth="1.5" markerEnd="url(#dss-a)"/>

                    {/* Box 2: 配對 x=102 */}
                    <rect x="102" y="5" width="82" height="54" rx="8" fill="rgba(139,92,246,0.12)" stroke="rgba(139,92,246,0.55)" strokeWidth="1.5"/>
                    <text x="143" y="27" textAnchor="middle" fill="#c4b5fd" fontSize="11" fontWeight="bold">② 配對</text>
                    <text x="143" y="42" textAnchor="middle" fill="#94a3b8" fontSize="10">FIFO 完整</text>
                    <text x="143" y="54" textAnchor="middle" fill="#64748b" fontSize="9">交易</text>

                    <line x1="185" y1="32" x2="200" y2="32" stroke="#475569" strokeWidth="1.5" markerEnd="url(#dss-a)"/>

                    {/* Box 3: 視窗 x=202 */}
                    <rect x="202" y="5" width="82" height="54" rx="8" fill="rgba(139,92,246,0.12)" stroke="rgba(139,92,246,0.55)" strokeWidth="1.5"/>
                    <text x="243" y="27" textAnchor="middle" fill="#c4b5fd" fontSize="11" fontWeight="bold">③ 視窗</text>
                    <text x="243" y="42" textAnchor="middle" fill="#94a3b8" fontSize="10">±10日進場</text>
                    <text x="243" y="54" textAnchor="middle" fill="#64748b" fontSize="9">＋出場</text>

                    <line x1="285" y1="32" x2="300" y2="32" stroke="#475569" strokeWidth="1.5" markerEnd="url(#dss-a)"/>

                    {/* Box 4: 中位數 x=302 */}
                    <rect x="302" y="5" width="82" height="54" rx="8" fill="rgba(139,92,246,0.12)" stroke="rgba(139,92,246,0.55)" strokeWidth="1.5"/>
                    <text x="343" y="27" textAnchor="middle" fill="#c4b5fd" fontSize="11" fontWeight="bold">④ 中位數</text>
                    <text x="343" y="42" textAnchor="middle" fill="#94a3b8" fontSize="10">類別×訓練</text>
                    <text x="343" y="54" textAnchor="middle" fill="#64748b" fontSize="9">期 70%</text>

                    <line x1="385" y1="32" x2="400" y2="32" stroke="#475569" strokeWidth="1.5" markerEnd="url(#dss-a)"/>

                    {/* Box 5: 設定檔 x=402 */}
                    <rect x="402" y="5" width="82" height="54" rx="8" fill="rgba(16,185,129,0.12)" stroke="rgba(16,185,129,0.55)" strokeWidth="1.5"/>
                    <text x="443" y="27" textAnchor="middle" fill="#6ee7b7" fontSize="11" fontWeight="bold">⑤ 設定檔</text>
                    <text x="443" y="42" textAnchor="middle" fill="#94a3b8" fontSize="10">BUY / SELL</text>
                    <text x="443" y="54" textAnchor="middle" fill="#64748b" fontSize="9">/ STOP LOSS</text>

                    <line x1="485" y1="32" x2="500" y2="32" stroke="#475569" strokeWidth="1.5" markerEnd="url(#dss-a)"/>

                    {/* Box 6: 驗證 x=502 */}
                    <rect x="502" y="5" width="82" height="54" rx="8" fill="rgba(14,165,233,0.12)" stroke="rgba(14,165,233,0.55)" strokeWidth="1.5"/>
                    <text x="543" y="27" textAnchor="middle" fill="#7dd3fc" fontSize="11" fontWeight="bold">⑥ 回測</text>
                    <text x="543" y="42" textAnchor="middle" fill="#94a3b8" fontSize="10">Match Rate</text>
                    <text x="543" y="54" textAnchor="middle" fill="#64748b" fontSize="9">背離分析</text>

                    {/* ── 統計驗證分支（從④向下） ── */}
                    <line x1="343" y1="60" x2="343" y2="80" stroke="rgba(167,139,250,0.6)" strokeWidth="1.5" strokeDasharray="4,3"/>
                    <rect x="155" y="80" width="376" height="48" rx="8" fill="rgba(109,40,217,0.1)" stroke="rgba(109,40,217,0.45)" strokeWidth="1"/>
                    <text x="343" y="100" textAnchor="middle" fill="#a78bfa" fontSize="11" fontWeight="bold">統計驗證（2026-07-13）</text>
                    <text x="343" y="116" textAnchor="middle" fill="#64748b" fontSize="9">驗證期 30% 純計算檢驗  ⊕  前瞻報酬分析  ⊕  RSI / 斜率增量價值分析</text>
                    <text x="343" y="128" textAnchor="middle" fill="#475569" fontSize="9">→ 詳見「分析摘要」分頁</text>
                </svg>
            </div>
        </div>

        {/* ── 六步驟（簡化版） ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

            {/* ① FIFO配對 */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-5 h-5 rounded-full bg-violet-600/30 text-violet-300 text-xs font-bold flex items-center justify-center shrink-0">①</span>
                    <h4 className="font-bold text-slate-200 text-sm">FIFO 配對</h4>
                </div>
                <p className="text-xs text-slate-400">CSV 匯入 → 依股數 FIFO 配對完整交易，依 ETF／上市／上櫃分類，排除當沖。</p>
            </div>
            {/* ② ±10日進場視窗 */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-5 h-5 rounded-full bg-violet-600/30 text-violet-300 text-xs font-bold flex items-center justify-center shrink-0">②</span>
                    <h4 className="font-bold text-slate-200 text-sm">±10日進場視窗</h4>
                </div>
                <p className="text-xs text-slate-400">固定賣出價，前後 ±10 交易日找報酬最大日，記錄 Bias／RSI／斜率／籌碼指標。</p>
            </div>
            {/* ③ ±10日出場視窗 */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-5 h-5 rounded-full bg-violet-600/30 text-violet-300 text-xs font-bold flex items-center justify-center shrink-0">③</span>
                    <h4 className="font-bold text-slate-200 text-sm">±10日出場視窗</h4>
                </div>
                <p className="text-xs text-slate-400">獲利 → 最佳停利點；虧損 → 損失最小停損點。各有 ±2 日樣本池（一般）與單日（嚴格）兩套。</p>
            </div>
            {/* ④ 類別中位數 */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-5 h-5 rounded-full bg-violet-600/30 text-violet-300 text-xs font-bold flex items-center justify-center shrink-0">④</span>
                    <h4 className="font-bold text-slate-200 text-sm">類別中位數</h4>
                </div>
                <p className="text-xs text-slate-400">訓練期 70%，品質篩選前 70%，取中位數 → BUY／STRONG BUY／SELL／STOP LOSS 四組參數。</p>
            </div>
            {/* ⑤ 存設定檔 */}
            <div className="bg-slate-800/50 border border-emerald-700/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-600/30 text-emerald-300 text-xs font-bold flex items-center justify-center shrink-0">⑤</span>
                    <h4 className="font-bold text-slate-200 text-sm">存設定檔</h4>
                </div>
                <p className="text-xs text-slate-400">一鍵將 Bias20／RSI／斜率套用至系統設定（DSS 參數）；籌碼／強制停利欄位顯示為參考值。</p>
            </div>
            {/* ⑥ 回測驗證 */}
            <div className="bg-slate-800/50 border border-sky-700/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-5 h-5 rounded-full bg-sky-600/30 text-sky-300 text-xs font-bold flex items-center justify-center shrink-0">⑥</span>
                    <h4 className="font-bold text-slate-200 text-sm">回測驗證</h4>
                </div>
                <p className="text-xs text-slate-400">新參數套回歷史資料，看 Match Rate 提升幅度 + 背離原因（漏判／誤判／時點偏移）分類統計。</p>
            </div>
        </div>

        {/* ── 統計驗證方法論 ── */}
        <div className="bg-violet-900/20 border border-violet-500/30 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
                <FlaskConical className="text-violet-400" size={18} /> 統計驗證方法論（2026-07-13 新增）
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
                Step1~6 的原始設計有六個統計問題，2026-07-13 識別並依嚴重度排定修正優先序：
            </p>
            <div className="space-y-3">
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-slate-400">
                    <b className="text-red-300">問題① 同資料驗證（最嚴重）</b>：反推參數的交易池跟驗證效果的交易池是同一批，回測「改善」可能只是擬合歷史雜訊。<br />
                    <b className="text-slate-300">修正（已完成）</b>：各分類依交易日期前 70% 為訓練期、後 30% 為驗證期。中位數與 KEEP_RATIO 篩選只在訓練期計算，驗證期採純計算式檢驗（找訓練期參數達標日、算報酬差）。進場/出場兩張 SplitValidationCard 顯示於各分析分頁。
                </div>
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-slate-400">
                    <b className="text-amber-300">問題② 後見之明定義性偏差</b>：最佳日是事後找最低點，Bias/RSI 跟價格連動，最低點那天指標偏低有一部分是數學必然，不代表指標有預測力。<br />
                    <b className="text-slate-300">修正（已完成）</b>：新增「條件式前瞻報酬分析」—依 Bias20 分桶計算未來 N 天前瞻報酬，直接回答「指標達標後發生什麼」。資料源重用 ft_dsslab_raw_cache（已標注選樣偏誤）。見「前瞻報酬」分頁。
                </div>
                <div className="p-3 bg-slate-700/30 border border-slate-600/30 rounded-xl text-sm text-slate-400">
                    <b className="text-slate-400">問題③~⑥ 次要問題</b>：樣本過小（254 筆後已可行）、KEEP_RATIO 倖存者偏差（已移入訓練期）、跨標的偽重複（已顯示標的分佈卡）、無市場狀態切分（暫不處理）。
                </div>
            </div>

            <div className="pt-3 border-t border-violet-500/20 space-y-3">
                <p className="text-sm font-semibold text-slate-300">第二階段：指標增量價值驗證（做減法）</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-400">
                    <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                        <b className="text-slate-300">④ RSI 增量分析（已完成，2026-07-13）</b><br />
                        比較實際進場時 RSI&lt;45 vs RSI≥45 報酬差異。<b className="text-emerald-400">ETF/上櫃 RSI&lt;45 報酬明顯較高</b>（ETF: +49.5% vs +32.5%）；<b className="text-amber-400">上市幾乎不在 RSI&lt;45 觸發</b>（254 筆中僅 1 筆），此條件對上市形同虛設。
                    </div>
                    <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                        <b className="text-slate-300">⑤ 斜率確認棒數（已完成，2026-07-13）</b><br />
                        比較 20MA 連升 0/1/≥2 天報酬差異。<b className="text-red-300">ETF 三組差距 &lt;3pp、完全無鑑別力</b>；上市斜率=1天略優但≥2天反而最差；上櫃方向不一致。<b className="text-red-300">整體建議移除斜率條件</b>。
                    </div>
                    <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-600/30 opacity-60">
                        <b className="text-slate-400">⑥ 籌碼覆寫規則（待 FinMind 額度）</b><br />
                        驗證「法人棄守後 N 天實際跌幅」是否支撐現有籌碼覆寫規則設計前提。
                    </div>
                    <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-600/30 opacity-60">
                        <b className="text-slate-400">第三階段（未開始）</b><br />
                        Bias 門檻改波動自適應 z-score、保守模式回測、訊號成效持續追蹤、參數版本化。
                    </div>
                </div>
                <p className="text-[11px] text-slate-500">詳細數字見 DSS 實驗室 → <b>分析摘要</b> 分頁。</p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
                <h3 className="text-sm font-bold text-amber-300 mb-2 flex items-center gap-1.5"><HelpCircle size={15} /> 待確認</h3>
                <p className="text-xs text-slate-400">各分類目前是「混合跑、事後分類統計」，並非先各自獨立跑；後者是另一種架構，目前不採用。</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
                <h3 className="text-sm font-bold text-sky-300 mb-2 flex items-center gap-1.5"><Lightbulb size={15} /> 未來規劃</h3>
                <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                    <li>參數版本化：不同 DSSProfile 互比績效</li>
                    <li>匯入交易後自動觸發分析</li>
                    <li>分位數修正暫緩（收斂迴圈尚無量化停止標準）</li>
                </ul>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
                <h3 className="text-sm font-bold text-red-300 mb-2 flex items-center gap-1.5"><ShieldAlert size={15} /> 已知限制</h3>
                <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                    <li>FinMind 額度用盡時資料取得失敗；共用原始資料快取可緩解但無法消除</li>
                    <li>FIFO 修正後約 10–15% 標的快取失效，需重抓</li>
                    <li>定期定額交易拉低 Match Rate；已支援手動標記排除</li>
                </ul>
            </div>
        </div>
    </div>
);

export const TechDocs: React.FC = () => {
    const p = getTechParameters();
    const [activeTab, setActiveTab] = useState<'docs' | 'flow' | 'dsslab'>('docs');
    return (
        <div className="space-y-6 animate-fade-in p-2 md:p-6 pb-24">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                    <BookOpen size={24} className="text-indigo-400" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-white">V5.0 DSS 決策輔助系統 (雙軌制)</h2>
                    <p className="text-slate-400">基於技術面乖離率與籌碼面共振的雙軌 AI 評估引擎｜最終交易決策由使用者自行判斷</p>
                </div>
            </div>

            {/* 分頁切換 */}
            <div className="flex gap-2 border-b border-slate-800">
                <button
                    onClick={() => setActiveTab('docs')}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${activeTab === 'docs' ? 'bg-slate-800/50 text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <FileText size={16} /> 文字說明
                </button>
                <button
                    onClick={() => setActiveTab('flow')}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${activeTab === 'flow' ? 'bg-slate-800/50 text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <GitBranch size={16} /> 決策流程圖
                </button>
                <button
                    onClick={() => setActiveTab('dsslab')}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${activeTab === 'dsslab' ? 'bg-slate-800/50 text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <FlaskConical size={16} /> DSS 參數提取機制
                </button>
            </div>

            {activeTab === 'flow' ? <SignalFlowchart /> : activeTab === 'dsslab' ? <DSSLabParamGuide /> : <>

            {/* ── 1. 燈號快速對照（最重要，放最前） ── */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                    <Zap className="text-amber-400" /> DSS 決策輔助燈號快速對照表
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                    {/* 買進類 */}
                    <div className="bg-slate-900/50 p-3 rounded-xl border border-red-500/30">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400">🚀 強力布局</span>
                        <p className="text-[11px] text-slate-400 mt-1.5">Bias≤強買門檻＋RSI＋斜率↑＋外資投信同買，最高優先做多訊號。</p>
                    </div>

                    <div className="bg-slate-900/50 p-3 rounded-xl border border-rose-500/20">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400">🔴 適合布局</span>
                        <p className="text-[11px] text-slate-400 mt-1.5">Bias≤買進門檻＋斜率反轉＋RSI達標，技術面基礎布局條件成立。</p>
                    </div>

                    <div className="bg-slate-900/50 p-3 rounded-xl border border-violet-500/20">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-violet-500/20 text-violet-400">🟣 醞釀中</span>
                        <p className="text-[11px] text-slate-400 mt-1.5">乖離 / RSI / 斜率任一項已達門檻（不需乖離優先），條件小標逐項標示已達標（買進方向紅／賣出方向綠）／未達（灰）。持股顯示「醞釀停利」、未持股顯示「高位勿追」。</p>
                    </div>

                    <div className="bg-slate-900/50 p-3 rounded-xl border border-amber-500/20">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400">🟡 分批停利</span>
                        <p className="text-[11px] text-slate-400 mt-1.5">Bias≥停利門檻且斜率連降，正乖離過大、動能衰退，建議分批獲利。</p>
                    </div>

                    <div className="bg-slate-900/50 p-3 rounded-xl border border-orange-500/20">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-500/20 text-orange-400">🟠 持續觀察</span>
                        <p className="text-[11px] text-slate-400 mt-1.5">原訊號偏多但外資連賣≥{p.chipInstDays}日＋融資連增≥{p.chipMarginDays}日，籌碼背離降級觀察。</p>
                    </div>

                    <div className="bg-slate-900/50 p-3 rounded-xl border border-green-500/20">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-500/20 text-green-400">🟢 強制停利 / 建議賣出</span>
                        <p className="text-[11px] text-slate-400 mt-1.5">Bias≥強制門檻或法人雙向棄守，建議清倉出局。</p>
                    </div>

                    <div className="bg-slate-900/50 p-3 rounded-xl border border-green-700/50">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-700 text-white">⚠️ 停損預警 / 風險預警</span>
                        <p className="text-[11px] text-slate-400 mt-1.5">三層防護（ETF免除）：損益停損→乖離破底→乖離預警區（提示不強制）。</p>
                    </div>
                </div>
            </div>

            {/* ── 2. 處理流程 ── */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                    <CheckCircle2 className="text-sky-400" /> 雙軌分析處理步驟 (Step-by-Step)
                </h3>
                <div className="flex flex-col sm:flex-row gap-2 items-stretch">
                    {[
                        { step: '1', color: 'emerald', title: '大盤偵測', desc: 'TWII Bias20：≤-5% 保守、≤-10% 防禦（防禦阻斷所有買進）' },
                        { step: '2', color: 'amber', title: '第一軌 技術面', desc: '依資產類別比對乖離率 / 斜率 / RSI，產生基礎燈號' },
                        { step: '3', color: 'sky', title: '第二軌 籌碼面', desc: 'FinMind API：外資投信連買賣天數（設定值）+ 融資連增/連減天數（設定值）' },
                        { step: '4', color: 'indigo', title: '共振 / 背離修正', desc: '法人共振→升級；外資賣+融資連增≥門檻→降級觀察' },
                        { step: '5', color: 'violet', title: '醞釀訊號分析', desc: '無訊號時，乖離/RSI/斜率任一項達標即提示醞釀方向' },
                        { step: '6', color: 'rose', title: '最終決策（人類）', desc: '系統輔助，買賣操作仍由使用者自行判斷' },
                    ].map(({ step, color, title, desc }) => (
                        <div key={step} className={`flex-1 bg-slate-900/50 p-3 rounded-xl border border-${color}-500/20 flex flex-col gap-1`}>
                            <div className={`text-xs font-bold text-${color}-400 flex items-center gap-1`}>
                                <span className={`bg-${color}-500 text-slate-900 px-1.5 py-0.5 rounded text-[10px]`}>{step}</span>
                                {title}
                            </div>
                            <p className="text-[11px] text-slate-400 leading-relaxed">{desc}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── 3. 第一軌：技術面 ── */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                    <BookOpen className="text-emerald-400" /> 第一軌：技術面基礎判斷邏輯（依資產分類）
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-slate-900/50 text-slate-400 text-xs">
                            <tr>
                                <th className="p-2 border border-slate-700 w-20">分類</th>
                                <th className="p-2 border border-slate-700">🔴 買進 / 強買</th>
                                <th className="p-2 border border-slate-700">🟡 停利 / 🟢 強制停利</th>
                                <th className="p-2 border border-slate-700">⚠️ 停損防護</th>
                            </tr>
                        </thead>
                        <tbody className="text-slate-300 text-xs">
                            <tr>
                                <td className="p-2 border border-slate-700 font-bold text-emerald-400">ETF</td>
                                <td className="p-2 border border-slate-700">
                                    Bias ≤ {p.etfBuyBias}%（普）/ ≤ {p.etfStrongBuyBias}%（強）<br/>
                                    <b className="text-white">且</b> 斜率反轉 <b className="text-white">且</b> RSI &lt; {p.etfBuyRsi}/{p.etfStrongBuyRsi}
                                </td>
                                <td className="p-2 border border-slate-700">
                                    分批停利：Bias ≥ +{p.etfPartialSellBias}%<br/>
                                    第二批：Bias ≥ +{p.etfSecondPartialSellBias}%<br/>
                                    <span className="text-slate-500 text-[10px]">需斜率連降確認</span>
                                </td>
                                <td className="p-2 border border-slate-700 text-slate-500">無停損機制<br/>視為長線持有</td>
                            </tr>
                            <tr>
                                <td className="p-2 border border-slate-700 font-bold text-blue-400">上市（TSE）</td>
                                <td className="p-2 border border-slate-700">
                                    Bias ≤ {p.largeCapBuyBias}%（普）/ ≤ {p.largeCapStrongBuyBias}%（強）<br/>
                                    <b className="text-white">且</b> 斜率反轉 <b className="text-white">且</b> RSI &lt; {p.largeCapBuyRsi}/{p.largeCapStrongBuyRsi}
                                </td>
                                <td className="p-2 border border-slate-700">
                                    分批停利：Bias ≥ +{p.largeCapPartialSellBias}%<br/>
                                    強制停利：Bias ≥ +{p.largeCapForceSellBias}%
                                </td>
                                <td className="p-2 border border-slate-700">
                                    損益停損：≤ <b className="text-emerald-400">{p.largeCapStopLossPnL}%</b><br/>
                                    乖離破底：≤ {p.largeCapStopLossBias}%<br/>
                                    風險預警：≤ {p.largeCapRiskAlertBias}%
                                </td>
                            </tr>
                            <tr>
                                <td className="p-2 border border-slate-700 font-bold text-purple-400">上櫃（OTC）</td>
                                <td className="p-2 border border-slate-700">
                                    Bias ≤ {p.smallCapBuyBias}%（普）/ ≤ {p.smallCapStrongBuyBias}%（強）<br/>
                                    <b className="text-white">且</b> 斜率反轉 <b className="text-white">且</b> RSI &lt; {p.smallCapBuyRsi}/{p.smallCapStrongBuyRsi}
                                </td>
                                <td className="p-2 border border-slate-700">
                                    分批停利：Bias ≥ +{p.smallCapPartialSellBias}%<br/>
                                    強制停利：Bias ≥ +{p.smallCapForceSellBias}%
                                </td>
                                <td className="p-2 border border-slate-700">
                                    損益停損：≤ <b className="text-emerald-400">{p.smallCapStopLossPnL}%</b><br/>
                                    乖離破底：≤ {p.smallCapStopLossBias}%<br/>
                                    風險預警：≤ {p.smallCapRiskAlertBias}%
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p className="text-xs text-slate-500 mt-3">
                    <b className="text-slate-300">V7.9.0 簡化：</b>移除 ETF 的獨立加碼層（ADDITIONAL_BUY / STRONG_ADDITIONAL_BUY）與上市/上櫃的順勢加碼層（TREND_ADD），不再有專屬的「加碼」正式燈號。「該不該加碼」改由下方<b className="text-slate-300">醞釀買進</b>提示涵蓋——中波段操作下正式買進燈號本就不易觸發，加碼判斷交給醞釀訊號的乖離/RSI/斜率條件追蹤即可，邏輯更單純。同時移除「連續3筆虧損鎖進保守模式」的特殊規則，以及 ETF 原本獨立於大盤模式之外、自行依乖離率判斷防禦與否的例外機制——三種資產分類現在共用同一套大盤模式（NORMAL/CONSERVATIVE/DEFENSIVE）判斷 canBuy，僅保留「ETF 無停損層」這個既有的不對稱設計。
                </p>
            </div>

            {/* ── 4. 醞釀訊號 ── */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-slate-200 mb-3 flex items-center gap-2">
                    <Lightbulb className="text-violet-400" /> 醞釀訊號（SignalHint）：觀望期間的條件追蹤
                </h3>
                <p className="text-xs text-slate-400 mb-3">技術面燈號為「中性」或「風險預警」時，乖離 / RSI / 斜率任一項先達標即提示醞釀方向（不需乖離優先達標），條件小標逐項標示達標(買進方向紅／賣出方向綠)／未達(灰)，左側對應欄位同步亮底色，方便互相對照。<b className="text-slate-300"> 即使籌碼面將訊號覆寫（如降級為持續觀察），醞釀提示仍獨立顯示，讓技術面進場機會不被遮蓋。</b></p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-slate-900/50 p-3 rounded-xl border border-rose-500/20">
                        <div className="text-rose-400 font-bold text-sm mb-1">🔴 醞釀強買 / 醞釀買進</div>
                        <p className="text-xs text-slate-400">乖離 / RSI / 斜率任一達標，依乖離深度自動分強買或一般買進等級。</p>
                    </div>
                    <div className="bg-slate-900/50 p-3 rounded-xl border border-amber-500/20">
                        <div className="text-amber-400 font-bold text-sm mb-1">🟡 醞釀停利（持股）</div>
                        <p className="text-xs text-slate-400">有持股時，乖離或斜率任一達停利門檻即提示。</p>
                    </div>
                    <div className="bg-slate-900/50 p-3 rounded-xl border border-amber-500/20">
                        <div className="text-amber-400 font-bold text-sm mb-1">🟡 高位勿追（無持股）</div>
                        <p className="text-xs text-slate-400">選股掃描無持股情境下的同一邏輯，語意改為提醒勿追高。</p>
                    </div>
                </div>
            </div>

            {/* ── 5. 第二軌：籌碼面 ── */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-slate-200 mb-3 flex items-center gap-2">
                    <TrendingUp className="text-purple-400" /> 第二軌：籌碼面輔助確認邏輯
                </h3>
                <p className="text-xs text-slate-400 mb-4">資料來源：FinMind API。追蹤外資/投信連買賣天數（設定值 {p.chipInstDays} 日視為表態）與融資連增/連減天數（設定值 {p.chipMarginDays} 日）。</p>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-slate-900/50 text-slate-400 text-xs">
                            <tr>
                                <th className="p-2 border border-slate-700 w-28">情境</th>
                                <th className="p-2 border border-slate-700">觸發條件</th>
                                <th className="p-2 border border-slate-700">系統行為與燈號變化</th>
                            </tr>
                        </thead>
                        <tbody className="text-slate-300 text-xs">
                            <tr>
                                <td className="p-2 border border-slate-700"><span className="text-red-400 font-bold">🔴 籌碼共振</span><br/><span className="text-slate-500 text-[10px]">升級</span></td>
                                <td className="p-2 border border-slate-700">
                                    原訊號偏多<br/>
                                    <b className="text-white">且</b> 外資連買 ≥ {p.chipInstDays}日<br/>
                                    <b className="text-white">且</b> 投信連買 ≥ {p.chipInstDays}日
                                </td>
                                <td className="p-2 border border-slate-700">升級為 <span className="text-red-400 font-bold bg-red-500/10 px-1 rounded">🚀 強力布局</span>，法人雙向認同，勝率顯著提升。</td>
                            </tr>
                            <tr>
                                <td className="p-2 border border-slate-700"><span className="text-orange-400 font-bold">🟠 籌碼背離</span><br/><span className="text-slate-500 text-[10px]">降級</span></td>
                                <td className="p-2 border border-slate-700">
                                    原訊號偏多<br/>
                                    <b className="text-white">但</b> 外資連賣 ≥ {p.chipInstDays}日<br/>
                                    <b className="text-white">且</b> 融資連增 <b className="text-amber-400">≥ {p.chipMarginDays}日</b>（散戶追高）
                                </td>
                                <td className="p-2 border border-slate-700">降級為 <span className="text-orange-400 font-bold bg-orange-500/10 px-1 rounded">🟠 持續觀察</span>，法人出、散戶接，謹慎。</td>
                            </tr>
                            <tr>
                                <td className="p-2 border border-slate-700"><span className="text-emerald-400 font-bold">🟢 主力棄守</span><br/><span className="text-slate-500 text-[10px]">警報</span></td>
                                <td className="p-2 border border-slate-700">
                                    原訊號偏弱/中性<br/>
                                    <b className="text-white">且</b> 外資連賣 ≥ {p.chipInstDays}日<br/>
                                    <b className="text-white">且</b> 投信連賣 ≥ {p.chipInstDays}日
                                </td>
                                <td className="p-2 border border-slate-700">強制轉為 <span className="text-emerald-400 font-bold bg-emerald-500/10 px-1 rounded">🟢 建議賣出</span>，外資投信同步撤退。</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div className="mt-3 p-3 bg-slate-900/60 rounded-lg border border-slate-700 text-xs text-slate-400">
                    <b className="text-slate-300">UI 顯示：</b> 外資/投信/融資若觸發條件，欄位會亮起底色，並顯示小文字提示，例如
                    <span className="bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded mx-1">連買3日</span>
                    <span className="bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded mx-1">連賣</span>
                    <span className="bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded mx-1">融資大增</span>
                </div>
            </div>

            {/* ── 6. 籌碼常駐偵測（ChipHint） ── */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-slate-200 mb-3 flex items-center gap-2">
                    <Zap className="text-purple-400" /> 籌碼常駐偵測（ChipHint）：獨立於主燈號之外
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                    ChipHint 對<b className="text-slate-300">所有訊號狀態</b>都持續維護，不被主燈號覆寫。即使主訊號是「強力布局」或「停損預警」，籌碼燈號欄仍會獨立顯示當前籌碼狀態。偵測優先順序：強烈警示 → 背離警示 → 中性評分。
                </p>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-slate-900/50 text-slate-400 text-xs">
                            <tr>
                                <th className="p-2 border border-slate-700 w-28">籌碼燈號</th>
                                <th className="p-2 border border-slate-700">觸發條件</th>
                                <th className="p-2 border border-slate-700">優先順序</th>
                            </tr>
                        </thead>
                        <tbody className="text-slate-300 text-xs">
                            <tr>
                                <td className="p-2 border border-slate-700"><span className="text-emerald-400 font-bold">🟢 法人棄守</span></td>
                                <td className="p-2 border border-slate-700">外資連賣 ≥ {p.chipInstDays}日 <b className="text-white">且</b> 投信連賣 ≥ {p.chipInstDays}日</td>
                                <td className="p-2 border border-slate-700 text-slate-400">第 1 優先（最高警示）</td>
                            </tr>
                            <tr>
                                <td className="p-2 border border-slate-700"><span className="text-orange-400 font-bold">🟠 籌碼疑慮</span></td>
                                <td className="p-2 border border-slate-700">外資連賣 ≥ {p.chipInstDays}日 <b className="text-white">且</b> 融資連增 ≥ {p.chipMarginDays}日</td>
                                <td className="p-2 border border-slate-700 text-slate-400">第 2 優先</td>
                            </tr>
                            <tr>
                                <td className="p-2 border border-slate-700"><span className="text-rose-400 font-bold">🔴 籌碼偏多</span></td>
                                <td className="p-2 border border-slate-700">三項中 ≥ 2 項成立：外資連買≥{p.chipInstDays}日、投信連買≥{p.chipInstDays}日、融資連增≥1日</td>
                                <td className="p-2 border border-slate-700 text-slate-400">中性評分（≥2項偏多）</td>
                            </tr>
                            <tr>
                                <td className="p-2 border border-slate-700"><span className="text-cyan-400 font-bold">🔵 籌碼觀察</span></td>
                                <td className="p-2 border border-slate-700">三項中剛好 1 項成立</td>
                                <td className="p-2 border border-slate-700 text-slate-400">中性評分（1項偏多）</td>
                            </tr>
                            <tr>
                                <td className="p-2 border border-slate-700"><span className="text-amber-400 font-bold">🟡 籌碼偏弱</span></td>
                                <td className="p-2 border border-slate-700">無偏多條件 <b className="text-white">且</b>（外資賣≥1日 <b className="text-white">或</b> 投信賣≥1日 <b className="text-white">或</b> 融資連減≥1日）</td>
                                <td className="p-2 border border-slate-700 text-slate-400">中性評分（偏弱跡象）</td>
                            </tr>
                            <tr>
                                <td className="p-2 border border-slate-700"><span className="text-slate-400 font-bold">⚪ 籌碼中性</span></td>
                                <td className="p-2 border border-slate-700">以上皆不符合</td>
                                <td className="p-2 border border-slate-700 text-slate-400">中性評分（無明顯方向）</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div className="mt-3 p-3 bg-slate-900/60 rounded-lg border border-slate-700 text-xs text-slate-400">
                    <b className="text-slate-300">醞釀訊號與 ChipHint 的關係：</b>
                    當技術面顯示「醞釀買進/強買」但籌碼覆寫為「籌碼疑慮」或「法人棄守」時，醞釀提示仍會保留在訊號欄，ChipHint 同步顯示籌碼警示。兩者各自獨立，讓使用者同時掌握技術面機會與籌碼面風險。
                </div>
            </div>

            {/* ── 7. 選股掃描燈號 ── */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-slate-200 mb-3 flex items-center gap-2">
                    <Zap className="text-amber-400" /> 選股掃描燈號（無持倉語意）
                </h3>
                <p className="text-xs text-slate-400 mb-4">無持倉情境，停利類燈號語意轉為「過熱勿追」，門檻與設定頁停利參數共用。</p>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-slate-900/50 text-slate-400 text-xs">
                            <tr>
                                <th className="p-2 border border-slate-700">燈號</th>
                                <th className="p-2 border border-slate-700">觸發條件</th>
                                <th className="p-2 border border-slate-700">對應參數</th>
                                <th className="p-2 border border-slate-700">籌碼輔助</th>
                            </tr>
                        </thead>
                        <tbody className="text-slate-300 text-xs">
                            <tr>
                                <td className="p-2 border border-slate-700"><span className="text-amber-400 font-bold">🟡 高位勿追</span><br/><span className="text-slate-500 text-[10px]">醞釀過熱</span></td>
                                <td className="p-2 border border-slate-700">Bias20 ≥ 停利門檻<br/><b className="text-white">但</b> 斜率尚未連降（動能未止）</td>
                                <td className="p-2 border border-slate-700 font-mono text-[10px]">
                                    上市 ≥ +{p.largeCapPartialSellBias}%<br/>
                                    上櫃 ≥ +{p.smallCapPartialSellBias}%<br/>
                                    ETF ≥ +{p.etfPartialSellBias}%
                                </td>
                                <td className="p-2 border border-slate-700 text-slate-400">不受籌碼覆寫影響</td>
                            </tr>
                            <tr>
                                <td className="p-2 border border-slate-700"><span className="text-amber-400 font-bold">🟡 高位過熱</span><br/><span className="text-slate-500 text-[10px]">過熱確認</span></td>
                                <td className="p-2 border border-slate-700">Bias20 ≥ 停利門檻<br/><b className="text-white">且</b> 斜率連降 N 天（動能衰退）</td>
                                <td className="p-2 border border-slate-700 font-mono text-[10px]">
                                    上市 ≥ +{p.largeCapPartialSellBias}% + 連降{p.largeCapPartialSellSlopeDays}天<br/>
                                    上櫃 ≥ +{p.smallCapPartialSellBias}% + 連降{p.smallCapPartialSellSlopeDays}天<br/>
                                    ETF ≥ +{p.etfPartialSellBias}% + 連降{p.etfPartialSellSlopeDays}天
                                </td>
                                <td className="p-2 border border-slate-700 text-slate-400">不受籌碼覆寫影響</td>
                            </tr>
                            <tr>
                                <td className="p-2 border border-slate-700"><span className="text-orange-400 font-bold">🟠 極度過熱</span><br/><span className="text-slate-500 text-[10px]">ETF 專屬</span></td>
                                <td className="p-2 border border-slate-700">ETF Bias20 ≥ 再次減碼門檻</td>
                                <td className="p-2 border border-slate-700 font-mono text-[10px]">ETF ≥ +{p.etfSecondPartialSellBias}%</td>
                                <td className="p-2 border border-slate-700 text-slate-400">不受籌碼覆寫影響</td>
                            </tr>
                            <tr>
                                <td className="p-2 border border-slate-700"><span className="text-green-400 font-bold">🟢 嚴重過熱</span><br/><span className="text-slate-500 text-[10px]">切勿追高</span></td>
                                <td className="p-2 border border-slate-700">Bias20 ≥ 強制停利門檻（無需斜率）</td>
                                <td className="p-2 border border-slate-700 font-mono text-[10px]">
                                    上市 ≥ +{p.largeCapForceSellBias}%<br/>
                                    上櫃 ≥ +{p.smallCapForceSellBias}%
                                </td>
                                <td className="p-2 border border-slate-700">
                                    外資投信同步連買時附註<br/><span className="text-rose-400/70 text-[10px]">⚡ 籌碼共振（機構承接，仍屬高位）</span><br/>
                                    外資投信同步連賣時附註<br/><span className="text-emerald-400/70 text-[10px]">⚡ 法人同步棄守 強烈建議出場</span>
                                </td>
                            </tr>
                            <tr>
                                <td className="p-2 border border-slate-700"><span className="text-orange-400 font-bold">🟠 籌碼疑慮</span></td>
                                <td className="p-2 border border-slate-700">原訊號偏多<br/><b className="text-white">但</b> 外資連賣 ≥ {p.chipInstDays}日 + 融資連增 ≥ {p.chipMarginDays}日</td>
                                <td className="p-2 border border-slate-700 font-mono text-[10px]">chipInstDays = {p.chipInstDays}日<br/>chipMarginDays = {p.chipMarginDays}日</td>
                                <td className="p-2 border border-slate-700 text-slate-400">籌碼背離強制降級</td>
                            </tr>
                            <tr>
                                <td className="p-2 border border-slate-700"><span className="text-emerald-400 font-bold">⛔ 法人棄守</span></td>
                                <td className="p-2 border border-slate-700">外資連賣 ≥ {p.chipInstDays}日<br/><b className="text-white">且</b> 投信連賣 ≥ {p.chipInstDays}日</td>
                                <td className="p-2 border border-slate-700 font-mono text-[10px]">chipInstDays = {p.chipInstDays}日</td>
                                <td className="p-2 border border-slate-700 text-slate-400">法人雙向棄守，強制覆寫</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── 7. 大盤三段式 ── */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                    <LineChart className="text-sky-400" /> 大盤三段式模式（影響所有個股燈號）
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-slate-900/50 text-slate-400 text-xs">
                            <tr>
                                <th className="p-2 border border-slate-700 w-24">模式</th>
                                <th className="p-2 border border-slate-700">觸發條件</th>
                                <th className="p-2 border border-slate-700">對所有分類（ETF/上市/上櫃）的影響</th>
                            </tr>
                        </thead>
                        <tbody className="text-slate-300 text-xs">
                            <tr>
                                <td className="p-2 border border-slate-700 font-bold text-slate-300">⚪ 平穩</td>
                                <td className="p-2 border border-slate-700">Bias20 &gt; -5% <b className="text-white">且</b> 單日跌 &gt; -3%</td>
                                <td className="p-2 border border-slate-700">允許買進、所有燈號正常運作</td>
                            </tr>
                            <tr>
                                <td className="p-2 border border-slate-700 font-bold text-amber-400">🟡 保守</td>
                                <td className="p-2 border border-slate-700">
                                    Bias20 -5% ~ -10%<br/>
                                    <b className="text-white">或</b> 單日跌 -3% ~ -5%
                                </td>
                                <td className="p-2 border border-slate-700"><b className="text-amber-400">僅警示狀態</b><br/>不阻斷任何買進訊號（搶反彈仍可），提醒使用者大盤轉弱</td>
                            </tr>
                            <tr>
                                <td className="p-2 border border-slate-700 font-bold text-rose-400">🔴 防禦</td>
                                <td className="p-2 border border-slate-700">
                                    Bias20 ≤ -10%<br/>
                                    <b className="text-white">或</b> 單日跌 ≤ -5%
                                </td>
                                <td className="p-2 border border-slate-700"><b className="text-rose-400">只出不進</b><br/>阻斷所有買進（含強買），賣出/停利/停損燈號不受影響</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div className="mt-3 p-3 bg-slate-900/60 rounded-lg border border-slate-700 text-xs text-slate-400">
                    <b className="text-slate-300">分類間唯一差異：</b> V7.9.0 起三種資產分類共用同一套大盤模式判斷（ETF 不再有防禦模式豁免），ETF 與個股唯一的不對稱設計是 <b className="text-slate-300">ETF 無停損層</b>（視為長線持有）。
                </div>
            </div>

            </>}

        </div>
    );
};
