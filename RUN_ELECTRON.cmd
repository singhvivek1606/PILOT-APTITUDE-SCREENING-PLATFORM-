@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js not found. Install Node.js LTS, then try again.
  pause
  exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm not found. Reinstall Node.js LTS, then try again.
  pause
  exit /b 1
)
if not exist "node_modules\electron\package.json" (
  echo First run: installing Electron dependencies...
  call npm install
  if errorlevel 1 goto :failed
)
echo Starting AeroVector desktop application...
call npm start
if errorlevel 1 goto :failed
exit /b 0
:failed
echo.
echo Something went wrong. Check the error shown above.
pause
exit /b 1
