# PowerShell Setup Script for Games Hub on Windows
# Usage: .\setup-windows.ps1

Write-Host "🚀 Games Hub - Windows Setup" -ForegroundColor Cyan
Write-Host "=============================="

# Step 1: Check Node.js
Write-Host "`n📦 Step 1/4: Checking Node.js installation..." -ForegroundColor Yellow
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: Node.js is not installed." -ForegroundColor Red
    Write-Host "   Please download and install it from: https://nodejs.org/"
    exit 1
}
$nodeVersion = node -v
Write-Host "✅ Node.js found: $nodeVersion" -ForegroundColor Green

# Step 2: Install dependencies
Write-Host "`n📦 Step 2/4: Installing project dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error: npm install failed." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Dependencies installed successfully" -ForegroundColor Green

# Step 3: Setup Environment
Write-Host "`n📝 Step 3/4: Configuring environment variables..." -ForegroundColor Yellow
if (!(Test-Path ".env")) {
    Write-Host "   Creating new .env file from template..."
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
    } else {
        "PORT=3000`nNODE_ENV=production`n# Add Spotify keys here`nSPOTIFY_CLIENT_ID=`nSPOTIFY_CLIENT_SECRET=" | Out-File -FilePath ".env" -Encoding utf8
    }
    Write-Host "✅ Created .env file. Please edit it with your secrets!" -ForegroundColor Green
} else {
    Write-Host "✅ Existing .env found, preserving content" -ForegroundColor Green
}

# Set read-only attribute for protection
attrib +r .env
Write-Host "🔒 .env file set to Read-Only for protection." -ForegroundColor Cyan

# Step 4: Finalize
Write-Host "`n🚀 Step 4/4: Ready to run!" -ForegroundColor Yellow
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "✅ SETUP COMPLETE!" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "`n🌐 Your local site is ready at: http://localhost:3000"
Write-Host "`n📢 To start the server, run:" -ForegroundColor Yellow
Write-Host "   npm start" -ForegroundColor White
Write-Host "`n🛠️  To run in development mode (auto-refresh):" -ForegroundColor Yellow
Write-Host "   npm run dev" -ForegroundColor White
Write-Host "`n================================================================" -ForegroundColor Cyan
