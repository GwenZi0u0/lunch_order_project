# CatChup Lunch

CatChup Lunch 是一套公司內部午餐訂餐系統，整合每日餐廳菜單、訂單截止時間、員工錢包與後台管理，讓訂餐與結算流程集中在同一個平台完成。

## 功能特色

### 使用者端

- 查看本週與下週的供餐排程及菜單
- 在截止時間前建立、修改或取消訂單
- 顯示每日訂單編號、餐點明細與歷史訂單
- 查看錢包餘額及交易紀錄
- 顯示待扣款金額與可用餘額，設定預設座位區及訂單備註
- 接收系統公告與通知
- 支援 Google OAuth 登入

### 管理端

- 管理餐廳、菜單品項與供應狀態
- 設定每日供餐餐廳、訂餐截止時間與開放狀態
- 同日安排多間餐廳，分別設定截止日期與時間
- 匯入菜單 JSON、上傳菜單圖片，並透過 OCR 輔助建立品項
- 管理員工錢包儲值與扣款紀錄
- 查看訂餐統計與全站帳務軌跡
- 管理使用者角色，授予指定後台頁面的檢視權限
- 發布、編輯、置頂及刪除公告
- 標記訂單送達並進行結算

## 技術棧

- [Next.js 14](https://nextjs.org/)（App Router）
- [React 18](https://react.dev/)
- Tailwind CSS 3
- [Prisma ORM](https://www.prisma.io/)
- [PostgreSQL](https://www.postgresql.org/)
- JWT Cookie 驗證與 Google OAuth
- Vercel 部署設定

## 快速開始

### 1. 環境需求

- Node.js 20 或更新版本
- npm
- PostgreSQL 資料庫

### 2. 安裝專案

```bash
git clone <repository-url>
cd lunch_projecct
npm install
```

### 3. 設定環境變數

複製範例檔案：

```bash
cp .env.example .env
```

Windows PowerShell 可使用：

```powershell
Copy-Item .env.example .env
```

填入以下設定。使用 `.env` 可讓 Next.js 與 Prisma CLI 共用設定；若原本使用 `.env.local`，請確認 `DATABASE_URL` 也存在於 `.env` 或執行 Prisma 指令的環境變數中，並避免兩份檔案的值不一致。

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
JWT_SECRET="請替換為足夠長且安全的隨機字串"
GEMINI_API_KEY=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

| 變數 | 必要 | 說明 |
| --- | --- | --- |
| `DATABASE_URL` | 是 | PostgreSQL 連線字串 |
| `JWT_SECRET` | 是 | JWT 簽章密鑰，正式環境請勿使用預設值 |
| `NEXT_PUBLIC_APP_URL` | 是 | 應用程式公開網址；本機預設為 `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` | 否 | 啟用 Google OAuth 時使用 |
| `GOOGLE_CLIENT_SECRET` | 否 | 啟用 Google OAuth 時使用 |
| `GEMINI_API_KEY` | 否 | 啟用真實菜單 OCR；未設定時使用模擬資料 |

OCR 也接受 `GOOGLE_API_KEY` 作為備用金鑰。未設定金鑰或外部辨識失敗時，API 會回傳模擬菜單；匯入前請核對品項與價格。

若啟用 Google 登入，請將 OAuth 用戶端的授權重新導向 URI 設為：

```text
http://localhost:3000/api/auth/google/callback
```

部署時請將上述來源網址替換為 `NEXT_PUBLIC_APP_URL` 對應的網域。

### 4. 初始化資料庫

```bash
npm run db:push
```

此指令會直接同步資料庫結構；目前專案未提供 migration 或 seed 指令。首次啟動後，請由管理端建立餐廳、菜單與供餐排程。

### 5. 啟動開發環境

```bash
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000)。登入頁提供開發者登入入口，方便在本機測試管理員與一般使用者流程。

Windows 使用者也可以執行：

```powershell
.\run.ps1
```

此腳本會準備專案內使用的 Node.js、安裝套件、同步 Prisma schema，並啟動開發伺服器。

請先在專案目錄完成 `.env` 設定，再執行腳本。腳本使用 Windows x64 可攜式 Node.js 20.11.1，首次執行需要網路連線，且仍需可連線的 PostgreSQL 資料庫。

## 首次操作與角色

1. 從 `/login` 的開發者入口以管理員登入。
2. 在 `/admin/restaurants` 建立餐廳與菜單，核對匯入內容後儲存。
3. 在 `/admin/schedule` 設定供餐日期、餐廳、截止時間及開放狀態。
4. 使用一般使用者登入，從 `/portal` 查看排程並完成訂餐。
5. 管理員在後台確認訂單，標記送達後進行扣款，並於帳務軌跡核對紀錄。

| 角色 | 權限 |
| --- | --- |
| `user` | 使用者入口、訂餐、個人歷史紀錄及錢包資訊 |
| `admin` | 完整後台管理與使用者權限設定 |
| `viewer` | 檢視指定後台頁面，由管理員在 `/admin/users` 設定 |

可指定的檢視頁面包含訂單公告、供餐排程、訂餐統計、餐廳管理、儲值管理及帳務軌跡。

錢包可用餘額為「帳面餘額 − 尚未扣款的有效訂單金額」。訂餐時會檢查預計可用餘額，下限為 `-200`；標記送達時才實際扣款並建立交易紀錄。

## 常用指令

| 指令 | 用途 |
| --- | --- |
| `npm run dev` | 啟動開發伺服器 |
| `npm run build` | 產生 Prisma Client 並建立正式版 |
| `npm start` | 啟動正式版伺服器 |
| `npm run db:push` | 將 Prisma schema 同步至資料庫 |
| `npm run lint` | 執行程式碼檢查 |

## 專案結構

```text
├─ prisma/
│  └─ schema.prisma          # 資料庫模型
├─ public/                   # 靜態資源
├─ src/
│  ├─ app/
│  │  ├─ admin/              # 管理後台頁面
│  │  │  ├─ users/           # 使用者角色與檢視權限
│  │  │  ├─ order-stats/     # 訂餐統計
│  │  │  └─ accounting-audit/ # 帳務軌跡
│  │  ├─ portal/             # 使用者入口與訂單頁面
│  │  └─ api/                # API Routes
│  ├─ components/            # 共用 UI 元件
│  └─ lib/                   # 驗證、資料庫及錢包邏輯
├─ .env.example              # 環境變數範例
├─ run.ps1                   # Windows 本機啟動腳本
└─ vercel.json               # Vercel 建置設定
```

## 部署

專案已包含 Vercel 建置設定。部署前請在平台設定所有必要環境變數，並確認 `DATABASE_URL` 指向可由部署環境存取的 PostgreSQL 資料庫。

Google OAuth 的重新導向網址也必須與部署網域一致；若使用 Gemini OCR，請另外設定 `GEMINI_API_KEY`。

## Commit 規範

本專案採用 [Conventional Commits](https://www.conventionalcommits.org/)：

```text
feat: 新增功能
fix: 修正錯誤
style: 調整樣式或格式
refactor: 重構程式碼
docs: 更新文件
test: 新增或修改測試
chore: 維護或設定調整
```

也可以加入影響範圍，例如：

```text
feat(order): 新增訂單編號複製功能
fix(wallet): 修正可用餘額計算
docs: 新增專案 README
```

## 授權

本專案目前未提供開源授權。若要公開使用、修改或散布，請先向專案擁有者確認授權方式。
This project does not currently provide an open-source license. Please consult the project owner regarding licensing terms before publicly using, modifying, or distributing it.
