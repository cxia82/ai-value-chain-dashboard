@echo off
setlocal
cd /d %~dp0

if not exist node_modules (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)

if not exist .env (
  if exist .env.example (
    copy /Y .env.example .env >nul
    echo Created .env from .env.example
  )
)

echo Starting AI Value Chain Dashboard...
call npm start
