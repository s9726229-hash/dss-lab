<div align="center">

# 💹 FinTrack AI

**個人財務 × 台股技術分析 × AI 決策輔助**

![Version](https://img.shields.io/badge/版本-V7.8.0-6366f1?style=for-the-badge)
![React](https://img.shields.io/badge/React-18-61dafb?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=for-the-badge&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-PWA-646cff?style=for-the-badge&logo=vite)

> 所有資料儲存於本地瀏覽器，無伺服器、無資料外洩風險。

</div>

---

## ✨ 主要功能

### 📊 V5.0 DSS 雙軌決策輔助引擎
- **第一軌 — 技術面**：MA20 乖離率、RSI、均線斜率，依 ETF / 上市（TSE）/ 上櫃（OTC）分類套用不同門檻
- **第二軌 — 籌碼面**：FinMind API 外資、投信連續買賣超 + 融資增減幅，自動共振升級或背離降級
- **大盤三段式模式**：平穩 / 保守 / 防禦，動態阻斷或放行買進與加碼訊號
- **醞釀訊號（SignalHint）**：條件未完全觸發時，標示哪些已達標、哪些待確認

### 🔔 燈號一覽
| 燈號 | 說明 |
|---|---|
| 🚀 強力布局 | 技術面 × 籌碼雙向共振，最高優先做多訊號 |
| 🟢 適合布局 | 乖離跌深、斜率反轉、RSI 達標 |
| 🔵 適合加碼 | 持倉中，順勢右側加碼（乖離收斂 + MA20 走揚） |
| 💰 左側攤平 | ETF 專屬，乖離達門檻即可分批買入 |
| 🟣 醞釀中 | 部分條件達標，顯示缺口標籤供觀察 |
| 🟡 分批停利 | 正乖離過大且動能衰退 |
| 🟠 持續觀察 | 技術偏多但籌碼背離（外資賣 + 融資大增） |
| 🔴 強制停利 / 建議賣出 | 極端正乖離，或法人籌碼全面棄守 |
| ⚠️ 停損預警 | 未實現損益或乖離破底，三層防護機制 |

### 📈 選股掃描（Watchlist）
- 多組自選股，批次掃描所有標的技術燈號
- 顯示當日漲跌（今日 vs 昨日收盤）`▲/▼ X.XX (+X.XX%)`
- 台股即時價格（TWSE + OTC 雙來源，Cloudflare Worker 代理）
- 5 分鐘自動更新 + 手動觸發

### 💼 投資組合技術監控（Investments）
- 個股持倉成本 vs 當前價格的技術燈號判斷
- 含持倉損益 (%) 的停損保護（`largeCapStopLossPnL` / `smallCapStopLossPnL`）
- 加碼冷卻計算（距上次買進交易日）

### ⚙️ 可調技術參數（Settings）
- ETF / 上市 / 上櫃 三類，各自獨立設定
- 買進、強買、加碼（乖離 + RSI 範圍 + 冷卻期）、停利、停損、風險預警，全部可調
- 儲存或還原預設後自動觸發重新掃描

### 💰 個人財務管理
- 資產與負債追蹤（含貸款寬限期計算）
- 每月收支、固定收支、預算管理
- AI 語音記帳、電子發票 CSV 匯入
- 現金流預測與淨值趨勢圖
- 股利追蹤：除息日、年化殖利率、入帳紀錄

### ☁️ 資料管理
- 一鍵匯出 / 匯入 JSON 備份
- Google Drive 雲端加密同步（可選）
- PWA：可安裝至手機桌面，離線可用

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
進入「設定 → API 金鑰設定」輸入 Token。  
未填時使用免費額度（每小時 300 次），籌碼面資料可能受限。

---

## 📦 建置與部署

```bash
npm run build   # 產生 dist/ 靜態檔案
```

本專案已設定 GitHub Actions（`.github/workflows/deploy.yml`），push 至 `main` 分支後自動部署至 GitHub Pages。

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
| 雲端同步 | Google Drive API（選用） |

---

<div align="center">
  <sub>FinTrack AI — 決策輔助工具，最終買賣操作由使用者自行判斷</sub>
</div>
