import paramiko, sys, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from phonix_ssh import connect_phonix

client = connect_phonix()
cmd = '''cd /phonix/backend && source venv/bin/activate && export DJANGO_SETTINGS_MODULE=config.settings && python manage.py shell -c "
from apps.users.models import User
for u in User.objects.filter(phone__startswith='998901').order_by('phone'):
    print(u.phone, u.role, u.is_active, u.get_full_name())
print('--- operator ---')
for u in User.objects.filter(role='operator'):
    print(u.phone, u.email, u.is_active)
print('--- author 004 role ---')
u = User.objects.filter(phone__endswith='9001004').first()
print(u.phone if u else 'missing', u.role if u else '')
"
'''
_, o, e = client.exec_command(cmd, timeout=60)
sys.stdout.buffer.write(o.read())
err = e.read().decode()
if err.strip():
    sys.stdout.buffer.write(('STDERR: '+err).encode())
client.close()
