# Bir marta: server root parolini faylga yozib, deploy uchun tayyorlash
# Ishlatish: powershell -ExecutionPolicy Bypass -File scripts\setup_deploy_env.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (-not (Test-Path "$root\deploy_phonix.sh")) { $root = Split-Path $PSScriptRoot -Parent }

$pwFile = Join-Path $env:USERPROFILE '.ssh\phonix_root_password.txt'
$envFile = Join-Path $root '.phonix_deploy.env'

Write-Host "Server: root@167.71.53.238"
$sec = Read-Host 'Root parolini kiriting' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
$plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

$sshDir = Split-Path $pwFile -Parent
if (-not (Test-Path $sshDir)) { New-Item -ItemType Directory -Path $sshDir -Force | Out-Null }
Set-Content -Path $pwFile -Value $plain -NoNewline -Encoding utf8

@"
PHONIX_SSH_HOST=167.71.53.238
PHONIX_SSH_USER=root
PHONIX_SSH_PASSWORD_FILE=$pwFile
PHONIX_FRONTEND_WEB_ROOT=/var/www/ilmiyfaoliyat
"@ | Set-Content -Path $envFile -Encoding utf8

Write-Host "[ok] $envFile yaratildi"
Write-Host "Keyingi: python scripts/full_deploy.py --remote-only"
