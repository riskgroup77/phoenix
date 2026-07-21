#!/usr/bin/env python3
"""Server bootstrap: bootstrap_remote.sh yuklab ishga tushiradi."""
from __future__ import annotations

import os
import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from phonix_ssh import connect_phonix, _load_deploy_credentials_files

BOOTSTRAP_LOCAL = _SCRIPT_DIR / "bootstrap_remote.sh"
REMOTE_BOOTSTRAP = "/tmp/phoenix_bootstrap.sh"


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    _load_deploy_credentials_files()
    password = (os.environ.get("PHONIX_SSH_PASSWORD") or "").strip()
    if not password:
        pw_file = (os.environ.get("PHONIX_SSH_PASSWORD_FILE") or "").strip()
        if pw_file:
            password = Path(pw_file).read_text(encoding="utf-8").splitlines()[0].strip()
    if not password:
        print("[xato] PHONIX_SSH_PASSWORD kerak", file=sys.stderr)
        return 2

    backend_port = (os.environ.get("PHONIX_BACKEND_LOCAL_PORT") or "8050").strip()
    remote_dir = (os.environ.get("PHONIX_REMOTE_DIR") or "/phonix").strip()

    client = connect_phonix()
    try:
        sftp = client.open_sftp()
        try:
            content = BOOTSTRAP_LOCAL.read_text(encoding="utf-8").replace("\r\n", "\n")
            with sftp.open(REMOTE_BOOTSTRAP, "w") as remote:
                remote.write(content)
            sftp.chmod(REMOTE_BOOTSTRAP, 0o755)
        finally:
            sftp.close()

        cmd = (
            f"export SUDO_PW={password!r}; "
            f"export PHONIX_REMOTE_DIR={remote_dir!r}; "
            f"export PHONIX_BACKEND_PORT={backend_port!r}; "
            f"bash {REMOTE_BOOTSTRAP}"
        )
        print(f"[ssh] Bootstrap boshlandi...\n")
        _, stdout, stderr = client.exec_command(cmd, get_pty=True, timeout=3600)
        for line in iter(stdout.readline, ""):
            if line == "":
                break
            sys.stdout.write(line)
            sys.stdout.flush()
        err = stderr.read().decode("utf-8", "replace")
        if err.strip():
            sys.stderr.write(err)
        code = stdout.channel.recv_exit_status()
        return int(code)
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
