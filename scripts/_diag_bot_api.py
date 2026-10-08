"""Diagnose bot API connectivity on production server."""
import json
import sys
sys.path.insert(0, "scripts")
from phonix_ssh import connect_phonix

REMOTE_SCRIPT = r'''
import subprocess, json, os, time

def curl(method, url, data=None, timeout=20):
    cmd = ["curl", "-sS", "-w", "\n__META__%{http_code}:%{time_total}", "-X", method, url,
           "-H", "Content-Type: application/json", "--max-time", str(timeout)]
    if data:
        cmd += ["-d", json.dumps(data)]
    try:
        out = subprocess.check_output(cmd, stderr=subprocess.STDOUT, text=True)
        if "__META__" in out:
            body, meta = out.rsplit("__META__", 1)
            code, t = meta.split(":", 1)
            return int(code), float(t), body.strip()[:500]
        return 0, 0, out[:500]
    except subprocess.CalledProcessError as e:
        return -1, timeout, (e.output or str(e))[:500]

env = {}
try:
    with open("/phonix/backend/.env") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
except Exception as e:
    print("ENV_READ_ERR", e)

print("=== ENV ===")
for k in ("API_BASE_URL", "FRONTEND_BASE_URL", "TELEGRAM_BOT_TOKEN"):
    v = env.get(k, "(missing)")
    if k == "TELEGRAM_BOT_TOKEN" and v != "(missing)":
        v = v[:12] + "..."
    print(f"{k}={v}")

print("\n=== SERVICES ===")
for svc in ("phoenix-backend", "phoenix-telegram-bot"):
    r = subprocess.run(["systemctl", "is-active", svc], capture_output=True, text=True)
    print(f"{svc}: {r.stdout.strip()}")

login = {"phone": "998901001004", "password": "Demo@author1"}
tests = [
    ("loopback", "POST", "http://127.0.0.1:8050/api/v1/auth/login/", login),
    ("api_sub", "POST", "https://api.ilmiyfaoliyat.uz/api/v1/auth/login/", login),
    ("main_api", "POST", "https://ilmiyfaoliyat.uz/api/v1/auth/login/", login),
    ("loopback_root", "GET", "http://127.0.0.1:8050/api/v1/", None),
    ("api_sub_root", "GET", "https://api.ilmiyfaoliyat.uz/api/v1/", None),
]

print("\n=== API TESTS ===")
for name, method, url, data in tests:
    code, t, body = curl(method, url, data)
    print(f"{name}: http={code} time={t:.2f}s body={body[:200]}")

print("\n=== BOT LOG (last 15) ===")
r = subprocess.run(["journalctl", "-u", "phoenix-telegram-bot", "-n", "15", "--no-pager"],
                   capture_output=True, text=True)
print(r.stdout[-2500:])
'''

c = connect_phonix()
stdin, stdout, stderr = c.exec_command(f"python3 -c {json.dumps(REMOTE_SCRIPT)}")
print(stdout.read().decode("utf-8", errors="replace"))
err = stderr.read().decode("utf-8", errors="replace")
if err:
    print("STDERR:", err[:1000])
c.close()
