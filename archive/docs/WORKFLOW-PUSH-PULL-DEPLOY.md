# Push → Pull → Restart (to‘liq zanjir)

Loyiha **ikkita alohida repo**dan iborat:

| Papka    | GitHub repo |
|----------|-------------|
| `backend/`  | `https://github.com/aiziyrak-coder/phonixB.git` |
| `frontend/` | `https://github.com/aiziyrak-coder/phonixF.git` |

Parent papka (`Phonix`) ixtiyoriy: submodule ko‘rsatkichlari `backend` / `frontend` commitlarini saqlaydi.

---

## 1. Lokal: o‘zgarishlarni yuborish (push)

### Variant A — skript (Windows PowerShell)

```powershell
cd E:\Loyihalar\Loyihalar\Phonix
.\scripts\push_repos.ps1
```

### Variant B — qo‘lda

```powershell
cd backend
git add -A
git status
git commit -m "Tavsif: nima o‘zgardi"
git push origin master

cd ..\frontend
git add -A
git status
git commit -m "Tavsif: nima o‘zgardi"
git push origin master
```

Agar default branch `main` bo‘lsa: `git push origin main`.

### Parent repoga submodule yangilanishi (ixtiyoriy)

```powershell
cd E:\Loyihalar\Loyihalar\Phonix
git add backend frontend
git commit -m "chore: bump backend/frontend submodules"
git push origin master
```

**Eslatma:** root `origin` hozir placeholder bo‘lishi mumkin. Haqiqiy URL qo‘yish:

```powershell
git remote -v
git remote set-url origin https://github.com/SIZNING_USER/SIZNING_Phonix_umbrella.git
```

---

## 2. Server: yangi kodni olish va ishga tushirish (pull + restart)

Serverda loyiha odatda `/phonix/backend` va `/phonix/frontend` — har biri **o‘z** repodan `git pull`.

**Bitta buyruq** (tavsiya): backend repodagi deploy skripti hamma narsani qiladi (backend pull allaqachon `deploy_phonix.sh` ichida emas — avval backend papkasiga kirasiz):

```bash
ssh root@167.71.53.238
cd /phonix/backend && git pull origin master && bash deploy_phonix.sh
```

`deploy_phonix.sh` nima qiladi:

1. Backend: `git pull`, `venv`, `pip`, `migrate`, `collectstatic`
2. Frontend: `git fetch` + `reset --hard origin/master`, `npm install`, `npm run build`
3. `systemctl restart phoenix-backend`
4. `systemctl reload nginx`

### `main` branch ishlatilsa

Serverda yoki skriptda `master` o‘rniga `main` yozing yoki:

```bash
cd /phonix/backend && git pull origin main && bash deploy_phonix.sh
```

(Shu payt `deploy_phonix.sh` ichidagi frontend qatori `origin/master` ga bog‘langan bo‘lsa, frontend repoda ham branch mos bo‘lishi kerak.)

---

## 3. Windowsdan masofadan deploy (paramiko)

```powershell
$env:PHONIX_SSH_PASSWORD = "maxfiy_parol"
python scripts\remote_deploy.py
```

Parolni repoga commit qilmang — faqat muhit o‘zgaruvchisi yoki `.env` (`.gitignore`da).

---

## 4. Yangi klon (boshqa mashinada)

```bash
git clone --recurse-submodules https://github.com/SIZNING_USER/Phonix.git
cd Phonix
# yoki submodule keyin:
git submodule update --init --recursive
```

---

## 5. Tekshirish

- Sayt: `https://ilmiyfaoliyat.uz`
- API: `https://api.ilmiyfaoliyat.uz/api/v1/`
- Backend log: `sudo journalctl -u phoenix-backend -n 80 --no-pager`
