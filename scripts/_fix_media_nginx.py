import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("87.192.230.208", port=2222, username="admin_root", password="qazxsw123@!", timeout=20)
enc = "%D0%91%D0%B5%D0%B7%D1%8B%D0%BC%D1%8F%D0%BD%D0%BD%D1%8B%D0%B9.png"
cmd = f"grep -A6 'location /media/' /etc/nginx/sites-available/phoenix-api-ilmiyfaoliyat.conf; curl -sI https://api.ilmiyfaoliyat.uz/media/journals/{enc} | head -8"
_, o, _ = c.exec_command(cmd, get_pty=True, timeout=30)
print(o.read().decode(errors="replace"))
c.close()
