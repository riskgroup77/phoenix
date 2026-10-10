"""
Muallif yordamchisining asosiy mantig'i.

Xavfsizlik tamoyili: yordamchi HECH QANDAY yozish amalini bajarmaydi (to'lov, yuborish, o'chirish).
U faqat (1) muallifning o'z ma'lumotlarini o'qiydi va (2) tegishli xizmat formasini oldindan to'ldirish
uchun «action» qaytaradi. Formani frontend o'ng panelda ochadi — muallif tekshiradi va o'zi tasdiqlaydi;
narx, ruxsat va tekshiruvlar odatdagi API'da (pricing.py va h.k.) qo'llanadi.

Javob tuzilishi:
    {'reply': str, 'action': {...} | None, 'cards': [...], 'suggestions': [...]}
Suhbat holati (conversation.state): {'active': {'intent', 'fields'}, 'queue': [...], 'file': {...}}
"""
from __future__ import annotations

import logging
import re
from typing import Any

from django.conf import settings

from apps.assistant import context as ctx
from apps.assistant import nlu
from apps.assistant.messages import field_label, label, say, suggestions

logger = logging.getLogger(__name__)

# Xizmat formasidagi maydonlar (frontend prefill kalitlari) va majburiylari
FIELDS: dict[str, tuple[str, ...]] = {
    'submit_article': ('title', 'abstract', 'keywords', 'journalId', 'authorName', 'pageCount'),
    'plagiarism_check': ('documentName', 'documentType', 'documentDescription', 'authorFirstName', 'authorLastName'),
    'udk': ('firstName', 'lastName', 'middleName', 'title', 'abstract'),
    'doi': ('firstName', 'lastName'),
    'translation': ('sourceLang', 'targetLang', 'wordCount'),
    'book': ('pages', 'copies', 'paperQuality', 'coverType', 'isbn', 'design', 'publicationType', 'shippingRegion',
             'shippingAddress', 'shippingFirstName', 'shippingLastName', 'shippingPhone', 'title', 'synopsis'),
    'article_sample': ('language', 'structure', 'articleType', 'topic', 'pages', 'qualityLevel', 'firstName', 'lastName'),
}
REQUIRED: dict[str, tuple[str, ...]] = {
    'submit_article': ('file', 'title', 'journalId'),
    'plagiarism_check': ('file', 'documentType'),
    'udk': ('title', 'abstract'),
    'doi': ('file',),
    'translation': ('file', 'targetLang'),
    'book': ('file', 'pages', 'copies'),
    'article_sample': ('topic', 'language', 'structure', 'articleType'),
}
ENUMS = {
    'sourceLang': {'uz', 'en', 'ru', 'fr', 'de', 'es', 'ar'},
    'targetLang': {'uz', 'en', 'ru', 'fr', 'de', 'es', 'ar'},
    'paperQuality': {'eco', 'standart'},
    'coverType': {'soft', 'hard'},
    'publicationType': {'bosma', 'raqamli'},
    'qualityLevel': {'quyi', 'orta', 'yuqori'},
    'articleType': {'Maqola', 'Tezis'},
    'language': {"O'zbek", 'Rus', 'Ingliz'},
    'structure': set(nlu.STRUCTURES.values()),
    'documentType': {v for _p, v in nlu.DOC_TYPE_WORDS} | {
        "Ko'rsatmalar", 'Doktorlik dissertatsiyasi referati fan nomzodi', 'Yakuniy saralash ishi'},
}
INT_FIELDS = {'pages': (1, 2000), 'copies': (1, 10000), 'pageCount': (1, 500), 'wordCount': (0, 2_000_000)}
BOOL_FIELDS = {'isbn', 'design'}
CONTINUE_RE = re.compile(r'^(davom|keyingi|dalshe|dalee|continue|next)\b')


# ---------------------------------------------------------------- yordamchilar


def clean_fields(intent: str, fields: dict[str, Any]) -> dict[str, Any]:
    """Faqat ruxsat etilgan maydonlar, to'g'ri turlar va qiymatlar (LLM yoki foydalanuvchi matnidan kelgan ham)."""
    allowed = set(FIELDS.get(intent, ()))
    out: dict[str, Any] = {}
    for key, val in (fields or {}).items():
        if key not in allowed or val is None or val == '':
            continue
        if key in INT_FIELDS:
            try:
                n = int(val)
            except (TypeError, ValueError):
                continue
            lo, hi = INT_FIELDS[key]
            if lo <= n <= hi:
                out[key] = n
        elif key in BOOL_FIELDS:
            out[key] = bool(val) if isinstance(val, bool) else str(val).lower() in ('1', 'true', 'ha', 'yes')
        elif key in ENUMS:
            if val in ENUMS[key]:
                out[key] = val
        elif key == 'keywords':
            if isinstance(val, (list, tuple)):
                val = ', '.join(str(v) for v in val)
            out[key] = str(val)[:500]
        else:
            limit = 1500 if key in ('abstract', 'synopsis', 'documentDescription') else 300
            out[key] = str(val).strip()[:limit]
    return out


def base_fields(intent: str, user, file_info: dict | None) -> dict[str, Any]:
    """Profil va fayldan olinadigan boshlang'ich qiymatlar."""
    p = ctx.profile(user)
    f = file_info or {}
    title = f.get('title') or ''
    abstract = f.get('abstract') or ''
    kw = f.get('keywords') or []
    if intent == 'submit_article':
        return {'title': title, 'abstract': abstract, 'keywords': ', '.join(kw), 'authorName': p['fullName'],
                'pageCount': f.get('page_estimate') or None}
    if intent == 'plagiarism_check':
        doc_type = 'Maqola' if f else None
        return {'documentName': title, 'documentType': doc_type, 'authorFirstName': p['firstName'],
                'authorLastName': p['lastName']}
    if intent == 'udk':
        return {'firstName': p['firstName'], 'lastName': p['lastName'], 'middleName': p['middleName'],
                'title': title, 'abstract': abstract}
    if intent == 'doi':
        return {'firstName': p['firstName'], 'lastName': p['lastName']}
    if intent == 'translation':
        src = f.get('language') if f.get('language') in ('uz', 'ru', 'en') else None
        return {'sourceLang': src, 'wordCount': f.get('word_count') or None}
    if intent == 'book':
        # design=True — sahifa (SubmitBook) muqova rasmi yuklanmaguncha professional dizaynni yoqadi; narx mos bo'lsin
        return {'title': title, 'synopsis': abstract, 'pages': f.get('page_estimate') or None, 'design': True,
                'shippingFirstName': p['firstName'], 'shippingLastName': p['lastName'], 'shippingPhone': p['phone']}
    if intent == 'article_sample':
        return {'firstName': p['firstName'], 'lastName': p['lastName'], 'qualityLevel': 'orta', 'articleType': 'Maqola',
                'structure': nlu.STRUCTURES['standard']}
    return {}


def build_action(intent: str, fields: dict[str, Any], *, user, file_info: dict | None, lang: str) -> dict[str, Any]:
    journal = None
    if intent == 'submit_article' and fields.get('journalId'):
        journal = ctx.visible_journals(user).filter(pk=fields['journalId']).first()
        if journal is None:
            fields.pop('journalId', None)
    has_file = bool(file_info)
    missing = [k for k in REQUIRED.get(intent, ()) if (k == 'file' and not has_file) or (k != 'file' and not fields.get(k))]
    meta = nlu.SERVICE_INTENTS[intent]
    return {
        'intent': intent,
        'path': meta['path'],
        'label': label(intent, lang),
        'fields': fields,
        'filled': sorted(k for k, v in fields.items() if v not in (None, '', False)),
        'missing': missing,
        'needs_file': 'file' in REQUIRED.get(intent, ()),
        'has_file': has_file,
        'quote': ctx.quote(intent, fields, journal=journal),
        'journal': ctx.journal_card(journal) if journal is not None else None,
    }


def _fmt_money(n) -> str:
    return f'{int(n):,}'.replace(',', ' ')


# ---------------------------------------------------------------- asosiy funksiya


def respond(user, state: dict[str, Any], text: str, *, file_info: dict | None = None, lang: str = 'uz',
            use_llm: bool = True) -> tuple[dict[str, Any], dict[str, Any]]:
    """(javob, yangi holat). Holat chaqiruvchida saqlanadi."""
    lang = lang if lang in ('uz', 'ru', 'en') else 'uz'
    state = dict(state or {})
    text = (text or '').strip()[:2000]
    if file_info:
        state['file'] = file_info
    file_now = state.get('file')

    out: dict[str, Any] = {'reply': '', 'action': None, 'cards': [], 'suggestions': []}
    t = nlu.norm(text)
    intents = nlu.detect_intents(text) if text else []

    # «davom et» — navbatdagi xizmat
    if CONTINUE_RE.match(t) and state.get('queue'):
        intents = [state['queue'].pop(0)]

    llm_info: dict[str, Any] = {}
    if use_llm and text and _llm_wanted(text, intents, state):
        from apps.assistant import llm

        llm_info = llm.interpret(user, text, state=state, file_info=file_now, lang=lang) or {}
        if not intents and llm_info.get('intents'):
            intents = [i for i in llm_info['intents'] if i in nlu.SERVICE_INTENTS or i in nlu.INFO_INTENTS]

    if 'cancel' in intents:
        state.pop('active', None)
        state['queue'] = []
        out['reply'] = say('cancel', lang)
        out['suggestions'] = suggestions('start', lang)
        return out, state

    services = [i for i in intents if i in nlu.SERVICE_INTENTS]
    info = [i for i in intents if i not in nlu.SERVICE_INTENTS]

    # Niyat aniqlanmadi, lekin forma ochiq — xabar shu formaga qo'shimcha («100 nusxa», «qattiq muqova»)
    active_intent = (state.get('active') or {}).get('intent')
    if not services and not info and text and active_intent in nlu.SERVICE_INTENTS:
        if nlu.extract_slots(active_intent, text) or (active_intent == 'submit_article' and ctx.find_journal_by_name(user, text)):
            services = [active_intent]

    # Faqat fayl yuborildi — nima qilishni so'raymiz (faol xizmat bo'lsa — unga biriktiramiz)
    if file_info and not services and not info:
        active = state.get('active')
        if active and active.get('intent') in nlu.SERVICE_INTENTS:
            services = [active['intent']]
        else:
            if not file_info.get('has_text'):
                out['reply'] = say('file_unreadable', lang)
            else:
                out['reply'] = say('file_what', lang, title=file_info.get('title') or file_info.get('filename') or '',
                                   words=_fmt_money(file_info.get('word_count') or 0), pages=file_info.get('page_estimate') or 1)
            out['cards'].append({'type': 'file', 'file': file_info})
            out['suggestions'] = suggestions('file', lang)
            return out, state

    if 'prices' in info:
        out['cards'].append(_prices_card(lang))
        out['reply'] = say('prices', lang)
        if services:
            # «UDK narxi qancha?» — xizmatni ochmaymiz, faqat narx
            q = ctx.quote(services[0], {}, journal=None)
            if q and q.get('amount'):
                out['reply'] = label(services[0], lang) + ': ' + say('price', lang, amount=_fmt_money(q['amount']), note='')
            out['suggestions'] = [label(s, lang) for s in services]
            return out, state
        out['suggestions'] = suggestions('start', lang)
        return out, state

    if services:
        first, rest = services[0], services[1:]
        if rest:
            state['queue'] = [s for s in rest if s != first] + [q for q in state.get('queue', []) if q not in rest]
        active = state.get('active') or {}
        prev_fields = active.get('fields', {}) if active.get('intent') == first else {}
        fields = {k: v for k, v in base_fields(first, user, file_now).items() if v not in (None, '')}
        fields.update(prev_fields)
        fields.update(nlu.extract_slots(first, text))
        if first == 'submit_article':
            j = ctx.find_journal_by_name(user, text)
            if j is not None:
                fields['journalId'] = str(j.pk)
        llm_fields = (llm_info.get('fields') or {}).get(first) or {}
        for k, v in clean_fields(first, llm_fields).items():
            fields.setdefault(k, v)
        fields = clean_fields(first, fields)
        state['active'] = {'intent': first, 'fields': fields}
        action = build_action(first, fields, user=user, file_info=file_now, lang=lang)
        out['action'] = action

        parts = []
        n = len(action['filled'])
        parts.append(say('action_ready', lang, label=action['label'], filled=say('filled_suffix', lang, n=n) if n else ''))
        q = action.get('quote')
        if q and q.get('amount'):
            parts.append(say('price', lang, amount=_fmt_money(q['amount']), note=f" ({q['note']})" if q.get('note') else ''))
        missing = action['missing']
        if 'file' in missing:
            parts.append(say('need_file', lang))
        other_missing = [field_label(m, lang) for m in missing if m != 'file']
        if first == 'submit_article' and 'journalId' in missing:
            recs = ctx.recommend_journals(user, title=fields.get('title', ''), keywords=(fields.get('keywords') or '').split(','),
                                          abstract=fields.get('abstract', ''))
            if recs:
                out['cards'].append({'type': 'journals', 'items': recs})
                parts.append(say('journal_pick', lang))
                other_missing = [m for m in other_missing if m != field_label('journalId', lang)]
        if other_missing:
            parts.append(say('missing', lang, items=', '.join(other_missing)))
        jcard = action.get('journal')
        if jcard and jcard.get('plagiarism_max_percent'):
            parts.append(say('journal_limit', lang, limit=int(jcard['plagiarism_max_percent'])))
        if state.get('queue'):
            parts.append(say('queue_next', lang, label=label(state['queue'][0], lang)))
            out['suggestions'] = suggestions('continue', lang)
        out['reply'] = ' '.join(parts)
        return out, state

    if 'status' in info:
        frag = nlu.mentioned_title_fragment(text)
        items = ctx.articles_summary(user, title_fragment=frag)
        if not items:
            out['reply'] = say('status_none', lang)
            out['suggestions'] = suggestions('start', lang)[:2]
        else:
            out['cards'].append({'type': 'articles', 'items': items})
            top = items[0]
            if frag and len(items) >= 1 and nlu.norm(frag)[:6] in nlu.norm(top['title']):
                out['reply'] = say('status_one', lang, title=top['title'], status=top['status_label'], hint=top['hint'])
            else:
                out['reply'] = say('status_list', lang)
        return out, state

    if 'payments' in info:
        data = ctx.payments_summary(user)
        out['cards'].append({'type': 'payments', **data})
        out['reply'] = say('payments', lang, pending=data['pending_count'])
        out['open'] = {'path': '/payments', 'label': label('payments', lang)}
        return out, state

    if 'journals' in info:
        f = (state.get('active') or {}).get('fields') or {}
        src = file_now or {}
        recs = ctx.recommend_journals(user, title=f.get('title') or src.get('title') or text,
                                      keywords=src.get('keywords') or [], abstract=src.get('abstract') or '', limit=5)
        out['cards'].append({'type': 'journals', 'items': recs})
        out['reply'] = say('journal_pick', lang)
        return out, state

    for key, path in (('archive', '/arxiv'), ('profile', '/profile?tab=profile')):
        if key in info:
            out['open'] = {'path': path, 'label': label(key, lang)}
            out['reply'] = say('open_page', lang, label=label(key, lang))
            return out, state

    if 'operator' in info:
        contacts = ', '.join(x for x in (getattr(settings, 'SUPPORT_PHONE', ''), getattr(settings, 'SUPPORT_EMAIL', '')) if x)
        out['reply'] = say('operator', lang, contacts=contacts or 'support@ilmiyfaoliyat.uz')
        out['cards'].append({'type': 'articles', 'items': ctx.articles_summary(user, limit=4)})
        return out, state

    if 'thanks' in info:
        out['reply'] = say('thanks', lang)
        out['suggestions'] = suggestions('start', lang)
        return out, state

    if 'greeting' in info or 'help' in info:
        name = ctx.profile(user)['firstName'] or ''
        out['reply'] = say('greeting', lang, name=name) if 'greeting' in info else say('help', lang)
        out['suggestions'] = suggestions('start', lang)
        return out, state

    # Hech narsa tushunilmadi — LLM javobi (platforma bo'yicha umumiy savol) yoki namuna
    if llm_info.get('reply'):
        out['reply'] = llm_info['reply']
    else:
        out['reply'] = say('not_understood', lang)
    out['suggestions'] = suggestions('start', lang)
    return out, state


def _llm_wanted(text: str, intents: list[str], state: dict) -> bool:
    from apps.assistant import llm

    if not llm.llm_enabled():
        return False
    if not intents and not state.get('active'):
        return True  # qoidalar tushunmadi
    services = [i for i in intents if i in nlu.SERVICE_INTENTS]
    # Erkin matnda tafsilot ko'p bo'lsa (mavzu, talablar) — maydonlarni LLM aniqroq oladi
    return bool(services) and len(text) >= 80


def _prices_card(lang: str) -> dict[str, Any]:
    p = ctx.service_prices()
    rows = [
        (label('plagiarism_check', lang), p['plagiarism_check'], ''),
        (label('udk', lang), p['udk'], ''),
        (label('doi', lang), p['doi'], ''),
        (label('translation', lang), p['translation_per_word'], "/so'z" if lang == 'uz' else ('/слово' if lang == 'ru' else '/word')),
        (label('article_sample', lang), p['article_sample_orta'], "/bet" if lang == 'uz' else ('/стр.' if lang == 'ru' else '/page')),
    ]
    return {'type': 'prices', 'items': [{'label': lbl, 'amount': amt, 'unit': unit} for lbl, amt, unit in rows if amt]}
