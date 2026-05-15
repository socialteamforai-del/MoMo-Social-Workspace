@echo off
echo ========================================
echo   MoMo Social Workspace
echo ========================================
cd /d "%~dp0"

echo [1/2] Kiem tra port 3001...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001 "') do (
  taskkill /F /PID %%a >nul 2>&1
)

echo [2/2] Khoi dong server...
start "MoMo Server" cmd /k "cd /d %~dp0 && node server.js"

timeout /t 3 >nul
start http://localhost:3001
echo.
echo Server dang chay tai http://localhost:3001
echo Dung tat cua so CMD den de server tiep tuc chay.
