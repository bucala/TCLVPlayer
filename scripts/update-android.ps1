# ============================================================
#  TCLVPlayer — Update & Build skript pre Android / GoogleTV
#  Pouzitie: pravym klikom -> "Spustit s PowerShell"
#            alebo v terminali: .\scripts\update-android.ps1
# ============================================================

param(
    [switch]$OpenStudio,    # -OpenStudio  => otvorit Android Studio po syncu
    [switch]$FirstTime,     # -FirstTime   => prve spustenie (cap add android)
    [switch]$BuildDebug,    # -BuildDebug  => zostavit debug APK po syncu
    [switch]$ForceReset     # -ForceReset  => zahodit lokalne zmeny a vynutit origin/main
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

# --- 1. Git fetch + safe pull ---
Write-Step "Stiahnutie najnovsich zmien z GitHubu..."
try {
    git fetch origin | Out-Null
    if ($ForceReset) {
        git reset --hard origin/main | Out-Null
        git clean -fd | Out-Null
        Write-OK "Git vynutene synchronizovany s origin/main"
    } else {
        $dirty = git status --porcelain
        if ($dirty) {
            Write-Fail "Repo obsahuje lokalne zmeny. Najprv ich commitni/odloz, alebo spusti s -ForceReset."
            exit 1
        }
        git pull --ff-only origin main | Out-Null
        Write-OK "Git aktualizovany cez fast-forward pull"
    }
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

# --- 3. Android Studio projekt ---
Write-Step "Generovanie Android Studio projektu..."
try {
    $generatorArgs = @()
    if ($BuildDebug) { $generatorArgs += "--build" }
    if ($OpenStudio) { $generatorArgs += "--open" }
    node scripts/android-studio.mjs @generatorArgs
    Write-OK "Android Studio projekt pripraveny"
} catch {
    Write-Fail "Android Studio generator zlyhal."
    exit 1
}

if ($FirstTime) {
    Write-Host "    [INFO] -FirstTime je zachovany pre kompatibilitu; generator uz vytvara android/ automaticky." -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "  Hotovo! Android projekt je aktualizovany." -ForegroundColor Green
Write-Host ""
Write-Host "  Dalsi kroky:" -ForegroundColor DarkGray
Write-Host "    Build APK v Android Studio: Build > Build Bundle(s)/APK(s) > Build APK" -ForegroundColor DarkGray
Write-Host "    Alebo spusti: npm run android:apk" -ForegroundColor DarkGray
Write-Host "    Alebo spusti: .\scripts\update-android.ps1 -OpenStudio" -ForegroundColor DarkGray
Write-Host ""
