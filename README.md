# CatChup Lunch

CatChup Lunch 是一套公司內部午餐訂餐系統，整合每日餐廳菜單、訂單截止時間、員工錢包與後台管理，讓訂餐與結算流程集中在同一個平台完成。

系統供 TSA Corp 內部員工與管理者使用；實際使用人數及目前部署狀態尚未從本機程式碼確認。系統提供員工訂餐入口、管理後台與 API，包含 Google OAuth 登入、餐廳菜單與排程、訂單、公告、員工錢包及帳務紀錄。餐廳菜單圖片會以資料內容存入 PostgreSQL 的 `SiteSetting`，OCR 可選擇使用 Gemini API。

## 技術與需求

- Node.js 20 或更新版本、npm
- Next.js 14（App Router）、React 18、Tailwind CSS 3
- Prisma ORM、PostgreSQL
- Google OAuth；菜單 OCR 可選用 Gemini API

## 本機啟動

1. 安裝 Node.js 20+ 與 PostgreSQL，並準備一個可供本機開發使用的資料庫。
2. 安裝依賴：

   ```bash
   npm install
   ```

3. 複製環境變數範本並填入本機設定：

   ```powershell
   Copy-Item .env.example .env
   ```

   設定至少包括 `DATABASE_URL` 與自行產生的 `JWT_SECRET`。Google OAuth 與 OCR 欄位依需要設定。`.env` 不可提交至版本庫。

4. 若是本機新資料庫，可依 Prisma schema 初始化資料表：

   ```bash
   npm run db:push
   ```

   此命令會寫入指定資料庫結構；確認 `DATABASE_URL` 指向本機開發資料庫後再執行。

5. 啟動開發伺服器：

   ```bash
   npm run dev
   ```

   開啟 <http://localhost:3000>。Windows 也可在設定好 `.env` 後執行 `./run.ps1`；該腳本會安裝依賴、同步資料庫結構並啟動開發伺服器。

## 環境變數

| 變數 | 用途 |
| --- | --- |
| `DATABASE_URL` | Prisma 使用的 PostgreSQL 連線字串，必要 |
| `POSTGRES_PRISMA_URL` | 可選的 Prisma 連線字串；若有設定會優先使用 |
| `JWT_SECRET` | 簽署登入 session JWT 的密鑰，必要；沒有值時應用程式會停止載入驗證模組 |
| `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET` | Google OAuth 登入 |
| `NEXT_PUBLIC_APP_URL` | OAuth callback 使用的應用程式公開網址；本機可用 `http://localhost:3000` |
| `GEMINI_API_KEY` 或 `GOOGLE_API_KEY` | 可選的 Gemini 菜單 OCR 金鑰 |

Google OAuth callback 路徑為 `/api/auth/google/callback`。OAuth 用戶端必須登記與 `NEXT_PUBLIC_APP_URL` 相符的完整 callback 網址。

## 版本庫與部署

Vercel 專案建置設定目前指向 `hnd1` 區域；這只能證明程式包含 Vercel 設定，不能證明目前有正式部署。現行主機、網址、平台帳號與部署狀態請參閱 [MIGRATION.md](MIGRATION.md) 的盤點結果。

專案未設定 CI/CD 工作流程。資料庫連線、OAuth 憑證及 API 金鑰只應放在部署平台的環境變數或本機未追蹤的 `.env` 中。
