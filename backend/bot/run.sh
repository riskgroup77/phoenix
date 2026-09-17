#!/bin/bash
# Muallif Telegram bot — backend/ papkasidan ishga tushiring
cd "$(dirname "$0")/.." || exit 1

if [ -d "venv" ]; then
  # shellcheck source=/dev/null
  source venv/bin/activate
fi

export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-config.settings_local}"
python bot/bot.py
