#!/usr/bin/env python3
"""Production serverdan barcha foydalanuvchilarni ro'yxatga olish."""
from __future__ import annotations

import json
import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from phonix_ssh import connect_phonix

REMOTE_CMD = r"""cd /phonix/backend && source venv/bin/activate && DJANGO_SETTINGS_MODULE=config.settings python manage.py shell <<'PYEOF'
import json
from django.contrib.auth import get_user_model
User = get_user_model()
rows = User.objects.all().order_by('role', 'phone')
out = []
for u in rows:
    out.append({
        'id': str(u.id),
        'phone': u.phone,
        'email': u.email or '',
        'first_name': u.first_name or '',
        'last_name': u.last_name or '',
        'patronymic': u.patronymic or '',
        'role': u.role,
        'affiliation': u.affiliation or '',
        'orcid_id': u.orcid_id or '',
        'telegram_username': u.telegram_username or '',
        'is_active': u.is_active,
        'is_staff': u.is_staff,
        'is_superuser': u.is_superuser,
        'date_joined': u.date_joined.isoformat() if u.date_joined else '',
        'last_login': u.last_login.isoformat() if u.last_login else '',
        'gamification_level': u.gamification_level,
        'gamification_points': u.gamification_points,
        'reviews_completed': u.reviews_completed,
    })
print('__USERS_JSON__' + json.dumps(out, ensure_ascii=False))
PYEOF
"""


def main():
    client = connect_phonix()
    try:
        _, stdout, stderr = client.exec_command(REMOTE_CMD, timeout=120)
        raw = stdout.read().decode('utf-8', errors='replace')
        err = stderr.read().decode('utf-8', errors='replace')
        marker = '__USERS_JSON__'
        if marker not in raw:
            print(raw, file=sys.stderr)
            if err.strip():
                print(err, file=sys.stderr)
            sys.exit(1)
        data = json.loads(raw.split(marker, 1)[1].strip())
        print(json.dumps(data, ensure_ascii=False, indent=2))
        print(f"\n# Jami: {len(data)} ta foydalanuvchi", file=sys.stderr)
    finally:
        client.close()


if __name__ == '__main__':
    main()
