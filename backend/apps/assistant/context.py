"""
Yordamchi uchun muallif ma'lumotlari — FAQAT so'rov yuborgan foydalanuvchining o'ziniki.
Hech bir funksiya boshqa foydalanuvchi ma'lumotini qaytarmaydi; yozish amali yo'q.
"""
from __future__ import annotations

import re
from decimal import Decimal
from typing import Any

from apps.assistant.nlu import norm

# Muallif ko'radigan bosqichlar (frontend utils/articleAuthorWorkflow.ts bilan bir xil)
STAGES = ["To'lov va qoralama", 'Jurnal tekshiruvi', 'Antiplagiat', 'Taqriz', 'Nashr']
STATUS_STAGE = {
    'Draft': 0, 'PaymentCompleted': 0, 'ContractProcessing': 0, 'IsbnProcessing': 0, 'AuthorDataVerified': 0,
    'WritingInProgress': 0, 'Yangi': 1, 'WithEditor': 1, 'PlagiarismReview': 2, 'QabulQilingan': 3, 'Revision': 3,
    'Accepted': 4, 'NashrgaYuborilgan': 4, 'Published': 5, 'Rejected': -1,
    'SentToPrint': 4, 'Printing': 4, 'Ready': 5, 'Packaging': 4,
}
STATUS_HINT = {
    'Draft': "To'lov yoki yuborish yakunlanmagan.",
    'Yangi': "Jurnal tahririyati qabul qildi, ko'rib chiqilmoqda.",
    'WithEditor': "Redaktor ko'rib chiqmoqda.",
    'PlagiarismReview': "Antiplagiat natijasi bosh admin tomonidan ko'rib chiqilmoqda.",
    'QabulQilingan': 'Taqrizchida.',
    'Revision': "Tahrirga qaytarilgan — taqrizchi izohlarini ko'rib, qayta yuboring.",
    'Accepted': "Ma'qullandi, nashrga tayyorlanmoqda.",
    'NashrgaYuborilgan': 'Nashrga yuborilgan.',
    'Published': 'Nashr etilgan.',
    'Rejected': 'Rad etilgan.',
}


def money(value) -> int:
    try:
        return int(Decimal(str(value or 0)))
    except Exception:
        return 0


def profile(user) -> dict[str, str]:
    return {
        'firstName': (user.first_name or '').strip(),
        'lastName': (user.last_name or '').strip(),
        'middleName': (getattr(user, 'patronymic', '') or '').strip(),
        'fullName': ' '.join(x for x in [user.last_name, user.first_name, getattr(user, 'patronymic', '')] if x).strip(),
        'phone': (user.phone or '').strip(),
    }


def articles_summary(user, *, title_fragment: str | None = None, limit: int = 6) -> list[dict[str, Any]]:
    from apps.articles.models import Article

    qs = Article.objects.filter(author=user).select_related('journal').order_by('-submission_date')
    items = list(qs[:60])
    if title_fragment:
        words = [w for w in norm(title_fragment).split() if len(w) >= 4]
        if words:
            scored = []
            for a in items:
                t = norm(a.title)
                score = sum(1 for w in words if w[:6] in t)
                if score:
                    scored.append((score, a))
            if scored:
                scored.sort(key=lambda x: -x[0])
                items = [a for _s, a in scored]
    out = []
    labels = dict(Article.STATUS_CHOICES)
    for a in items[:limit]:
        stage = STATUS_STAGE.get(a.status, 0)
        out.append({
            'id': str(a.pk),
            'title': a.title,
            'status': a.status,
            'status_label': labels.get(a.status, a.status),
            'hint': STATUS_HINT.get(a.status, ''),
            'journal': getattr(a.journal, 'name', ''),
            'stage': stage,
            'stages': STAGES,
            'submitted': a.submission_date.isoformat() if a.submission_date else None,
            'needs_payment': a.status == 'Draft',
        })
    return out


def payments_summary(user, limit: int = 6) -> dict[str, Any]:
    from apps.payments.models import Transaction

    pending = Transaction.objects.filter(user=user, status='pending').order_by('-created_at')
    recent = Transaction.objects.filter(user=user, status='completed').order_by('-completed_at', '-created_at')

    def row(tx):
        return {
            'id': str(tx.pk),
            'service_type': tx.service_type,
            'amount': money(tx.amount),
            'status': tx.status,
            'created': tx.created_at.isoformat() if tx.created_at else None,
            'article_id': str(tx.article_id) if tx.article_id else None,
        }

    return {
        'pending': [row(t) for t in pending[:limit]],
        'recent': [row(t) for t in recent[:limit]],
        'pending_count': pending.count(),
    }


def service_prices() -> dict[str, int]:
    from apps.udc.services import get_service_amount

    return {
        'plagiarism_check': money(get_service_amount('plagiarism_check', 30000)),
        'udk': money(get_service_amount('udk_request', 0)),
        'doi': money(get_service_amount('doi_request', 0)),
        'translation_per_word': money(get_service_amount('translation_per_word', 0)),
        'article_sample_quyi': money(get_service_amount('article_sample_quyi', 0)),
        'article_sample_orta': money(get_service_amount('article_sample_orta', 0)),
        'article_sample_yuqori': money(get_service_amount('article_sample_yuqori', 0)),
    }


def visible_journals(user):
    from apps.journals.models import Journal
    from config.demo import demo_q, is_demo_user

    qs = Journal.objects.select_related('category')
    if not is_demo_user(user):
        qs = qs.exclude(demo_q('journal_admin__'))
    return qs


def journal_card(j) -> dict[str, Any]:
    fee = money(j.publication_fee)
    per_page = money(j.price_per_page)
    return {
        'id': str(j.pk),
        'name': j.name,
        'category': getattr(j.category, 'name', ''),
        'pricing_type': j.pricing_type,
        'publication_fee': fee,
        'price_per_page': per_page,
        'payment_model': j.payment_model,
        'plagiarism_max_percent': j.plagiarism_max_percent,
    }


def find_journal_by_name(user, text: str):
    """Matnda jurnal nomi (yoki uning 2+ mazmunli so'zi) tilga olingan bo'lsa — o'sha jurnal."""
    t = norm(text)
    best, best_score = None, 0
    for j in visible_journals(user):
        words = [w for w in norm(j.name).split() if len(w) >= 5]
        if not words:
            continue
        hits = sum(1 for w in words if w[:6] in t)
        score = hits / len(words)
        if hits >= 2 and score > best_score:
            best, best_score = j, score
    return best if best_score >= 0.5 else None


def recommend_journals(user, *, title: str = '', keywords: list[str] | None = None, abstract: str = '',
                       limit: int = 3) -> list[dict[str, Any]]:
    """Maqola sarlavhasi/kalit so'zlari bo'yicha mos jurnallar (jurnal va kategoriya nomi bilan so'z o'xshashligi)."""
    text = norm(' '.join([title or '', ' '.join(keywords or []), (abstract or '')[:600]]))
    tokens = {w[:6] for w in re.findall(r'[a-z]{5,}', text)}
    scored = []
    for j in visible_journals(user):
        jt = {w[:6] for w in re.findall(r'[a-z]{5,}', norm(f'{j.name} {getattr(j.category, "name", "")} {j.description or ""}'))}
        score = len(tokens & jt)
        scored.append((score, j))
    scored.sort(key=lambda x: (-x[0], x[1].name))
    out = []
    for score, j in scored[:limit]:
        card = journal_card(j)
        card['match'] = score
        out.append(card)
    return out


def quote(intent: str, fields: dict[str, Any], *, journal=None) -> dict[str, Any] | None:
    """Taxminiy narx (yakuniy summani baribir server to'lov yaratishda hisoblaydi)."""
    from apps.payments import pricing

    prices = service_prices()
    if intent == 'plagiarism_check':
        return {'amount': prices['plagiarism_check'], 'note': ''}
    if intent == 'udk':
        return {'amount': prices['udk'], 'note': ''}
    if intent == 'doi':
        return {'amount': prices['doi'], 'note': ''}
    if intent == 'translation':
        wc = int(fields.get('wordCount') or 0)
        per = prices['translation_per_word']
        return {'amount': per * wc if wc else None, 'note': f"{per} so'm × so'zlar soni" if not wc else f"{wc} so'z × {per} so'm"}
    if intent == 'article_sample':
        level = fields.get('qualityLevel') or 'orta'
        per = prices.get(f'article_sample_{level}', 0)
        pages = int(fields.get('pages') or 1)
        return {'amount': per * pages, 'note': f"{pages} bet × {per} so'm"}
    if intent == 'book':
        try:
            amount = pricing.book_publication_amount({
                'pages': fields.get('pages') or 0, 'copies': fields.get('copies') or 0,
                'paper_quality': fields.get('paperQuality') or 'standart', 'cover_type': fields.get('coverType') or 'soft',
                'options': {'isbn': bool(fields.get('isbn')), 'design': bool(fields.get('design'))},
            })
            return {'amount': money(amount), 'note': ''}
        except Exception:
            return None
    if intent == 'submit_article' and journal is not None:
        amount = money(pricing.publication_fee_amount(journal, fields.get('pageCount') or 1))
        note = "Maqola qabul qilingandan keyin to'lanadi" if journal.payment_model == 'post-payment' else "Yuborishda to'lanadi"
        return {'amount': amount, 'note': note}
    return None
