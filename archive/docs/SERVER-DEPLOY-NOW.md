# Serverda yangilash (pull, migrate, restart)

## Bitta buyruq — hammasi avtomatik (tavsiya)

Serverga SSH bilan kiring, keyin **bitta buyruq** ishlating. Script backend pull/migrate, frontend fetch/build, backend restart va nginx reload qiladi:

```bash
ssh root@167.71.53.238
```

SSH parol yoki kalit — maxfiy; repoga yozmaymiz.

Keyin serverda:

```bash
cd /phonix/backend && git pull origin master && bash deploy_phonix.sh
```

Yoki scriptni GitHubdan to‘g‘ridan-to‘g‘ri ishga tushirish (serverda):

```bash
wget -qO- https://raw.githubusercontent.com/aiziyrak-coder/phonixB/master/deploy_phonix.sh | bash
```

( Bu holda backend/frontend papkalar `/phonix` da bo‘lishi kerak. )

---

## Unmerged / konflikt bo‘lsa (frontend: path 'dist/index.html' is unmerged)

Serverda frontendda `git pull` xato bersa, avval remote ga qattiq moslashtiring, keyin build qiling:

```bash
cd /phonix/frontend && git merge --abort 2>/dev/null; git fetch origin && git reset --hard origin/master && export VITE_API_BASE_URL='https://api.ilmiyfaoliyat.uz/api/v1' && export VITE_MEDIA_URL='https://api.ilmiyfaoliyat.uz/media/' && npm install --silent && (chmod -R u+x node_modules/.bin 2>/dev/null; true) && npm run build && sudo systemctl restart phoenix-backend && echo Done
```

## Oddiy qo‘lda yangilash (konflikt yo‘q bo‘lsa)

```bash
cd /phonix/backend && git pull origin master && source venv/bin/activate && pip install -r requirements.txt -q && python manage.py migrate --noinput && deactivate && cd /phonix/frontend && git fetch origin && git reset --hard origin/master && export VITE_API_BASE_URL='https://api.ilmiyfaoliyat.uz/api/v1' && export VITE_MEDIA_URL='https://api.ilmiyfaoliyat.uz/media/' && npm install --silent && (chmod -R u+x node_modules/.bin 2>/dev/null; true) && npm run build && sudo systemctl restart phoenix-backend && echo Done
```

## Qadamlab (manual)

```bash
cd /phonix/backend
git pull origin master
source venv/bin/activate
pip install -r requirements.txt -q
python manage.py migrate --noinput
deactivate

cd /phonix/frontend
git pull origin master
export VITE_API_BASE_URL='https://api.ilmiyfaoliyat.uz/api/v1'
export VITE_MEDIA_URL='https://api.ilmiyfaoliyat.uz/media/'
npm install --silent
npm run build

sudo systemctl restart phoenix-backend
sudo systemctl status phoenix-backend
```

Tekshirish: https://ilmiyfaoliyat.uz va https://api.ilmiyfaoliyat.uz
