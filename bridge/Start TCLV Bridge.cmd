@echo off
setlocal
cd /d "%~dp0"
if not exist "start.mjs" (
  echo Extract the WHOLE ZIP first: right-click it and choose Extract all.
  echo Then open the extracted TCLV-Bridge folder and run this launcher again.
  pause
  exit /b 1
)
if exist "node.exe" (
  "node.exe" "start.mjs" --open
) else (
  where node.exe >nul 2>nul
  if errorlevel 1 (
    echo The Windows portable package includes node.exe. It is missing here.
    echo Extract the WHOLE ZIP using Extract all, not just this launcher.
    echo Download the current Windows ZIP from TCLVPlayer if needed.
    echo The source-only package alternatively needs Node.js 22 or newer.
    pause
    exit /b 1
  )
  node.exe "start.mjs" --open
)
pause
