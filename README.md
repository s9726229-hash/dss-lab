<div align="center">

# 🧪 DSS Lab

**台股技術分析 × DSS 雙軌決策輔助引擎**

![Version](https://img.shields.io/badge/版本-V7.8.0-6366f1?style=for-the-badge)
![React](https://img.shields.io/badge/React-18-61dafb?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=for-the-badge&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-PWA-646cff?style=for-the-badge&logo=vite)

> 所有資料儲存於本地瀏覽器，無伺服器、無資料外洩風險。

</div>

---

## ℹ️ 專案定位

DSS Lab 是從 **[FinTrack AI](https://github.com/s9726229-hash/fintrack-ai-1)** 分拆出來的獨立專案，專門處理台股技術面/籌碼面分析與決策輔助，不處理一般財務記帳。

股票交易資料（庫存/交易紀錄）與 FinTrack AI 各自獨立儲存在瀏覽器 localStorage，透過「匯出 JSON 備份 → 匯入」單向橋接：在 FinTrack AI 的「系統設定」匯出備份，再到本專案的「系統設定」匯入，即可用真實交易資料跑分析。

## ✨ 主要功能

### 📊 DSS 雙軌決策輔助引擎（DSS 實驗室）
- **第一軌 — 技術面**：MA20 乖離率、RSI、均線斜率，依 ETF / 上市（TSE）/ 上櫃（OTC）分類套用不同門檻
- **第二軌 — 籌碼面**：FinMind API 外資、投信連續買賣超 + 融資增減幅，自動共振升級或背離降級
- **±N 日最佳進場/出場分析**：以真實交易結果回推六組參數資料庫（BUY/STRONG BUY/SELL/FORCE SELL/STOP LOSS/FORCE STOP LOSS）中位數
- **背離分析**：漏判、誤判、時點偏移、過早、過晚
- **DSS 回測分析**：含虛擬交易比對

### 📈 選股掃描（Watchlist）
- 多組自選股，批次掃描所有標的技術燈號
- 台股即時價格（TWSE + OTC 雙來源，Cloudflare Worker 代理）
- 5 分鐘自動更新 + 手動觸發

### 💼 股票投資（Investments）
- **庫存總覽**：個股持倉成本、市值、未實現損益
- **技術監控**：持倉個股的技術/籌碼燈號判斷、停損停利門檻預警
- **交易紀錄**：買賣紀錄匯入與定期定額標記
- **股息分析**：除息日、年化殖利率、已領/預估股息

### ⚙️ 可調技術參數（系統設定）
- ETF / 上市 / 上櫃 三類，各自獨立設定買進、強買、加碼、停利、停損、風險預警門檻

---

## 🚀 本地啟動

**需求：** [Node.js](https://nodejs.org/) v18+

```bash
# 1. 安裝依賴
npm install

# 2. 啟動開發伺服器
npm run dev
# → http://localhost:3000
```

### FinMind API Token（選填）
進入「系統設定 → API 金鑰設定」輸入 Token。
未填時使用免費額度（每小時 300 次），籌碼面資料可能受限。

### 匯入 FinTrack AI 的交易資料
1. 在 FinTrack AI「系統設定 → 匯出 JSON 備份」下載備份檔
2. 在本專案「系統設定 → 匯入備份還原」上傳同一份檔案
3. 前往「DSS 實驗室」或「股票投資」即可看到用真實交易資料算出的分析結果

---

## 📦 建置與部署

```bash
npm run build   # 產生 dist/ 靜態檔案
```

---

## 🛠 技術棧

| 項目 | 技術 |
|---|---|
| 前端框架 | React 18 + TypeScript |
| 建置工具 | Vite + vite-plugin-pwa |
| 樣式 | Tailwind CSS（Dark Theme） |
| 台股價格 | TWSE mis.twse.com.tw（Cloudflare Worker 代理） |
| 籌碼資料 | FinMind API（K線、外資、投信、融資） |
| 資料儲存 | localStorage（純本地，無後端） |

---

<div align="center">
  <sub>DSS Lab — 決策輔助工具，最終買賣操作由使用者自行判斷</sub>
</div>
