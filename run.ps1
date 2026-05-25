# Lunch Kaizen 啟動與環境建置腳本 (PowerShell)
# 此腳本會自動在本地下載可攜式 Node.js，無須安裝全域環境即可運行專案。

$ErrorActionPreference = "Stop"
$workDir = $PSScriptRoot
$nodeDir = Join-Path $workDir ".node-dist"
$nodeSubDir = Join-Path $nodeDir "node-v20.11.1-win-x64"
$nodeExe = Join-Path $nodeSubDir "node.exe"

# 1. 檢查並下載可攜式 Node.js
if (-not (Test-Path $nodeExe)) {
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "偵測到本機尚未配置 Node.js 運行環境。" -ForegroundColor Yellow
    Write-Host "正在下載本地可攜式 Node.js v20.11.1 (約 30MB)..." -ForegroundColor Yellow
    Write-Host "==========================================" -ForegroundColor Cyan
    
    if (-not (Test-Path $nodeDir)) {
        New-Item -ItemType Directory -Force -Path $nodeDir | Out-Null
    }
    
    $zipPath = Join-Path $workDir "node.zip"
    $url = "https://nodejs.org/dist/v20.11.1/node-v20.11.1-win-x64.zip"
    
    # 下載
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $url -OutFile $zipPath
    
    Write-Host "下載完成。正在解壓縮環境檔案..." -ForegroundColor Yellow
    Expand-Archive -Path $zipPath -DestinationPath $nodeDir -Force
    
    # 刪除壓縮檔
    if (Test-Path $zipPath) {
        Remove-Item $zipPath -Force
    }
    
    Write-Host "Node.js 本地配置成功！位置: $nodeSubDir" -ForegroundColor Green
}

# 2. 將本地 Node.js 與 npm 加入當前階段的 PATH
$env:PATH = "$nodeSubDir;$env:PATH"

Write-Host "--- 運行環境資訊 ---" -ForegroundColor Cyan
Write-Host "Node 版本: $(node -v)" -ForegroundColor Green
Write-Host "NPM 版本: $(npm -v)" -ForegroundColor Green
Write-Host "工作目錄: $workDir" -ForegroundColor Cyan
Write-Host "--------------------" -ForegroundColor Cyan

# 3. 檢查 node_modules，若不存在則進行安裝
$nodeModules = Join-Path $workDir "node_modules"
if (-not (Test-Path $nodeModules)) {
    Write-Host "正在安裝專案依賴套件 (npm install)..." -ForegroundColor Yellow
    npm install
    Write-Host "套件安裝完成！" -ForegroundColor Green
}

# 4. 檢查與初始化資料庫 (Prisma)
Write-Host "正在同步資料庫結構 (Prisma db push)..." -ForegroundColor Yellow
npx prisma db push

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "系統準備就緒！正在啟動 Next.js 開發伺服器..." -ForegroundColor Green
Write-Host "啟動後請使用瀏覽器開啟 http://localhost:3000" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan

npm run dev
