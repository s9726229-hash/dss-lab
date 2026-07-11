# 股票分析模組分拆計畫

> 建立時間：2026-07-08
> 更新時間：2026-07-12
> 狀態：**規劃中 (Planning Only) — 尚未動工，僅記錄決策與現況分析**
> 下次開工前，請直接從此文件接續討論，並決定實際搬遷順序。

## 目標

把「DSS 分析」相關功能搬出這個專案，變成獨立的另一套軟體。
**股票投資（Investments 頁面的庫存總覽 & 交易紀錄）留在 FinTrackAI 本體**，不隨 DSS 搬走——因此淨資產計算（股票市值）完全不受影響，2026-07-12 已排除原本的 (a)/(b)/(c) 三選項討論，因為問題本身不存在了。

搬遷範圍明確包含：
- DSS 機制（DSS 實驗室、DSS 回測分析、V5.0 雙軌決策引擎）
- 參數篩選（±N 日最佳進場/出場分析、六組參數資料庫中位數萃取、背離分析、DSSProfile 設定檔套用）
- 選股掃描（Watchlist）— 本身耦合最淺，直接一起搬

**不搬走、留在本體的**：
- `views/Investments.tsx`（庫存總覽、交易紀錄、技術監控）——繼續是淨資產股票市值的來源
- 對應的 storage keys：`ft_stock_history`、`ft_stock_transactions`、`ft_stock_fee_discount`

## 新專案的資料取得方式（2026-07-12 決定）

新專案（DSS 實驗室/回測/選股掃描）需要庫存 & 交易紀錄資料來跑分析，但這份資料的「本尊」留在 FinTrackAI。決定採用**匯入複本**方式：
- 比照現有 DSS 實驗室「全域數據匯出/匯入」機制，使用者手動從 FinTrackAI 匯出 `stockTransactions`（含庫存）成 JSON，再匯入新專案。
- 單向、非即時同步：新專案裡的是分析用的複本，不寫回、不影響本體資料。
- 使用者需要時（例如交易異動後想重跑分析）手動重新匯出/匯入更新複本。

## 現況分析（搬遷前必須知道的耦合狀況）

### 規模
股票相關程式碼約 5400 行，佔全專案 view/service 程式碼將近一半：
- `views/DSSLab.tsx`：1681 行
- `services/stock.ts`：1603 行
- `views/Watchlist.tsx`：789 行
- `views/Investments.tsx`：746 行
- `views/BacktestView.tsx`：598 行
- `services/signalColors.ts`：75 行
- `views/TechDocs.tsx`：652 行（大部分是股票 DSS 相關文件，非股票部分很少）

### 架構現況：純前端 SPA + localStorage，沒有後端/API 層
這是整個分拆計畫最大的風險來源。目前資料完全存在瀏覽器 localStorage（`services/storage.ts` + `constants.ts` 的 `STORAGE_KEYS`），沒有任何 client-server 邊界。

### 耦合點（依耦合深度排序，最深的排最前面）

1. **股票庫存繼續是 `Asset` 陣列的一部分，且不搬**：`ft_assets` 裡 `type === AssetType.STOCK` 的那幾筆，跟現金/房地產/負債存在同一份陣列，驅動 Dashboard 的淨資產、資產配置圓餅圖（`views/Dashboard.tsx`、`views/Assets.tsx`）。**2026-07-12 決定：`Investments.tsx` 留在本體，此耦合維持原狀，不需處理。**
2. **Dashboard 現金流計算直接讀 `stockTransactions`**：`views/Dashboard.tsx` 拿 `StockTransaction[]` 算已實現損益，當作月度收支的「股票收入」項目。因為交易紀錄留在本體，此耦合同樣維持原狀。
3. **技術監控留在 `views/Investments.tsx`**（MONITOR tab），跟庫存 CRUD 共用同一份 `inventory`、`onUpdate`/`onUpdateMultiple` handler——本體不變動。
4. **DSS 實驗室要搬走，但需要讀 `stockTransactions`**：自己一套快取（`ft_dsslab_raw_cache`、`ft_dsslab_optimal_cache`、`ft_dsslab_exit_cache`、`ft_backtest_cache`、`ft_dss_profiles`），資料來源改為**從本體匯出的複本**（見上方「新專案的資料取得方式」），不是即時讀取本體 state。`ft_tech_params`（`TechParameters`）目前也被 Investments/Watchlist 讀去算訊號燈號——新專案要不要也搬走這份設定，或各自維護一份，待動工時再細看。
5. **選股掃描（Watchlist）幾乎無耦合**：不吃 App 共用 state，自己抓資料、自己管理 `ft_watchlists`，直接搬。

### 目前使用的 storage keys
留在本體（不搬）：`ft_stock_history`、`ft_stock_transactions`、`ft_stock_fee_discount`。
搬到新專案（或在新專案重新建立）：`ft_watchlists`、`ft_tech_params`（待定，見上）、`ft_dsslab_raw_cache`、`ft_dsslab_optimal_cache`、`ft_dsslab_exit_cache`、`ft_backtest_cache`、`ft_dss_profiles`。

## 建議的搬遷策略：先複製、驗證、再移除（非一次性搬移）

1. **複製整個 repo**（不是只挑 DSS 相關檔案）作為新專案起點——因為 DSS 頁面依賴 `components/layout`、`types.ts`、`services/storage.ts` 等共用底層，單獨複製會直接壞掉。
2. 在新專案裡移除非 DSS 頁面（Dashboard、收支記帳、預算、固定收支等）**以及 `Investments.tsx`**（庫存/交易紀錄留在本體，新專案不需要 CRUD 這份資料，只需要讀取匯入的複本），只留 `Watchlist`、`DSSLab`、`BacktestView`、`services/stock.ts`（視情況拆出分析用得到的部分）、`services/signalColors.ts`。
3. 新專案第一次啟動需要「種子資料」：把本體的 `stockTransactions`（含庫存）匯出一次匯入進去（比照 DSS 實驗室既有的「全域數據匯出/匯入」機制延伸）。
4. **這段期間本體維持完全不動**，新專案獨立驗證跑得動、資料正確——不會有功能中斷期。
5. 驗證穩定後，才開始從本體移除 DSS 相關頁面/程式碼/路由（`Watchlist`、`DSSLab`、`BacktestView` 三者）。

## 分拆範圍清單（供未來動工時對照）

**要搬走的**：
- `views/Watchlist.tsx`、`views/DSSLab.tsx`、`views/BacktestView.tsx`
- `services/stock.ts`（DSS 分析用到的部分）、`services/signalColors.ts`
- `views/TechDocs.tsx` 中「DSS 決策輔助系統」「DSS 參數提取機制」相關內容
- storage keys：`ft_watchlists`、`ft_dsslab_*`、`ft_backtest_cache`、`ft_dss_profiles`

**留在 FinTrackAI 本體的**：
- `views/Dashboard.tsx`、`views/Assets.tsx`、`views/Transactions.tsx`、`views/Budget.tsx`、`views/Recurring.tsx`、`views/History.tsx`
- `views/Investments.tsx`（庫存總覽、交易紀錄、技術監控）——**2026-07-12 決定保留，不搬**
- `services/finance.ts`、`services/storage.ts`
- storage keys：`ft_assets`、`ft_transactions`、`ft_recurring`、`ft_recurring_executed`、`ft_portfolio_history`、`ft_budgets`、`ft_stock_history`、`ft_stock_transactions`、`ft_stock_fee_discount`

**待決定歸屬**：
- `ft_tech_params`（`TechParameters`）：新專案是否需要獨立一份，還是隨匯入複本一起帶過去，動工時再定
- `services/stock.ts` 是否需要拆成「本體用（庫存/交易 CRUD）」與「DSS 分析用」兩份，避免新專案帶著用不到的程式碼
