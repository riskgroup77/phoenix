import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from phonix_ssh import connect_phonix

c = connect_phonix()
_, o, e = c.exec_command(
    "systemctl is-active phoenix-telegram-bot; "
    "journalctl -u phoenix-telegram-bot -n 5 --no-pager 2>/dev/null"
)
print(o.read().decode("utf-8", errors="replace"))
print(e.read().decode("utf-8", errors="replace"))
c.close()
