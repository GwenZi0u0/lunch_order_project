# CatChup Lunch｜搬遷盤點卡

盤點方式：檢視目前資料夾中的程式、設定、Git 追蹤清單及本機檔案；未登入外部平台、未連線資料庫，也未查詢正式環境。大小以本機可見檔案為準；雲端資料庫實際大小與筆數無法由程式碼推知。

| 項目 | 內容 |
| --- | --- |
| 維護人 | Gwen（依提供資料） |
| 用途／使用者 | 公司內部午餐訂餐、菜單、排程、錢包及結算系統。登入頁面描述為公司 Google 帳號使用；實際使用人數公司員工人數。無客戶或廠商可從外部存取。 |
| 型態 | 網站後端（含 API）：Next.js App Router 網站、API routes 與管理介面。 |
| 語言與框架 | JavaScript、Node.js 20+、Next.js 14、React 18、Tailwind CSS 3、Prisma、PostgreSQL。 |
| 目前跑在哪 | Vercel。|
| 怎麼啟動 | 本機：`npm install`、設定 `.env`、`npm run dev`；Windows 可執行 `./run.ps1`，會安裝依賴、執行 `prisma db push` 並啟動開發伺服器。正式環境的啟動方式與是否常駐不確定。沒有發現排程腳本。 |
| 網址／網域 |  https://catchuplunch.vercel.app。程式使用 `NEXT_PUBLIC_APP_URL`，本機預設可用 `http://localhost:3000`；網域註冊商、登記帳號及到期日不確定。 |
| 有沒有對外 callback | 有 Google OAuth callback：`/api/auth/google/callback`。實際登記的 callback 網址不確定。未發現其他 webhook callback。 |
| 開在誰的帳號 | 公司主機平台、PostgreSQL、公司Google OAuth ；未登入相關平台查詢。 |
| 資料存哪 | 程式預期將訂單、使用者、錢包、餐廳、菜單及設定存放於 PostgreSQL。連線位置由 `DATABASE_URL` 或 `POSTGRES_PRISMA_URL` 環境變數提供；本機沒有 `.env`，故實際資料庫位置與資料量不確定。菜單圖片以 base64 內容放在 PostgreSQL `SiteSetting` 記錄。 |
| 用到的外部服務與帳號 | Google OAuth：登入及使用者基本資料，client credentials 由 `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET` 提供，金鑰位置GoogleCloud，帳號屬公司。Vercel：有部署設定，實際專案及帳號為個人。 |
| 登入／權限 | 有 Google OAuth 登入；JWT session 以 HTTP-only cookie 傳送。程式定義 `user`、`admin`、`viewer` 角色；登入帳號允許範圍及使用者清單不確定。 |
| 停掉的影響 | 若目前仍由此系統提供服務，員工將無法查看菜單與排程、下單或查詢錢包／訂單，管理者無法管理菜單、訂單及結算。實際影響範圍與誰會發現不確定。 |
| 已知問題／待辦 | 正式網址、部署平台／帳號、資料庫擁有人與備份方式、使用人數及外部可見範圍尚待 IT 或系統管理者確認。正式環境設定與資料庫未查詢。 |

## 資料清單

| 名稱 | 種類 | 位置 | 開在誰的帳號 | 大小 | 表／集合與大約筆數 | 會一直被寫入嗎 | 現在怎麼備份 | 有沒有個資 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CatChup Lunch 業務資料 | PostgreSQL；程式 schema 定義 | 實際主機不確定；連線設定預期放在未追蹤的 `DATABASE_URL` 或 `POSTGRES_PRISMA_URL`。本機未找到 `.env` 或資料庫檔 | 不確定 | 不確定；本機沒有資料庫檔可量測 | `User`、`Restaurant`、`MenuItem`、`WeeklySchedule`、`Order`、`OrderSequence`、`OrderItem`、`BalanceTransaction`、`SiteSetting`；各表筆數不確定（未連線查詢）。菜單圖片內容存於 `SiteSetting` | 是；下單、管理餐廳／排程、錢包交易及設定時會寫入；實際頻率不確定 | 不確定；本機程式碼與設定沒有記載備份方式 | 有。schema 包含使用者 email、姓名、頭像、訂單、備註／座位區、錢包及交易紀錄；未讀取資料內容 |

### 本機檔案盤點

- 本機未發現 SQLite、SQL dump、資料庫備份、CSV／Excel 匯出檔或上傳資料目錄。
- 菜單圖片由 API 寫入資料庫欄位；本機程式目錄不保存使用者上傳的圖片檔。
- 資料庫連線環境變數未在本機 `.env` 檔中找到；正式資料庫位置、大小、筆數與備份狀況均不確定。
