# 🚀 PHONIX COMPLETE SERVER DEPLOYMENT SCRIPT (Windows PowerShell)
# Barcha steps otomatik yuboriladi

param(
    [string]$ProjectRoot = ".",
    [switch]$SkipFrontend = $false,
    [switch]$SkipBackend = $false,
    [switch]$SkipServices = $false
)

# Colors and formatting
$ErrorActionPreference = "Stop"
$host.ui.RawUI.BackgroundColor = "Black"
$host.ui.RawUI.ForegroundColor = "White"
Clear-Host

Write-Host "================================" -ForegroundColor Cyan
Write-Host "🚀 PHONIX SERVER DEPLOYMENT (Windows)" -ForegroundColor Magenta
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$FRONTEND_DIR = Join-Path $ProjectRoot "frontend"
$BACKEND_DIR = Join-Path $ProjectRoot "backend"
$VENV_DIR = Join-Path $BACKEND_DIR "venv"

# Helper functions
function Write-Section { 
    param([string]$Text, [int]$Step, [int]$Total)
    Write-Host "[$Step/$Total] $Text" -ForegroundColor Yellow
}

function Write-Success { 
    param([string]$Text)
    Write-Host "✓ $Text" -ForegroundColor Green
}

function Write-Error-Custom { 
    param([string]$Text)
    Write-Host "✗ $Text" -ForegroundColor Red
}

function Write-Info { 
    param([string]$Text)
    Write-Host "  - $Text" -ForegroundColor White
}

# Check directories
Write-Section "Checking directories" 1 8
if (-not (Test-Path $FRONTEND_DIR) -or -not (Test-Path $BACKEND_DIR)) {
    Write-Error-Custom "Frontend or Backend directory not found!"
    exit 1
}
Write-Success "Directories OK"
Write-Host ""

# ===== FRONTEND DEPLOYMENT =====
if (-not $SkipFrontend) {
    Write-Section "Deploying Frontend" 2 8
    
    Push-Location $FRONTEND_DIR
    
    Write-Info "Pulling latest code..."
    git pull origin master
    
    Write-Info "Installing dependencies..."
    npm install --legacy-peer-deps
    
    Write-Info "Building application..."
    npm run build
    
    Write-Success "Frontend deployment completed"
    Pop-Location
} else {
    Write-Host "[2/8] Frontend deployment SKIPPED" -ForegroundColor Cyan
}
Write-Host ""

# ===== BACKEND DEPLOYMENT =====
if (-not $SkipBackend) {
    Write-Section "Deploying Backend" 3 8
    
    Push-Location $BACKEND_DIR
    
    Write-Info "Pulling latest code..."
    git pull origin master
    
    Write-Success "Backend deployment started"
    Pop-Location
    
    # Python environment
    Write-Section "Setting up Python environment" 4 8
    
    if (-not (Test-Path $VENV_DIR)) {
        Write-Info "Creating virtual environment..."
        Push-Location $BACKEND_DIR
        python -m venv venv
        Pop-Location
    }
    
    Write-Info "Installing dependencies..."
    & "$VENV_DIR\Scripts\pip.exe" install --upgrade pip
    & "$VENV_DIR\Scripts\pip.exe" install -r "$BACKEND_DIR\requirements.txt"
    
    Write-Success "Backend setup completed"
} else {
    Write-Host "[3/8] Backend deployment SKIPPED" -ForegroundColor Cyan
    Write-Host "[4/8] Python environment setup SKIPPED" -ForegroundColor Cyan
}
Write-Host ""

# ===== MIGRATIONS =====
Write-Section "Running migrations" 5 8
Push-Location $BACKEND_DIR

Write-Info "Activating virtual environment..."
& "$VENV_DIR\Scripts\Activate.ps1"

Write-Info "Running migrate command..."
python manage.py migrate --noinput

Write-Success "Migrations completed"
Pop-Location
Write-Host ""

# ===== STATIC FILES =====
Write-Section "Collecting static files" 6 8
Push-Location $BACKEND_DIR

& "$VENV_DIR\Scripts\Activate.ps1"
python manage.py collectstatic --noinput

Write-Success "Static files collected"
Pop-Location
Write-Host ""

# ===== CREATE TEST USERS =====
Write-Section "Creating test users" 7 8
Push-Location $BACKEND_DIR

& "$VENV_DIR\Scripts\Activate.ps1"

if (Test-Path "create_admin_editor_users.py") {
    Write-Info "Running user creation script..."
    python create_admin_editor_users.py
    Write-Success "Test users created"
} else {
    Write-Host "⚠ User creation script not found, skipping..." -ForegroundColor Yellow
}

Pop-Location
Write-Host ""

# ===== RESTART SERVICES =====
if (-not $SkipServices) {
    Write-Section "Restarting services" 8 8
    
    # Try IIS Reset
    if (Get-Command iisreset -ErrorAction SilentlyContinue) {
        Write-Info "Resetting IIS..."
        iisreset /restart
        Write-Success "IIS reset completed"
    }
    
    # Try to restart Gunicorn service (if running as Windows Service)
    try {
        $service = Get-Service -Name "Gunicorn" -ErrorAction SilentlyContinue
        if ($service) {
            Write-Info "Restarting Gunicorn service..."
            Restart-Service -Name "Gunicorn" -Force
            Write-Success "Gunicorn restarted"
        }
    } catch {
        Write-Host "  - ⚠ Gunicorn service not found" -ForegroundColor Yellow
    }
} else {
    Write-Host "[8/8] Service restart SKIPPED" -ForegroundColor Cyan
}
Write-Host ""

# ===== HEALTH CHECK =====
Write-Host "Health Check:" -ForegroundColor Yellow
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/api/health/" -ErrorAction SilentlyContinue
    Write-Success "Backend API is running"
} catch {
    Write-Error-Custom "Backend API is NOT responding"
}

Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "✅ DEPLOYMENT COMPLETED" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""

Write-Host "📌 Test users created:" -ForegroundColor Cyan
Write-Host "   Admin: admin@ilmiyfaoliyat.uz / Admin@123456" -ForegroundColor White
Write-Host "   Editor: editor@ilmiyfaoliyat.uz / Editor@123456" -ForegroundColor White
Write-Host ""

Write-Host "🌐 Access:" -ForegroundColor Cyan
Write-Host "   - Frontend: https://ilmiyfaoliyat.uz" -ForegroundColor White
Write-Host "   - API: http://api.ilmiyfaoliyat.uz" -ForegroundColor White
Write-Host ""

# Deactivate venv
deactivate 2>$null
