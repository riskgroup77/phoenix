# Phoenix: bitta buyruq — pull, tozalash, commit (kerak bo'lsa), push, deploy, restart.
# Hech narsa so'ramaydi. Faqat loyha ildizida .phonix_deploy.env bo'lsa server ham yangilanadi.
# Ishlatish:  .\scripts\do_everything.ps1
# Ixtiyoriy:  -SkipRemote   -SkipDocker

param(
    [switch] $SkipRemote,
    [switch] $SkipDocker
)

$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Import-PhonixDotEnv {
    $f = Join-Path $root ".phonix_deploy.env"
    if (-not (Test-Path $f)) { return }
    Get-Content $f -Encoding UTF8 | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#")) { return }
        $eq = $line.IndexOf("=")
        if ($eq -lt 1) { return }
        $k = $line.Substring(0, $eq).Trim()
        $v = $line.Substring($eq + 1).Trim()
        if ($v.StartsWith('"') -and $v.EndsWith('"')) { $v = $v.Substring(1, $v.Length - 2) }
        if ($k) { Set-Item -Path "Env:$k" -Value $v -ErrorAction SilentlyContinue }
    }
}

function Sync-GitRepo {
    param(
        [Parameter(Mandatory)][string] $RepoPath,
        [Parameter(Mandatory)][string] $Label
    )
    if (-not (Test-Path (Join-Path $RepoPath ".git"))) {
        Write-Host "[o'tkazib] $Label : git yo'q" -ForegroundColor Yellow
        return
    }
    Push-Location $RepoPath
    try {
        Write-Host "`n>>> $Label : pull" -ForegroundColor Cyan
        git fetch origin 2>&1 | Out-Null
        $br = (git rev-parse --abbrev-ref HEAD).Trim()
        git pull --rebase --autostash origin $br 2>&1
        if ($LASTEXITCODE -ne 0) { git pull origin $br 2>&1 }

        # Mahalliy shovqin
        git restore db.sqlite3 2>$null
        git restore "node_modules/.package-lock.json" 2>$null

        $porcelain = git status --porcelain
        if ($porcelain) {
            git add -A
            git reset HEAD db.sqlite3 2>$null
            git reset HEAD .env 2>$null
            git reset HEAD "logs/*" 2>$null
            if (-not (git diff --cached --quiet 2>$null)) {
                $msg = "chore(auto): $Label sync $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
                git commit -m $msg 2>&1
            }
        }

        Write-Host ">>> $Label : push" -ForegroundColor Cyan
        git push origin $br 2>&1
    }
    finally {
        Pop-Location
    }
}

Import-PhonixDotEnv

Write-Host "`n======== PHOENIX: to'liq avtomat ==========" -ForegroundColor Green
Write-Host "Root: $root`n"

Sync-GitRepo (Join-Path $root "backend") "BACKEND"
Sync-GitRepo (Join-Path $root "frontend") "FRONTEND"

# Ildiz (meta) — avval commit, keyin pull --rebase (unstaged bo'lmasin)
if (Test-Path (Join-Path $root ".git")) {
    Set-Location $root
    $mb = (git rev-parse --abbrev-ref HEAD).Trim()

    $paths = @(
        "scripts",
        "deploy",
        ".github",
        "deploy_phonix.sh",
        "docker-compose.yml",
        "locustfile.py",
        "scripts/backup_postgres.sh"
    )
    foreach ($p in $paths) {
        $full = Join-Path $root $p
        if (Test-Path $full) { git add $p 2>$null }
    }
    git add .gitignore .phonix_deploy.env.example RUN_FULL_SYNC.bat 2>$null
    if (-not (git diff --cached --quiet 2>$null)) {
        git commit -m "chore(auto): meta $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" 2>&1
    }

    Write-Host "`n>>> META : pull" -ForegroundColor Cyan
    git fetch origin 2>&1 | Out-Null
    git pull --rebase --autostash origin $mb 2>&1
    if ($LASTEXITCODE -ne 0) {
        git stash push -m "phonix-do-everything" -u 2>$null
        git pull --rebase origin $mb 2>&1
        git stash pop 2>$null
    }

    Write-Host ">>> META : push" -ForegroundColor Cyan
    git push origin $mb 2>&1
}

# Masofadan deploy
if (-not $SkipRemote) {
    $hasAuth = $env:PHONIX_SSH_PASSWORD -or $env:PHONIX_SSH_KEY -or ($env:PHONIX_SSH_USE_AGENT -eq "1")
    if ($hasAuth) {
        Write-Host "`n>>> REMOTE : paramiko deploy" -ForegroundColor Cyan
        python -m pip install -q -r (Join-Path $root "scripts\requirements-deploy.txt") 2>&1
        python (Join-Path $root "scripts\remote_deploy.py") 2>&1
    }
    else {
        Write-Host "`n[o'tkazib] REMOTE : .phonix_deploy.env da parol/kalit yo'q" -ForegroundColor DarkYellow
    }
}

# Docker
if (-not $SkipDocker) {
    Write-Host "`n>>> DOCKER : restart" -ForegroundColor Cyan
    Set-Location $root
    docker compose restart 2>&1
    if ($LASTEXITCODE -ne 0) {
        docker compose up -d 2>&1
    }
}

Write-Host "`n======== TUGADI ==========`n" -ForegroundColor Green
