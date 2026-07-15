/**
 * 訊號燈號共用色彩定義。
 *
 * 台股習慣與美股相反：多方／利多（買進類訊號）= 紅，確定空方（強制停利、建議賣出、停損類訊號）= 綠。
 * 過渡警示層（尚未確定轉空，僅提醒注意）用黃/橘：輕度 = 黃（分批停利、醞釀停利、籌碼偏弱、風險預警），中度 = 橘（籌碼疑慮、持續觀察、再次減碼）。
 * 整體光譜：🔴 偏多 → 🟡/🟠 警示過渡 → 🟢 確定賣出。
 * 「漲跌」「損益」等純數值方向的顏色不受此檔管轄（各畫面已各自處理，維持紅漲綠跌）。
 * 「風險狀態好壞」（大盤模式）與「準確度對錯」（回測吻合/背離）不屬於多空方向，不套用此處的反色邏輯。
 *
 * 技術監控／選股掃描／DSS回測分析三處的訊號燈號共用這份定義，避免各自維護造成配色不一致。
 */

export type TechSignalKey =
    | 'STRONG_BUY' | 'BUY'
    | 'PARTIAL_SELL' | 'SECOND_PARTIAL_SELL' | 'FORCE_SELL'
    | 'STOP_LOSS' | 'STOP_LOSS_ALERT' | 'RISK_ALERT' | 'WATCH_DIVERGE'
    | 'WATCH' | 'NONE';

/** 完整觸發時的訊號 badge 樣式（僅 badge 本身的底色/文字/邊框，不含儲存格外層底色） */
export const TECH_SIGNAL_BADGE_CLASS: Partial<Record<TechSignalKey, string>> = {
    STRONG_BUY: 'bg-red-600/30 text-red-400 border border-red-500/50',
    BUY: 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
    PARTIAL_SELL: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    SECOND_PARTIAL_SELL: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
    WATCH_DIVERGE: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
    FORCE_SELL: 'bg-green-600/30 text-green-400 border border-green-500/50',
    STOP_LOSS: 'bg-green-700/30 text-green-400 border border-green-500/50',
    STOP_LOSS_ALERT: 'bg-green-700 text-white border border-green-500 shadow-lg shadow-green-900/50',
};

export const NEUTRAL_BADGE_CLASS = 'bg-slate-700/50 text-slate-400 border border-slate-600/30';

/** 醞釀狀態（NONE / RISK_ALERT 且有 signalHint）的淡色 badge，依 signalHint.type 決定色系；SELL 醞釀屬過渡警示層＝黃 */
export const brewingBadgeClass = (hintType: string): string =>
    hintType === 'BUY'
        ? 'bg-rose-500/10 text-rose-400/80 border-rose-500/20'
        : 'bg-amber-500/10 text-amber-400/80 border-amber-500/20';

/** 條件小標籤（子條件達標/未達標），達標時依訊號方向決定色系，未達標一律灰階 */
export const conditionChipClass = (hintType: string, satisfied: boolean): string => {
    if (!satisfied) return 'bg-slate-500/20 text-slate-500 opacity-60 border-slate-500/30';
    return hintType === 'BUY'
        ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
        : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
};

/** 籌碼面 hint（chipHint.target 文字關鍵字）badge 色系 */
export const chipHintBadgeClass = (target: string): string => {
    if (target.includes('偏多')) return 'bg-rose-500/10 text-rose-400/80 border-rose-500/20';
    if (target.includes('觀察')) return 'bg-sky-500/10 text-sky-400/80 border-sky-500/20';
    if (target.includes('棄守')) return 'bg-emerald-500/10 text-emerald-400/80 border-emerald-500/20';
    if (target.includes('疑慮')) return 'bg-orange-500/10 text-orange-400/80 border-orange-500/20';
    if (target.includes('偏弱')) return 'bg-amber-500/10 text-amber-400/80 border-amber-500/20';
    return 'bg-slate-500/10 text-slate-400/80 border-slate-500/20';
};

/** 乖離/斜率/RSI 達買進門檻＝紅系，達停損/停利門檻＝綠系（儲存格底色） */
export const THRESHOLD_BUY_HIT_BG = 'bg-rose-900/30';
export const THRESHOLD_SELL_HIT_BG = 'bg-emerald-900/30';
export const THRESHOLD_BUY_HIT_TEXT = 'text-rose-400/80';
export const THRESHOLD_SELL_HIT_TEXT = 'text-emerald-400/80';

/** 外資/投信連買連賣、融資增減的儲存格底色與文字色 */
export const CONSEC_BUY_BG = 'bg-rose-900/30';
export const CONSEC_SELL_BG = 'bg-emerald-900/30';
export const CONSEC_BUY_TEXT = (strong: boolean) => strong ? 'text-rose-400' : 'text-rose-400/50';
export const CONSEC_SELL_TEXT = (strong: boolean) => strong ? 'text-emerald-400' : 'text-emerald-400/50';

/** DSS 實驗室／回測分析的損益文字色：獲利＝紅、虧損＝綠（與股票投資一致） */
export const pnlTextClass = (value: number): string =>
    value > 0 ? 'text-red-400' : value < 0 ? 'text-emerald-400' : 'text-slate-400';

export const pnlTextClassInclusive = (value: number): string =>
    value >= 0 ? 'text-red-400' : 'text-emerald-400';
