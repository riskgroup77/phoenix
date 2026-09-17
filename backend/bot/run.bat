@echo off
cd /d "%~dp0.."
if exist venv\Scripts\activate.bat call venv\Scripts\activate.bat
set DJANGO_SETTINGS_MODULE=config.settings_local
python bot\bot.py
