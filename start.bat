@echo off
rem ================================================================
rem  ONI Save Lab - one-click launcher (Windows)
rem  Installs dependencies on first run, starts the Vite dev server,
rem  then opens the app in your default browser.
rem
rem  Usage:  start.bat            default port 5173
rem          start.bat 5174       use another port
rem          set NO_BROWSER=1     do not open a browser
rem ================================================================
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
title ONI Save Lab - dev server

set "PORT=%~1"
if "%PORT%"=="" set "PORT=5173"
set "URL=http://localhost:%PORT%/"
set "OPEN_BROWSER=1"
if "%NO_BROWSER%"=="1" set "OPEN_BROWSER=0"

echo(
echo   ONI Save Lab - oni-save-editor
echo   ------------------------------------------------
echo   project : %CD%
echo   url     : %URL%
echo(
echo   Keep this window open while using the app.
echo   Press Ctrl+C or close this window to stop the server.
echo(

rem ---- 1. Node.js ------------------------------------------------
where node >nul 2>&1
if errorlevel 1 goto :no_node
for /f "delims=" %%v in ('node -p "process.versions.node"') do set "NODE_VER=%%v"
for /f "tokens=1 delims=." %%a in ("!NODE_VER!") do set "NODE_MAJOR=%%a"
if !NODE_MAJOR! LSS 20 goto :old_node
echo [node] Node.js !NODE_VER!

rem ---- 2. Dependencies -------------------------------------------
if exist "node_modules\vite\bin\vite.js" (
  echo [deps] already installed
) else (
  echo [deps] node_modules not found, installing. This may take a few minutes...
  if exist "package-lock.json" (
    call npm ci
  ) else (
    call npm install
  )
  if errorlevel 1 (
    echo [ERROR] Dependency installation failed.
    echo         Check the npm output above, then run "npm install" manually.
    goto :fail
  )
  echo [deps] installed
)
echo(

rem ---- 3. Open the browser once the server is listening ----------
if "%OPEN_BROWSER%"=="0" (
  echo [browser] auto-open disabled: NO_BROWSER=1
  goto :start_vite
)
echo [browser] will open %URL% when the server is ready
start "" /b powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$u = $env:URL; for ($i = 0; $i -lt 120; $i++) {" ^
  "  try { $c = New-Object Net.Sockets.TcpClient('127.0.0.1', [int]$env:PORT); $c.Close(); Start-Sleep -Milliseconds 400; Start-Process $u; exit } catch { Start-Sleep -Seconds 1 }" ^
  "}; Write-Host '[browser] server did not respond in time, open the url manually.'"

:start_vite
rem ---- 4. Start Vite ---------------------------------------------
echo(
echo [vite] starting dev server on port %PORT% ...
echo(
call npx --no-install vite --port %PORT% --strictPort --host 127.0.0.1
if errorlevel 1 goto :vite_fail

echo(
echo [done] dev server stopped.
goto :end

:no_node
echo [ERROR] Node.js was not found in PATH.
echo         Install Node.js 20.19+ or 22.12+ from https://nodejs.org/, then run this file again.
goto :fail

:old_node
echo [ERROR] Node.js !NODE_VER! is too old.
echo         Vite 8 requires Node.js 20.19+ / 22.12+ / 24+. Please upgrade from https://nodejs.org/.
goto :fail

:vite_fail
echo(
echo [ERROR] Vite failed to start.
echo         If the port is busy, run "start.bat 5174" to use another port.
goto :fail

:fail
echo(
if not defined CI pause
exit /b 1

:end
if not defined CI pause
exit /b 0
