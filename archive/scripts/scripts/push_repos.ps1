# Push backend (phonixB) va frontend (phonixF) — parent papkadan ishga tushiring.
# Foydalanish: .\scripts\push_repos.ps1
# Ixtiyoriy: -Branch main

param(
    [string] $Branch = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Push-Repo {
    param([string] $Name, [string] $Path)
    Write-Host "`n=== $Name ===" -ForegroundColor Cyan
    Set-Location $Path
    $st = git status --porcelain
    if (-not $st) {
        Write-Host "O'zgarish yo'q, push o'tkazildi."
        return
    }
    git status
    $msg = Read-Host "Commit xabari (bo'sh = push qilmasdan chiqish)"
    if ([string]::IsNullOrWhiteSpace($msg)) {
        Write-Host "Bekor qilindi."
        exit 1
    }
    git add -A
    git commit -m $msg
    if ($Branch) {
        git push origin $Branch
    } else {
        $current = (git rev-parse --abbrev-ref HEAD).Trim()
        git push origin $current
    }
}

try {
    Push-Repo "BACKEND" (Join-Path $root "backend")
    Push-Repo "FRONTEND" (Join-Path $root "frontend")
    Write-Host "`nTayyor. Serverda: cd /phonix/backend && git pull origin master && bash deploy_phonix.sh" -ForegroundColor Green
} catch {
    Write-Error $_
    exit 1
}
