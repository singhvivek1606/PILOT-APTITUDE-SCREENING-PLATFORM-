@echo off
setlocal
cd /d "%~dp0"
where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js/npm is not installed or is not on PATH.
  pause
  exit /b 1
)
if not exist "node_modules\electron\package.json" (
  echo Installing project dependencies...
  call npm install
  if errorlevel 1 goto :failed
)
echo Building AeroVector Windows installer...
call npm run dist:win
if errorlevel 1 goto :failed
echo.
echo Installer created in the dist folder.
pause
exit /b 0
:failed
echo.
echo Windows build failed. Please read the error shown above.
pause
exit /b 1
