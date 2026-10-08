#!/usr/bin/env python3
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from phonix_ssh import connect_phonix

pw = 'qazxsw123@!'
cmd = (
    f"cd /phonix && git fetch origin && git reset --hard origin/main && "
    f"echo {pw!r} | sudo -S systemctl restart phoenix-backend && "
    "sleep 3 && curl -s http://127.0.0.1:8050/health/ready/"
)
client = connect_phonix()
_, stdout, stderr = client.exec_command(cmd, timeout=90)
out = stdout.read().decode('utf-8', errors='replace')
err = stderr.read().decode('utf-8', errors='replace')
print(out)
if err.strip():
    print(err, file=sys.stderr)
client.close()
