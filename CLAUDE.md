# Phoenix (ilmiyfaoliyat.uz) — loyiha qoidalari

## Hujjatlar
- **Har qanday yaratiladigan hujjat** (ma'lumotnoma, sertifikat, hisobot, chek, PDF/DOCX, chop etish ko'rinishi)
  foydalanuvchining **interfeys tilida** (uz / ru / en) shakllanadi. Faqat o'zbekcha qotirilgan matn yozilmaydi.
  - Frontend: til `useT()` dan olinadi; backendga `lang` parametri (yoki `Accept-Language`) yuboriladi.
  - Backend: yorliqlar `lang` bo'yicha tarjima lug'atidan olinadi; noma'lum til → `uz`.
- Hujjat dizayni — mijoz shabloni: `backend/assets/hisobot_template` (fon, logo, gulchambar + QR, #286C81).
  Namuna generator: `backend/apps/articles/works_report.py`.

## Tekshiruv
- Backend testlari: `cd backend && venv/bin/python -m pytest -q` (sozlama: `config.settings_test`, SQLite).
- Frontend: `cd frontend && npx tsc --noEmit -p .`

## Server
- Production: `76.13.79.121` (`ssh phoenix`, root), loyiha `/home/phoenix`, Docker — `docker-compose.prod.yml`.
  Deploy: `bash /home/phoenix/deploy_docker.sh` (GitHub Actions ham shuni ishlatadi). Maxfiy sozlamalar — serverdagi `backend/.env`.
