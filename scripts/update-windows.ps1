# ============================================================
#  TCLVPlayer — Update & Build skript pre Windows
#  Pouzitie: pravym klikom -> "Spustit s PowerShell"
#            alebo v terminali: .\scripts\update-windows.ps1
# ============================================================

param(
    [switch]$BuildExe,      # -BuildExe  => zbuilduje .exe installer
    [switch]$RunAfter       # -RunAfter  => po update spusti aplikaciu
)

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "TCLVPlayer — Windows Update"

function Write-Step { param($msg) Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-OK   { param($msg) Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-Fail { param($msg) Write-Host "    [!!] $msg" -ForegroundColor Red }

# --- Presun do root adresara projektu ---
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir   = Split-Path -Parent $scriptDir
Set-Location $rootDir
Write-Host ""
Write-Host "  TCLVPlayer  Windows Update" -ForegroundColor Yellow
Write-Host "  Adresar: $rootDir" -ForegroundColor DarkGray
Write-Host ""

# --- 1. Git fetch + reset ---
Write-Step "Stiahnutie najnovsich zmien z GitHubu..."
try {
    git fetch origin | Out-Null
    git reset --hard origin/main | Out-Null
    git clean -fd | Out-Null
    Write-OK "Git synchronizovany s origin/main"
} catch {
    Write-Fail "Git zlyhali. Skontroluj pripojenie alebo ci si v spravnom adresari."
    exit 1
}

# --- 2. npm install ---
Write-Step "Aktualizacia npm zavislosti..."
try {
    npm install --prefer-offline 2>&1 | Out-Null
    Write-OK "npm install dokonceny"
} catch {
    Write-Fail "npm install zlyhalo."
    exit 1
}

# --- 3. Prepare web bundle ---
Write-Step "Build web bundlu (copy-web.mjs)..."
try {
    node scripts/copy-web.mjs
    Write-OK "Web bundle pripraveny v dist/web/"
} catch {
    Write-Fail "copy-web.mjs zlyhalo."
    exit 1
}

# --- 4. Volitelny .exe build ---
if ($BuildExe) {
    Write-Step "Build Windows .exe (NSIS + portable)..."
    try {
        npx electron-builder --win nsis portable
        Write-OK ".exe subory su v priecinku dist/"
    } catch {
        Write-Fail "electron-builder zlyhalo."
        exit 1
    }
}

# --- 5. Volitelne spustenie ---
if ($RunAfter) {
    Write-Step "Spustanie TCLVPlayer..."
    npx electron .
}

Write-Host ""
Write-Host "  Hotovo! TCLVPlayer je aktualizovany." -ForegroundColor Green
if (-not $BuildExe -and -not $RunAfter) {
    Write-Host "  Tip: Spusti s prepinacmi -BuildExe alebo -RunAfter" -ForegroundColor DarkGray
    Write-Host "  Priklad: .\scripts\update-windows.ps1 -BuildExe -RunAfter" -ForegroundColor DarkGray
}
Write-Host ""
