# Template Management Dashboard Setup Script for Windows

Write-Host "🚀 Setting up Template Management Dashboard..." -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
Write-Host "Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js $nodeVersion found" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found. Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Install root dependencies
Write-Host ""
Write-Host "Installing root dependencies..." -ForegroundColor Yellow
npm install

# Install frontend dependencies
Write-Host ""
Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location frontend
npm install

# Install backend dependencies
Set-Location ../backend
Write-Host ""
Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
npm install

# Create data directory for database
Write-Host ""
Write-Host "Creating database directory..." -ForegroundColor Yellow
if (-not (Test-Path "data")) {
    New-Item -ItemType Directory -Path "data" | Out-Null
    Write-Host "✅ Database directory created" -ForegroundColor Green
} else {
    Write-Host "✅ Database directory already exists" -ForegroundColor Green
}

Set-Location ..

Write-Host ""
Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "To start the application:" -ForegroundColor Cyan
Write-Host "  npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Or start frontend and backend separately:" -ForegroundColor Cyan
Write-Host "  npm run dev:backend" -ForegroundColor White
Write-Host "  npm run dev:frontend" -ForegroundColor White
Write-Host ""
Write-Host "Default login credentials:" -ForegroundColor Cyan
Write-Host "  Admin: admin / admin123" -ForegroundColor White
Write-Host "  Freelancer: freelancer / freelancer123" -ForegroundColor White
Write-Host ""

