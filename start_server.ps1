# PowerShell script to start Mini App Server
$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Mini App Server Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

Write-Host "Current directory: $PWD" -ForegroundColor Green
Write-Host ""

Write-Host "Step 1: Starting Mini App Server on port 8000..." -ForegroundColor Yellow

# Try to find Python
$pythonCmd = $null
$commands = @("python", "py", "python3")

foreach ($cmd in $commands) {
    try {
        $null = Get-Command $cmd -ErrorAction Stop
        $pythonCmd = $cmd
        Write-Host "Found: $cmd" -ForegroundColor Green
        break
    } catch {
        continue
    }
}

if (-not $pythonCmd) {
    Write-Host "ERROR: Python not found!" -ForegroundColor Red
    Write-Host "Please install Python or add it to PATH" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Starting server with: $pythonCmd miniapp_server.py" -ForegroundColor Green
Start-Process cmd -ArgumentList "/k `"$pythonCmd miniapp_server.py`"" -WindowStyle Normal

Write-Host ""
Write-Host "Step 2: Please start ngrok manually in another terminal:" -ForegroundColor Yellow
Write-Host "   ngrok http 8000" -ForegroundColor White
Write-Host ""
Write-Host "Step 3: Copy the ngrok URL and update config.py:" -ForegroundColor Yellow
Write-Host '   MINIAPP_URL = "https://YOUR-NGROK-URL.ngrok-free.app/TGMiniapp.html"' -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Server started on http://localhost:8000" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

Read-Host "Press Enter to exit"