import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("87.192.230.208", port=2222, username="admin_root", password="qazxsw123@!", timeout=20)

cmds = [
    "curl -sI http://127.0.0.1:8050/media/journals/ | head -5",
    'F=$(ls /phonix/backend/media/journals/ | head -1); echo FILE=$F; curl -sI "http://127.0.0.1:8050/media/journals/$F" | head -8',
    'F=$(ls /phonix/backend/media/journals/ | head -1); curl -sI "https://api.ilmiyfaoliyat.uz/media/journals/$F" | head -8',
    """cd /phonix/backend && source venv/bin/activate && export DJANGO_SETTINGS_MODULE=config.settings && python <<'PY'
from apps.journals.models import Journal
j = Journal.objects.first()
if j and j.image_url:
    print('field:', j.image_url.name)
    print('url:', j.image_url.url)
else:
    print('no image')
PY""",
]
for cmd in cmds:
    print(">>>", cmd[:80])
    _, o, _ = c.exec_command(cmd, get_pty=True, timeout=30)
    print(o.read().decode(errors="replace"))
c.close()
