@echo off
echo Dang khoi dong MoMo Social Workspace...
start /b node "%~dp0server.js"
timeout /t 2 /nobreak > nul
start "" "http://localhost:3131"
echo.
echo App dang chay tai http://localhost:3131
echo Dong cua so nay de tat app.
pause
