@echo off
setlocal
cd /d "%~dp0"
python scripts\full_deploy.py %*
exit /b %ERRORLEVEL%
