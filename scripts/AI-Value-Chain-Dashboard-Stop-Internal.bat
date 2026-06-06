@echo off
setlocal EnableExtensions

set "PORT=3000"

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
    taskkill /PID %%P /F >nul 2>&1
)

exit /b 0
