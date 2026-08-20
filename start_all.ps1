# PowerShell script to start Bot + Mini App
$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Complete Setup: Bot + Mini App" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

Write-Host "Current directory: $PWD" -ForegroundColor Green
Write-Host ""

Write-Host "Step 1: Starting Node.js server for Mini App on port 3000..." -ForegroundColor Yellow
Start-Process cmd -ArgumentList "/k node server_fixed.js" -WindowStyle Normal

Write-Host "Step 2: Waiting for server to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

Write-Host "Step 3: Starting localtunnel for Mini App..." -ForegroundColor Yellow
Start-Process cmd -ArgumentList "/k npx localtunnel --port 3000" -WindowStyle Normal

Write-Host "Step 4: Waiting for tunnel to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host "Step 5: Starting Telegram Bot..." -ForegroundColor Yellow
Start-Process cmd -ArgumentList "/k python streetshop.py" -WindowStyle Normal

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "All Services Started!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MiniApp Server: http://localhost:3000" -ForegroundColor White
Write-Host "LocalTunnel: Check LocalTunnel window for URL" -ForegroundColor White
Write-Host "Telegram Bot: Running in separate window" -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "IMPORTANT:" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "1. Check LocalTunnel window and copy the URL" -ForegroundColor White
Write-Host "2. Update config.py with new URL if changed:" -ForegroundColor White
Write-Host "   MINIAPP_URL = `"NEW-URL/TGMiniapp.html`"" -ForegroundColor White
Write-Host "3. Restart the bot to apply changes" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan

Read-Host "Press Enter to exit"