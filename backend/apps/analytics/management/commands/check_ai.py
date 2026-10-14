"""
AI provayderini haqiqiy so'rov bilan tekshirish (kalit qiymati hech qachon chop etilmaydi).

    python manage.py check_ai
"""
import time

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.services import GeminiService, ai_provider


class Command(BaseCommand):
    help = "AI kaliti (Claude/Gemini) ulanganini va javob berayotganini tekshiradi."

    def handle(self, *args, **options):
        claude_key = bool((settings.ANTHROPIC_API_KEY or '').strip())
        gemini_key = bool((getattr(settings, 'GEMINI_API_KEY', '') or '').strip())
        yes_no = {True: 'bor', False: "yo'q"}
        self.stdout.write(f'ANTHROPIC_API_KEY .env da: {yes_no[claude_key]}')
        self.stdout.write(f'GEMINI_API_KEY .env da: {yes_no[gemini_key]}')
        self.stdout.write(f"AI_PROVIDER: {settings.AI_PROVIDER}")

        provider = ai_provider()
        if provider is None:
            self.stdout.write(self.style.ERROR(
                "Faol AI provayderi yo'q. backend/.env ga ANTHROPIC_API_KEY=... yozing va backendni qayta ishga tushiring."
            ))
            return

        service = GeminiService()
        extra = f", effort={settings.ANTHROPIC_EFFORT}" if provider == 'anthropic' else ''
        self.stdout.write(f"Faol provayder: {provider} — model {service.active_model}{extra}")
        assistant = 'yoqilgan' if settings.ASSISTANT_LLM_ENABLED else "o'chirilgan"
        self.stdout.write(f'AI yordamchi LLM: {assistant} (kunlik limit {settings.ASSISTANT_LLM_DAILY_LIMIT})')

        started = time.monotonic()
        reply = service._generate_text("Faqat bitta so'z bilan javob ber: salom")
        elapsed = time.monotonic() - started
        if reply:
            self.stdout.write(self.style.SUCCESS(f"Javob keldi ({elapsed:.1f} s): {reply[:80]!r}"))
        else:
            self.stdout.write(self.style.ERROR(
                f"Javob kelmadi ({elapsed:.1f} s). Sababi: journalctl -u phoenix-backend -n 30 yoki yuqoridagi log "
                "(yaroqsiz kalit, limit, tarmoq)."
            ))
