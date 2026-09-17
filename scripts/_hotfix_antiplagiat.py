#!/usr/bin/env python3
"""Antiplagiat modullari va bot plag oqimini serverga yuklash."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from phonix_ssh import connect_phonix

ROOT = Path(__file__).resolve().parent.parent
FILES = [
    'backend/apps/articles/antiplagiat_modules.py',
    'backend/apps/articles/antiplagiat_corpus.py',
    'backend/apps/articles/antiplagiat_engine.py',
    'backend/apps/articles/antiplagiat_api_client.py',
    'backend/apps/articles/antiplagiat_api_mapper.py',
    'backend/apps/articles/antiplagiat_external.py',
    'backend/apps/articles/plagiarism_check_service.py',
    'backend/apps/articles/views.py',
    'backend/config/settings.py',
    'backend/requirements.txt',
    'backend/bot/bot.py',
    'backend/bot/constants.py',
    'backend/bot/app_links.py',
    'backend/bot/api_client.py',
    'backend/bot/handlers/services.py',
]

c = connect_phonix()
sftp = c.open_sftp()
for local_rel in FILES:
    remote = '/phonix/' + local_rel.replace('\\', '/')
    print(f'Upload {local_rel}')
    sftp.put(str(ROOT / local_rel), remote)
sftp.close()

_, o, e = c.exec_command(
    'cd /phonix/backend && source venv/bin/activate && pip install -q "zeep>=4.3.0,<5.0.0" && '
    'echo "qazxsw123@!" | sudo -S systemctl restart phoenix-backend phoenix-telegram-bot && '
    'sleep 3 && systemctl is-active phoenix-backend phoenix-telegram-bot'
)
print(o.read().decode('utf-8', errors='replace'))
err = e.read().decode('utf-8', errors='replace')
if err:
    print('STDERR:', err[:2000])
c.close()
