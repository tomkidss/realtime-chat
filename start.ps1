# Messaging App Auto-run Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   MESSAGING APP STARTER (CMTQ)   " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check if Node.js is installed
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Node.js is not installed. Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    Read-Host "Press Enter to exit..."
    exit
}

# Install dependencies if node_modules is missing
if (!(Test-Path "node_modules")) {
    Write-Host "[1/2] Installing dependencies (this may take a minute)..." -ForegroundColor Yellow
    npm install
} else {
    Write-Host "[1/2] Dependencies already installed." -ForegroundColor Green
}

# Start the application
Write-Host "[2/2] Starting the application server..." -ForegroundColor Yellow
Write-Host "The app will be available at: http://localhost:3000" -ForegroundColor Green
Write-Host "Super Admin link: http://localhost:3000/?super=true" -ForegroundColor Cyan

# Automatically open the Super Admin login page
Write-Host "Opening Super Admin login page in your browser..." -ForegroundColor Gray
Start-Process "http://localhost:3000/?super=true"

npm run dev
