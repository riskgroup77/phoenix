#!/usr/bin/env python3
"""
Serverda to‘liq deploy: deploy_phonix.sh (git, migrate, collectstatic, npm build, systemd).

Muhit: PHONIX_SSH_HOST, PHONIX_SSH_USER, PHONIX_SSH_PASSWORD yoki PHONIX_SSH_PASSWORD_FILE
       yoki PHONIX_SSH_KEY, PHONIX_SSH_USE_AGENT=1, PHONIX_REMOTE_DIR, PHONIX_SYNC_DEPLOY_SCRIPT

Ishlatish: pip install -r scripts/requirements-deploy.txt && python scripts/remote_deploy.py
"""
from __future__ import annotations

import os
import shlex
import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from phonix_ssh import connect_phonix, _load_deploy_credentials_files

ROOT = _SCRIPT_DIR.parent
DEPLOY_SCRIPT_LOCAL = ROOT / "deploy_phonix.sh"

REMOTE_DIR = (os.environ.get("PHONIX_REMOTE_DIR") or "/phonix").rstrip("/")
SYNC_SCRIPT = os.environ.get("PHONIX_SYNC_DEPLOY_SCRIPT", "1").lower() not in ("0", "false", "no")
BACKEND_LOCAL_PORT = (os.environ.get("PHONIX_BACKEND_LOCAL_PORT") or "8050").strip() or "8050"

REMOTE_SCRIPT = f"{REMOTE_DIR}/deploy_phonix.sh"


def _remote_deploy_command() -> str:
    _load_deploy_credentials_files()
    web_root = (os.environ.get("PHONIX_FRONTEND_WEB_ROOT") or "").strip()
    export_web = ""
    if web_root:
        export_web = f"export PHONIX_FRONTEND_WEB_ROOT={shlex.quote(web_root)}; "
    return (
        f"set -e; mkdir -p {REMOTE_DIR}; chmod +x {REMOTE_SCRIPT} 2>/dev/null || true; "
        f"cd {REMOTE_DIR} && {export_web}PHONIX_GIT_RESET=true bash {REMOTE_SCRIPT}"
    )

VERIFY_CORS = (
    f"curl -sI -X OPTIONS 'http://127.0.0.1:{BACKEND_LOCAL_PORT}/api/v1/auth/login/' "
    "-H 'Origin: https://ilmiyfaoliyat.uz' "
    "-H 'Access-Control-Request-Method: POST' "
    "-H 'Access-Control-Request-Headers: content-type,authorization' | head -25"
)


def _upload_deploy_script(sftp, remote_path: str) -> None:
    if not DEPLOY_SCRIPT_LOCAL.is_file():
        print(f"[ogohlantirish] {DEPLOY_SCRIPT_LOCAL} yo‘q — serverdagi skript ishlatiladi", file=sys.stderr)
        return
    with sftp.open(remote_path, "w") as remote:
        with open(DEPLOY_SCRIPT_LOCAL, "r", encoding="utf-8") as local:
            remote.write(local.read())
    sftp.chmod(remote_path, 0o755)
    print(f"[ok] Yuklandi: {remote_path}")


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    remote_cmd = _remote_deploy_command()
    client = connect_phonix()
    try:
        if SYNC_SCRIPT:
            sftp = client.open_sftp()
            try:
                _upload_deploy_script(sftp, REMOTE_SCRIPT)
            finally:
                sftp.close()

        print(f"[ssh] {remote_cmd}\n")
        _, stdout, stderr = client.exec_command(remote_cmd, get_pty=True, timeout=1200)
        for line in iter(stdout.readline, ""):
            if line == "":
                break
            sys.stdout.write(line)
            sys.stdout.flush()
        err = stderr.read().decode("utf-8", "replace")
        if err.strip():
            sys.stderr.write(err)
        code = stdout.channel.recv_exit_status()
        if code != 0:
            return int(code)

        _, out2, _ = client.exec_command(VERIFY_CORS, timeout=30)
        body = out2.read().decode("utf-8", "replace")
        if body.strip():
            print("\n--- CORS preflight (loopback OPTIONS) ---\n", body, sep="")

        _, out3, _ = client.exec_command(
            f"curl -sS --max-time 5 http://127.0.0.1:{BACKEND_LOCAL_PORT}/health/ || true",
            timeout=15,
        )
        h = out3.read().decode("utf-8", "replace").strip()
        if h:
            print("\n--- /health/ ---\n", h[:500], sep="")
        return 0
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
