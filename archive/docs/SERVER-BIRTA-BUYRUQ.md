# Serverda: bitta buyruq — pull, migratsiya, restart (backend + frontend)

To‘liq git push → server pull jarayoni: repodagi `WORKFLOW-PUSH-PULL-DEPLOY.md` faylini ko‘ring.

**1.** Serverga kirish:
```text
ssh root@167.71.53.238
```

(SSH parolini yoki kalitni maxfiy saqlang.)

**2.** Serverda **shu bitta buyruqni** nusxalab ishlating (pull, migrate, restart hammasi avtomatik):

```bash
cd /phonix/backend && git pull origin master && bash deploy_phonix.sh
```

Bu buyruq:
- **Backend:** GitHubdan pull → pip install → **migratsiya** → **restart** (phoenix-backend)
- **Frontend:** GitHubdan pull → npm install → build → **nginx reload** (frontend yangilanishi)

Bundan keyin https://ilmiyfaoliyat.uz va https://api.ilmiyfaoliyat.uz yangi kod bilan ishlaydi.
