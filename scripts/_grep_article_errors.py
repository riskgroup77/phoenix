import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("87.192.230.208", port=2222, username="admin_root", password="qazxsw123@!", timeout=20)
cmd = "echo qazxsw123@! | sudo -S journalctl -u phoenix-backend --since '2026-07-23 13:00:00' --no-pager"
_, o, _ = c.exec_command(cmd, get_pty=True, timeout=120)
text = o.read().decode(errors="replace")
for line in text.splitlines():
    low = line.lower()
    if any(x in low for x in ("article create failed", "post /api/v1/articles", "500", "traceback", "error", "exception")):
        print(line)
c.close()
