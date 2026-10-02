@echo off
setlocal
cd /d "%~dp0"
if exist "node.exe" (
  "node.exe" "start.mjs" --open
) else (
  where node.exe >nul 2>nul
  if errorlevel 1 (
    echo TCLV Bridge needs Node.js 22 or newer.
    echo Install the LTS version from https://nodejs.org/ and run this file again.
    pause
    exit /b 1
  )
  node.exe "start.mjs" --open
)
pause
