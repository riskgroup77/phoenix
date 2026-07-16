"""SSH ulanish (paramiko) — deploy va restart skriptlari uchun."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko


def _load_dotenv_file(path: Path) -> None:
    """Fayldagi KEY=VAL ni o‘qiydi; mavjud os.environ ustiga yozmaydi."""
    if not path.is_file():
        return
    try:
        raw = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return
    for line in raw.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val


def _load_deploy_credentials_files() -> None:
    """Lokal maxfiy fayl: repoda `.phonix_deploy.env` (gitignore)."""
    root = Path(__file__).resolve().parent.parent
    _load_dotenv_file(root / ".phonix_deploy.env")
    home_file = Path.home() / ".phonix_deploy.env"
    _load_dotenv_file(home_file)


def load_private_key(path: str, passphrase: str | None) -> paramiko.PKey | None:
    for KeyCls in (paramiko.Ed25519Key, paramiko.RSAKey, paramiko.ECDSAKey):
        try:
            return KeyCls.from_private_key_file(path, password=passphrase or None)
        except Exception:
            continue
    return None


def _password_from_file(path: str) -> str | None:
    """Birinchi qator — parolni chat/buyruqqa yozmaslik uchun (fayl .gitignore da bo‘lsin)."""
    try:
        line = Path(path).read_text(encoding="utf-8", errors="replace").splitlines()[0].strip()
        return line or None
    except (OSError, IndexError):
        return None


def connect_phonix() -> paramiko.SSHClient:
    _load_deploy_credentials_files()
    host = os.environ.get("PHONIX_SSH_HOST", "167.71.53.238")
    user = os.environ.get("PHONIX_SSH_USER", "root")
    password = (os.environ.get("PHONIX_SSH_PASSWORD") or "").strip() or None
    pw_file = (os.environ.get("PHONIX_SSH_PASSWORD_FILE") or "").strip()
    if not password and pw_file:
        password = _password_from_file(pw_file)
    key_path = (os.environ.get("PHONIX_SSH_KEY") or "").strip() or None
    key_pass = (os.environ.get("PHONIX_SSH_KEY_PASSPHRASE") or "").strip() or None
    port = int(os.environ.get("PHONIX_SSH_PORT", "22"))
    use_agent = os.environ.get("PHONIX_SSH_USE_AGENT", "").lower() in ("1", "true", "yes", "on")

    if not password and not key_path and not use_agent:
        print(
            "[xato] PHONIX_SSH_PASSWORD, PHONIX_SSH_KEY yoki PHONIX_SSH_USE_AGENT=1 kerak.",
            file=sys.stderr,
        )
        sys.exit(2)

    pkey = None
    if key_path and os.path.isfile(key_path):
        pkey = load_private_key(key_path, key_pass)
        if pkey is None:
            print(f"[xato] Kalit o‘qilmadi: {key_path}", file=sys.stderr)
            sys.exit(2)

    if pkey is not None:
        allow_agent = False
        look_for_keys = False
    elif password is not None:
        allow_agent = False
        look_for_keys = False
    else:
        allow_agent = True
        look_for_keys = True

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    kwargs: dict = {
        "hostname": host,
        "port": port,
        "username": user,
        "timeout": 45,
        "allow_agent": allow_agent,
        "look_for_keys": look_for_keys,
    }
    if pkey is not None:
        kwargs["pkey"] = pkey
    if password is not None:
        kwargs["password"] = password
    try:
        client.connect(**kwargs)
    except Exception as e:
        print(
            f"[xato] SSH ulanmadi ({host}:{port}): {e}",
            file=sys.stderr,
        )
        sys.exit(2)
    return client
