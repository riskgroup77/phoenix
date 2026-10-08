#!/usr/bin/env python3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from phonix_ssh import connect_phonix

client = connect_phonix()
try:
    _, stdout, _ = client.exec_command(
        "grep -E '^(GEMINI_API_KEY|ANTIPLAGIAT_CLOUD_TOKEN|GOOGLE_API_KEY)=' /phonix/backend/.env 2>/dev/null || true",
        timeout=30,
    )
    for line in stdout.read().decode().splitlines():
        if '=' in line:
            key = line.split('=', 1)[0]
            val = line.split('=', 1)[1].strip().strip('"').strip("'")
            print(f"{key}={'SET' if val else 'EMPTY'}")
finally:
    client.close()
