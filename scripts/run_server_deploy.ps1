# Phoenix: serverda to'liq deploy (SSH orqali).
# 1) pip install -r scripts/requirements-deploy.txt
# 2) Parol yoki kalit o'rnating, keyin:
#    .\scripts\run_server_deploy.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

if (-not $env:PHONIX_SSH_PASSWORD -and -not $env:PHONIX_SSH_KEY -and $env:PHONIX_SSH_USE_AGENT -ne "1") {
    Write-Host "O'rnating: `$env:PHONIX_SSH_PASSWORD yoki `$env:PHONIX_SSH_KEY yoki `$env:PHONIX_SSH_USE_AGENT='1'" -ForegroundColor Yellow
    exit 2
}

python -m pip install -q -r scripts/requirements-deploy.txt
python scripts/remote_deploy.py
exit $LASTEXITCODE
