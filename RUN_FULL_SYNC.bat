@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\do_everything.ps1"
exit /b %ERRORLEVEL%
