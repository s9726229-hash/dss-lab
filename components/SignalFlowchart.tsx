import React from 'react';
import { ArrowDown, ArrowRight } from 'lucide-react';

const Node = ({ label, sub, color }: { label: string; sub?: string; color: string }) => (
    <div className={`px-3 py-2 rounded-xl border text-center bg-slate-900/60 ${color}`}>
        <div className="text-sm font-bold whitespace-nowrap">{label}</div>
        {sub && <div className="text-xs text-slate-400 mt-0.5 font-mono whitespace-nowrap">{sub}</div>}
    </div>
);

const Down = ({ label }: { label?: string }) => (
    <div className="flex flex-col items-center text-slate-500 my-1">
        <ArrowDown size={18} />
        {label && <span className="text-xs text-slate-500 mt-0.5 text-center max-w-[280px] leading-tight">{label}</span>}
    </div>
);

const Branch = ({ from, to, label, color }: { from: string; to: string; label: string; color: string }) => (
    <div className="flex items-center gap-2 bg-slate-900/40 border border-slate-800 rounded-lg px-3 py-2 flex-wrap">
        <span className="text-sm text-slate-400 whitespace-nowrap">{from}</span>
        <ArrowRight size={16} className="text-slate-600 shrink-0" />
        <span className="text-xs text-slate-500 italic flex-1 min-w-[140px]">{label}</span>
        <ArrowRight size={16} className="text-slate-600 shrink-0" />
        <span className={`text-sm font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${color}`}>{to}</span>
    </div>
);

const Stage = ({ step, title, desc, children }: { step: string; title: string; desc: string; children: React.ReactNode }) => (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 md:p-5 w-full">
        <div className="flex items-baseline gap-2 mb-1">
            <span className="bg-indigo-500 text-slate-900 text-xs font-bold px-1.5 py-0.5 rounded">{step}</span>
            <h4 className="text-base md:text-lg font-bold text-slate-200">{title}</h4>
        </div>
        <p className="text-sm text-slate-400 mb-3">{desc}</p>
        <div className="flex flex-col gap-2 items-stretch">{children}</div>
    </div>
);

export const SignalFlowchart: React.FC = () => {
    return (
        <div className="flex flex-col items-center gap-0 w-full">

            <Stage step="1" title="大盤模式判斷" desc="TWII Bias20 與單日跌幅，決定本輪是否允許買進">
                <div className="flex flex-wrap justify-center gap-2">
                    <Node label="⚪ 平穩" sub="允許買進" color="border-slate-600 text-slate-300" />
                    <Node label="🟡 保守" sub="僅警示，不阻斷買進" color="border-amber-500/40 text-amber-400" />
                    <Node label="🔴 防禦" sub="只出不進" color="border-rose-500/40 text-rose-400" />
                </div>
            </Stage>

            <Down label="依資產分類(ETF/上市/上櫃)套用對應乖離/RSI/斜率門檻" />

            <Stage step="2" title="技術面初判" desc="乖離率、乖離斜率、RSI 是否同時達標，產生基礎燈號">
                <div className="flex flex-wrap justify-center gap-2">
                    <Node label="🚀/🔴 強買/買進" sub="Bias≤門檻 且 RSI達標 且 斜率↑" color="border-rose-500/40 text-rose-400" />
                    <Node label="🟡 分批停利" sub="Bias≥門檻 且 斜率連跌" color="border-amber-500/40 text-amber-400" />
                    <Node label="🟢 強制停利" sub="Bias≥強制門檻" color="border-green-500/40 text-green-400" />
                    <Node label="⚪ 無訊號/風險預警" sub="未達任何門檻" color="border-slate-600 text-slate-400" />
                </div>
            </Stage>

            <Down label="僅作用於偏多訊號(強買/買進)或中性/預警狀態" />

            <Stage step="3" title="籌碼面共振 / 背離修正" desc="外資投信買賣超天數 + 融資增減幅，升級或降級技術面初判">
                <Branch from="偏多訊號" to="🚀 強力布局" label="外資+投信 近5日各≥3日買超" color="bg-red-500/20 text-red-400" />
                <Branch from="偏多訊號" to="🟠 持續觀察" label="外資連賣≥3日 且 融資增幅≥+2%" color="bg-orange-500/20 text-orange-400" />
                <Branch from="中性/預警/分批停利" to="🟢 建議賣出" label="外資+投信 近5日各≥3日賣超" color="bg-green-500/20 text-green-400" />
                <div className="text-[10px] text-slate-500 text-center mt-1">未觸發任何條件 → 維持第 2 階段的原始燈號</div>
            </Stage>

            <Down label="僅持股中(isHeld)才檢查，最高優先、覆寫以上所有結果" />

            <Stage step="4" title="停損層覆寫" desc="三層防護依序檢查（ETF 免除），任一觸發即覆寫">
                <div className="flex flex-wrap justify-center gap-2">
                    <Node label="① 損益停損" sub="未實現損益 ≤ 停損門檻" color="border-green-600/50 text-green-400" />
                    <Node label="② 乖離破底" sub="Bias20 ≤ 破底門檻" color="border-green-600/50 text-green-400" />
                    <Node label="③ 風險預警" sub="Bias20 ≤ 預警門檻（提示不強制）" color="border-amber-500/40 text-amber-400" />
                </div>
            </Stage>

            <Down label="僅當第2~4階段最終仍為 無訊號(NONE) 或 風險預警 時，才會額外執行第5階段" />

            <Stage step="5" title="醞釀訊號分析（觀望期間）" desc="第1~4階段都沒有產生正式燈號時的補充分析，本身不是正式訊號">
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-sm text-amber-300 font-bold">
                    ⚠ 重點：會觸發「醞釀」代表目前還沒有確切訊號，只是先告訴你哪些條件已經接近達標，仍需自行判斷是否進場/出場
                </div>
                <Branch from="乖離已過熱(≥停利門檻)" to="🟡 醞釀停利/高位勿追" label="不論斜率方向，優先判定賣出方向" color="bg-amber-500/20 text-amber-400" />
                <Branch from="未過熱" to="🔴 醞釀買進/強買" label="乖離 或 RSI 或 斜率 任一達標" color="bg-rose-500/20 text-rose-400" />
                <Branch from="未過熱且未達買進條件" to="🟡 醞釀停利/高位勿追" label="斜率連跌 達門檻" color="bg-amber-500/20 text-amber-400" />
            </Stage>

            <Down label="最終顯示於 訊號(技術) / 訊號(籌碼) 兩欄" />

            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 md:p-5 w-full">
                <h4 className="text-base md:text-lg font-bold text-slate-200 mb-3">最終燈號（依嚴重度配色）</h4>
                <div className="flex flex-wrap justify-center gap-2">
                    <Node label="🟢 停損/強制停利" color="border-green-600/50 text-green-400" />
                    <Node label="🟠 持續觀察/籌碼疑慮" color="border-orange-500/40 text-orange-400" />
                    <Node label="🟡 分批停利/醞釀停利" color="border-amber-500/40 text-amber-400" />
                    <Node label="🔴 買進/強買/醞釀買進" color="border-rose-500/40 text-rose-400" />
                    <Node label="🚀 強力布局" color="border-red-500/40 text-red-400" />
                    <Node label="⚪ 無訊號" color="border-slate-600 text-slate-400" />
                </div>
            </div>
        </div>
    );
};
