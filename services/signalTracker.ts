/**
 * 訊號成效持續追蹤（第三階段⑨）
 *
 * 即時分析（Watchlist / Investments）每產生一個非中性主燈號，就記錄一筆
 * {日期, 代號, 分類, 訊號, 當日價}；之後在 DSS 實驗室「訊號成效」分頁
 * 手動回填發訊後 5/10/20/30 個交易日的報酬，統計各燈號的實際預測力。
 *
 * 設計原則：
 * - 同一「代號＋日期」只保留一筆（當天重複分析以最後一次為準；訊號變更則清掉已回填的報酬）
 * - 報酬回填後不再重算（快照制）
 * - 只記正式燈號，不記醞釀提示（SignalHint）
 */

export interface SignalForwardReturns {
    d5: number | null;
    d10: number | null;
    d20: number | null;
    d30: number | null;
}

export interface SignalRecord {
    /** 發訊日（本地日期 YYYY-MM-DD；假日發訊時回填以下一個交易日起算） */
    date: string;
    symbol: string;
    category: 'ETF' | '上市' | '上櫃' | '未知';
    signal: string;
    /** 發訊當下顯示價（報酬計算基準） */
    price: number;
    /** 發訊後 N 個交易日報酬 %（未回填為 undefined；已回填但資料不足為 null 之後可再補） */
    fwd?: SignalForwardReturns;
}

const SIGNAL_LOG_KEY = 'ft_dsslab_signal_log';
/** 防爆量上限：超過時移除最舊紀錄 */
const MAX_RECORDS = 2000;

export const getSignalLog = (): SignalRecord[] => {
    try {
        const raw = localStorage.getItem(SIGNAL_LOG_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};

export const saveSignalLog = (log: SignalRecord[]) => {
    try {
        const trimmed = log.length > MAX_RECORDS
            ? [...log].sort((a, b) => a.date.localeCompare(b.date)).slice(log.length - MAX_RECORDS)
            : log;
        localStorage.setItem(SIGNAL_LOG_KEY, JSON.stringify(trimmed));
    } catch { /* 空間不足則放棄本次寫入 */ }
};

/** 本地日期（台灣時區裝置）YYYY-MM-DD */
const todayStr = () => new Date().toLocaleDateString('sv');

const SIZE_TO_CATEGORY: Record<string, SignalRecord['category']> = {
    ETF: 'ETF', LARGE_CAP: '上市', SMALL_CAP: '上櫃', UNKNOWN: '未知',
};

/**
 * 記錄一筆即時訊號。中性（NONE）或無價格不記；同代號同日已有紀錄則覆寫，
 * 訊號種類改變時清除已回填報酬（基準已不同）。
 */
export const logSignal = (
    symbol: string,
    techSignal: string,
    sizeCategory: string,
    price: number | undefined | null,
) => {
    if (techSignal === 'NONE' || !price || price <= 0) return;
    const log = getSignalLog();
    const date = todayStr();
    const idx = log.findIndex(r => r.symbol === symbol && r.date === date);
    const rec: SignalRecord = {
        date, symbol,
        category: SIZE_TO_CATEGORY[sizeCategory] ?? '未知',
        signal: techSignal,
        price,
        fwd: idx >= 0 && log[idx].signal === techSignal ? log[idx].fwd : undefined,
    };
    if (idx >= 0) log[idx] = rec; else log.push(rec);
    saveSignalLog(log);
};

/** 依 K 線交易日索引回填單筆紀錄的 5/10/20/30 日報酬；kline 需涵蓋發訊日之後的區間 */
export const backfillRecord = (
    rec: SignalRecord,
    kline: { date: string; close: number }[],
): SignalRecord => {
    const startIdx = kline.findIndex(r => r.date >= rec.date);
    if (startIdx === -1) return rec;
    const at = (n: number): number | null => {
        const row = kline[startIdx + n];
        return row && rec.price > 0 ? ((row.close - rec.price) / rec.price) * 100 : null;
    };
    return {
        ...rec,
        fwd: {
            d5: rec.fwd?.d5 ?? at(5),
            d10: rec.fwd?.d10 ?? at(10),
            d20: rec.fwd?.d20 ?? at(20),
            d30: rec.fwd?.d30 ?? at(30),
        },
    };
};
