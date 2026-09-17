#!/usr/bin/env python3
"""Bot yangilanishlarini serverga yuklash."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from phonix_ssh import connect_phonix

ROOT = Path(__file__).resolve().parent.parent
FILES = [
    'backend/bot/bot.py',
    'backend/bot/constants.py',
    'backend/bot/app_links.py',
    'backend/bot/list_browse.py',
    'backend/bot/journal_browse.py',
    'backend/bot/journal_callbacks.py',
    'backend/bot/journal_categories.py',
    'backend/bot/payment_helpers.py',
    'backend/bot/api_client.py',
    'backend/bot/keyboards.py',
    'backend/bot/handlers/articles.py',
    'backend/bot/handlers/auth.py',
    'backend/bot/handlers/dashboard.py',
    'backend/bot/handlers/list_views.py',
    'backend/bot/handlers/profile.py',
    'backend/bot/handlers/router.py',
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
    'echo "qazxsw123@!" | sudo -S systemctl restart phoenix-telegram-bot && '
    'sleep 2 && systemctl is-active phoenix-telegram-bot'
)
print(o.read().decode('utf-8', errors='replace'))
err = e.read().decode('utf-8', errors='replace')
if err:
    print('STDERR:', err[:1500])
c.close()
