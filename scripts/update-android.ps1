# ============================================================
#  TCLVPlayer — Update & Build skript pre Android / GoogleTV
#  Pouzitie: pravym klikom -> "Spustit s PowerShell"
#            alebo v terminali: .\scripts\update-android.ps1
# ============================================================

param(
    [switch]$OpenStudio,    # -OpenStudio  => otvorit Android Studio po syncu
    [switch]$FirstTime      # -FirstTime   => prve spustenie (cap add android)
)

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "TCLVPlayer — Android Update"

function Write-Step { param($msg) Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-OK   { param($msg) Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-Fail { param($msg) Write-Host "    [!!] $msg" -ForegroundColor Red }

# --- Presun do root adresara projektu ---
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir   = Split-Path -Parent $scriptDir
Set-Location $rootDir
Write-Host ""
Write-Host "  TCLVPlayer  Android Update" -ForegroundColor Yellow
Write-Host "  Adresar: $rootDir" -ForegroundColor DarkGray
Write-Host ""

# --- Kontrola JAVA_HOME ---
Write-Step "Kontrola prostredia (Java, Android SDK)..."
if (-not $env:JAVA_HOME) {
    Write-Host "    [!!] JAVA_HOME nie je nastavene!" -ForegroundColor Red
    Write-Host "         Nastav ho napr.: `$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'" -ForegroundColor DarkYellow
    Write-Host "         Pokracujem, ale cap sync moze zlyhat..." -ForegroundColor DarkYellow
} else {
    Write-OK "JAVA_HOME = $env:JAVA_HOME"
}

if (-not $env:ANDROID_HOME -and -not $env:ANDROID_SDK_ROOT) {
    Write-Host "    [!!] ANDROID_HOME nie je nastavene!" -ForegroundColor Red
    Write-Host "         Nastav: `$env:ANDROID_HOME = 'C:\Users\<meno>\AppData\Local\Android\Sdk'" -ForegroundColor DarkYellow
} else {
    $sdkPath = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { $env:ANDROID_SDK_ROOT }
    Write-OK "Android SDK = $sdkPath"
}

# --- 1. Git fetch + reset ---
Write-Step "Stiahnutie najnovsich zmien z GitHubu..."
try {
    git fetch origin | Out-Null
    git reset --hard origin/main | Out-Null
    git clean -fd | Out-Null
    Write-OK "Git synchronizovany s origin/main"
} catch {
    Write-Fail "Git zlyhali."
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
    Write-OK "Web bundle pripraveny"
} catch {
    Write-Fail "copy-web.mjs zlyhalo."
    exit 1
}

# --- 4. Apply Android template ---
Write-Step "Aplikovanie Android sablony..."
try {
    node scripts/apply-android-template.mjs
    Write-OK "Android manifest patchnuty"
} catch {
    Write-Fail "apply-android-template.mjs zlyhalo."
    exit 1
}

# --- 5. Prve spustenie: cap add android ---
if ($FirstTime) {
    Write-Step "Prvy setup — pridavanie Android platformy (cap add android)..."
    try {
        npx cap add android
        Write-OK "Android platforma pridana"
    } catch {
        Write-Host "    [i] Android uz existuje, preskakujem..." -ForegroundColor DarkYellow
    }
}

# --- 6. Capacitor sync ---
Write-Step "Capacitor sync (cap sync android)..."
try {
    npx cap sync android
    Write-OK "Capacitor sync dokonceny"
} catch {
    Write-Fail "cap sync android zlyhalo."
    exit 1
}

# --- 7. Volitelne otvorenie Android Studio ---
if ($OpenStudio) {
    Write-Step "Otvaram Android Studio..."
    npx cap open android
}

Write-Host ""
Write-Host "  Hotovo! Android projekt je aktualizovany." -ForegroundColor Green
Write-Host ""
Write-Host "  Dalsi kroky:" -ForegroundColor DarkGray
Write-Host "    Build APK v Android Studio: Build > Build Bundle(s)/APK(s) > Build APK" -ForegroundColor DarkGray
Write-Host "    Alebo spusti: .\scripts\update-android.ps1 -OpenStudio" -ForegroundColor DarkGray
Write-Host ""
