import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const proj    = String.raw`C:\Users\Chenan Xia\AI value chain dashboard\scripts`;
const desktop = String.raw`C:\Users\Chenan Xia\OneDrive - McKinsey & Company\Desktop`;
const iconDir = String.raw`C:\Users\Chenan Xia\AI value chain dashboard\assets\icons`;

const startBat = path.join(proj, 'AI-Value-Chain-Dashboard-Start-Internal.bat');
const v2StartBat = path.join(proj, 'AI-Value-Chain-Dashboard-v2-Start-Internal.bat');
const stopBat  = path.join(proj, 'AI-Value-Chain-Dashboard-Stop-Internal.bat');
const startVbs = path.join(proj, 'AI-Value-Chain-Dashboard.vbs');
const v2StartVbs = path.join(proj, 'AI-Value-Chain-Dashboard-v2.vbs');
const stopVbs  = path.join(proj, 'AI-Value-Chain-Dashboard-Stop.vbs');
const startIco = path.join(iconDir, 'dashboard-start.ico');
const stopIco  = path.join(iconDir, 'dashboard-stop.ico');
const startLnk = path.join(desktop, 'AI Value Chain Dashboard.lnk');
const v2StartLnk = path.join(desktop, 'AI Value Chain Dashboard v2.lnk');
const stopLnk  = path.join(desktop, 'Stop AI Dashboard.lnk');

// ── Write internal start BAT ────────────────────────────────────────────────
fs.writeFileSync(startBat,
`@echo off
setlocal EnableExtensions

set "PROJECT_DIR=C:\\Users\\Chenan Xia\\AI value chain dashboard"
set "PORT=3000"
set "DASHBOARD_URL=http://localhost:3000"

if not exist "%PROJECT_DIR%\\package.json" exit /b 1

powershell -NoProfile -ExecutionPolicy Bypass -Command "$pids = @(Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique); foreach ($p in $pids) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }"

powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'node' -ArgumentList 'src/server.js' -WorkingDirectory '%PROJECT_DIR%' -WindowStyle Hidden"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$deadline = (Get-Date).AddSeconds(8); while ((Get-Date) -lt $deadline) { if (Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue) { Start-Process '%DASHBOARD_URL%'; exit 0 }; Start-Sleep -Milliseconds 200 }; Start-Process '%DASHBOARD_URL%'"

exit /b 0
`);
console.log('Written:', startBat);

// ── Write internal start BAT (v2 route) ────────────────────────────────────
fs.writeFileSync(v2StartBat,
`@echo off
setlocal EnableExtensions

set "PROJECT_DIR=C:\\Users\\Chenan Xia\\AI value chain dashboard"
set "PORT=3000"
set "DASHBOARD_URL=http://localhost:3000/v2"

if not exist "%PROJECT_DIR%\\package.json" exit /b 1

powershell -NoProfile -ExecutionPolicy Bypass -Command "$pids = @(Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique); foreach ($p in $pids) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }"

powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'node' -ArgumentList 'src/server.js' -WorkingDirectory '%PROJECT_DIR%' -WindowStyle Hidden"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$deadline = (Get-Date).AddSeconds(8); while ((Get-Date) -lt $deadline) { if (Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue) { Start-Process '%DASHBOARD_URL%'; exit 0 }; Start-Sleep -Milliseconds 200 }; Start-Process '%DASHBOARD_URL%'"

exit /b 0
`);
console.log('Written:', v2StartBat);

// ── Write internal stop BAT ─────────────────────────────────────────────────
fs.writeFileSync(stopBat,
`@echo off
setlocal EnableExtensions

set "PORT=3000"

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
    taskkill /PID %%P /F >nul 2>&1
)

exit /b 0
`);
console.log('Written:', stopBat);

// ── Write VBS launchers ──────────────────────────────────────────────────────
fs.writeFileSync(startVbs,
`Set WshShell = CreateObject("WScript.Shell")\r\nWshShell.Run Chr(34) & "${startBat}" & Chr(34), 0, False\r\n`);
console.log('Written:', startVbs);

fs.writeFileSync(v2StartVbs,
`Set WshShell = CreateObject("WScript.Shell")\r\nWshShell.Run Chr(34) & "${v2StartBat}" & Chr(34), 0, False\r\n`);
console.log('Written:', v2StartVbs);

fs.writeFileSync(stopVbs,
`Set WshShell = CreateObject("WScript.Shell")\r\nWshShell.Run Chr(34) & "${stopBat}" & Chr(34), 0, False\r\n`);
console.log('Written:', stopVbs);

// ── Update .lnk shortcuts via PowerShell ────────────────────────────────────
const ps = (cmd) => execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${cmd}"`, { stdio: 'inherit' });

ps(`$wsh=New-Object -ComObject WScript.Shell; $s=$wsh.CreateShortcut('${startLnk}'); $s.TargetPath='wscript.exe'; $s.Arguments='\\"${startVbs}\\"'; $s.IconLocation='${startIco},0'; $s.Save()`);
console.log('Shortcut updated:', startLnk);

ps(`$wsh=New-Object -ComObject WScript.Shell; $s=$wsh.CreateShortcut('${v2StartLnk}'); $s.TargetPath='wscript.exe'; $s.Arguments='\\"${v2StartVbs}\\"'; $s.IconLocation='${startIco},0'; $s.Save()`);
console.log('Shortcut updated:', v2StartLnk);

ps(`$wsh=New-Object -ComObject WScript.Shell; $s=$wsh.CreateShortcut('${stopLnk}'); $s.TargetPath='wscript.exe'; $s.Arguments='\\"${stopVbs}\\"'; $s.IconLocation='${stopIco},0'; $s.Save()`);
console.log('Shortcut updated:', stopLnk);

// ── Final verification ───────────────────────────────────────────────────────
console.log('\nscripts/ files:');
fs.readdirSync(proj).filter(f => f.startsWith('AI-Value')).forEach(f => console.log(' ', f));
console.log('\nDesktop files (expect only .lnk):');
fs.readdirSync(desktop).filter(f => f.includes('Dashboard') || f.includes('Stop AI')).forEach(f => console.log(' ', f));
