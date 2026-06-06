@echo off
setlocal EnableExtensions

set "PROJECT_DIR=C:\Users\Chenan Xia\AI value chain dashboard"
set "PORT=3000"
set "DASHBOARD_URL=http://localhost:3000"

if not exist "%PROJECT_DIR%\package.json" exit /b 1

powershell -NoProfile -ExecutionPolicy Bypass -Command "$pids = @(Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique); foreach ($p in $pids) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }"

powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'node' -ArgumentList 'src/server.js' -WorkingDirectory '%PROJECT_DIR%' -WindowStyle Hidden"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$deadline = (Get-Date).AddSeconds(8); while ((Get-Date) -lt $deadline) { if (Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue) { Start-Process '%DASHBOARD_URL%'; exit 0 }; Start-Sleep -Milliseconds 200 }; Start-Process '%DASHBOARD_URL%'"

exit /b 0
