"""
Antiplagiat tekshiruvi (suniy intellektsiz) — faqat HAQIQIY topilgan mosliklar asosida.

Manbalar (antiplagiat_real_scan, algoritm 5.0):
- ichki baza: BUTUN hujjat barmoq izlari indeksi bilan (normalizatsiya: kirill/lotin, apostrof, qo'shimchalar);
  so'z tartibi o'zgartirilgan gaplar ham; OpenSearch indeksi (yoqilgan bo'lsa);
- OpenAlex / Crossref / Semantic Scholar / CORE ochiq API'lari (annotatsiya va ochiq PDF to'liq matni);
- shablon iboralar, parafraz (E5 embedding), web qidiruv (sozlangan bo'lsa);
- o'z-o'ziga iqtibos (muallifning o'z ishlari).

Foizlar:
- o'zlashtirish  = begona manbalarda topilgan gaplar ulushi (har gap bir marta sanaladi);
- o'z-o'ziga iqtibos = muallifning o'z ishlarida topilgan gaplar ulushi;
- iqtibos = iqtibos belgisi bor gaplar ulushi ([1], (2020), «...», et al.);
- originallik = qolgan qism.

MUHIM: bu modul hech qachon manba, havola, sana yoki foizni "to'qib chiqarmaydi" va
tekshiruvni sun'iy cho'zmaydi. Tekshirilmagan manba bazasi hisobotda ko'rsatilmaydi.
"""
from __future__ import annotations

import re
from collections import Counter
from typing import Any, Callable

from django.conf import settings

from apps.articles.antiplagiat_modules import (
    AI_CLICHES,
    AI_MODULE_IDS,
    DEFAULT_MODULE_IDS,
    MODULE_CATALOG,
)
from apps.articles.antiplagiat_overlap import compute_verified_coverage, normalize_compact

ProgressCallback = Callable[..., None]

MAX_REPORT_SOURCES = 3200
ALGORITHM_VERSION = '5.0'


def _default_enabled_modules() -> set[str]:
    # Tanlov bo'lmasa — joriy sozlamalarda haqiqatan ishlaydigan barcha modullar
    from apps.articles.antiplagiat_available import available_module_ids

    return set(available_module_ids())


def _normalize_enabled_modules(enabled_modules: list[str] | None) -> set[str]:
    if not enabled_modules:
        return _default_enabled_modules()
    valid = set(DEFAULT_MODULE_IDS)
    chosen = {m for m in enabled_modules if m in valid}
    return chosen or _default_enabled_modules()


def _labels(module_ids) -> list[str]:
    ids = set(module_ids)
    return [m['label'] for m in MODULE_CATALOG if m['id'] in ids]


def _normalize_words(text: str) -> list[str]:
    return re.findall(r"[\w']+", (text or '').lower(), flags=re.UNICODE)


def _shingles(words: list[str], n: int = 4) -> set[str]:
    if len(words) < n:
        return {' '.join(words)} if words else set()
    return {' '.join(words[i : i + n]) for i in range(len(words) - n + 1)}


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    union = len(a | b)
    return len(a & b) / union if union else 0.0


def _split_sentences(text: str) -> list[str]:
    parts = re.split(r'(?<=[.!?…])\s+|\n+', text or '')
    return [p.strip() for p in parts if p.strip() and len(p.strip()) > 15]


_BIBLIOGRAPHY_HEADING = re.compile(
    r"^\s*(?:\d+\.?\s*)?(?:"
    r"(?:foydalanilgan|ishlatilgan)\s+adabiyotlar(?:\s+ro.?yxati)?|adabiyotlar(?:\s+ro.?yxati)?|"
    r"foydalanilgan\s+manbalar(?:\s+ro.?yxati)?|manbalar\s+ro.?yxati|"
    r"фойдаланилган\s+адабиётлар(?:\s+рўйхати)?|адабиётлар(?:\s+рўйхати)?|"
    r"список\s+(?:использованной\s+|цитируемой\s+)?литературы|список\s+использованных\s+источников|"
    r"использованная\s+литература|литература|библиографический\s+список|"
    r"references|bibliography|literature\s+cited|works\s+cited"
    r")\s*[:.]?\s*$",
    re.IGNORECASE | re.MULTILINE,
)


def strip_bibliography(text: str) -> tuple[str, int]:
    """
    Hujjatning ikkinchi yarmidagi "Foydalanilgan adabiyotlar" / "Список литературы" / "References"
    sarlavhasidan keyingi qism olib tashlanadi. (asosiy matn, chiqarilgan belgilar soni — bo'shliqsiz)
    """
    if not text:
        return text, 0
    half = len(text) * 0.5
    found = None
    for m in _BIBLIOGRAPHY_HEADING.finditer(text):
        if m.start() >= half:
            found = m  # oxirgisi (mundarijadagi emas)
    if not found:
        return text, 0
    body = text[: found.start()].rstrip()
    return body, _chars(text[found.start():])


def _split_paragraphs(text: str) -> list[str]:
    parts = re.split(r'\n\s*\n+|\n', text or '')
    out: list[str] = []
    buf: list[str] = []
    for part in parts:
        chunk = part.strip()
        if not chunk:
            if buf:
                out.append(' '.join(buf))
                buf = []
            continue
        if len(chunk) < 25 and buf:
            buf.append(chunk)
            continue
        if buf:
            out.append(' '.join(buf))
            buf = []
        out.append(chunk)
    if buf:
        out.append(' '.join(buf))
    return [p for p in out if len(p) >= 20]


def _sentence_overlap(a: str, b: str) -> float:
    aw = _normalize_words(a)
    bw = _normalize_words(b)
    if len(aw) < 4 or len(bw) < 4:
        return 1.0 if a.strip()[:40] == b.strip()[:40] else 0.0
    return _jaccard(_shingles(aw), _shingles(bw))


def _generate_annotated_document(text: str, sources: list[dict], *, max_paragraphs: int = 600) -> list[dict]:
    """Hujjat matni va har paragrafda topilgan manba raqamlari (inline belgilar)."""
    paragraphs = _split_paragraphs(text)
    if not paragraphs:
        return []
    sent_map = [
        ((src.get('document_fragment') or '').strip(), idx + 1)
        for idx, src in enumerate(sources)
        if (src.get('document_fragment') or '').strip()
    ]
    para_sents = [(para, _split_sentences(para) or [para]) for para in paragraphs[:max_paragraphs]]
    # 5.0 hitlarida document_fragment — hujjatdagi gapning aynan o'zi: lug'at orqali darhol topiladi,
    # taxminiy solishtirish faqat qolgan (kesilgan / boshqa skanerlardan kelgan) parchalar uchun
    all_sents = {s for _p, ss in para_sents for s in ss}
    exact: dict[str, list[int]] = {}
    fuzzy: list[tuple[str, int]] = []
    for frag, src_idx in sent_map:
        if frag in all_sents:
            exact.setdefault(frag, []).append(src_idx)
        else:
            fuzzy.append((frag, src_idx))
    annotated: list[dict] = []
    for para, sents in para_sents:
        refs: set[int] = set()
        # segments: gaplar va har biriga eng mos manba (matnni manbalar bo'yicha rangli ko'rsatish uchun)
        segments: list[dict] = []
        for sent in sents:
            best_idx, best_score = None, 0.0
            for src_idx in exact.get(sent, ()):
                refs.add(src_idx)
                if best_idx is None:
                    best_idx, best_score = src_idx, 1.0
            for frag, src_idx in fuzzy:
                if frag in sent or sent in frag:
                    score = 1.0
                else:
                    score = _sentence_overlap(sent, frag)
                if score >= 0.42:
                    refs.add(src_idx)
                    if score > best_score:
                        best_idx, best_score = src_idx, score
            segments.append({'text': sent[:1200], 'source': best_idx})
        annotated.append({'text': para[:2500], 'source_refs': sorted(refs), 'segments': segments[:80]})
    return annotated


def _finalize_sources(sources: list[dict]) -> list[dict]:
    finalized: list[dict] = []
    for idx, src in enumerate(sources[:MAX_REPORT_SOURCES]):
        doc_frag = (src.get('document_fragment') or src.get('snippet') or '').strip()
        finalized.append({
            **src,
            'title': (src.get('title') or doc_frag[:120]).strip(),
            'source_index': idx + 1,
            'document_fragment': doc_frag[:360],
            'source_fragment': (src.get('source_fragment') or '')[:360],
        })
    return finalized


_CITATION_MARKERS = re.compile(
    r'\[\d+(?:[,–-]\s*\d+)*\]|\([^()]{0,60}\d{4}[a-z]?\)|«[^»]{8,}»|"[^"]{8,}"|“[^”]{8,}”|'
    r'\bet\s+al\.|\bva\s+hok\.|\bи\s+др\.',
    re.IGNORECASE | re.UNICODE,
)


def _sentence_key(sentence: str) -> str:
    return normalize_compact(sentence)[:200]


def _cited_sentence_keys(sentences: list[str]) -> set[str]:
    return {_sentence_key(s) for s in sentences if _CITATION_MARKERS.search(s)}


def _chars(text: str) -> int:
    return len(re.sub(r'\s+', '', text or ''))


def _compute_ai_content_percentage(enabled: set[str], sentences: list[str]) -> float:
    """SI uslubi bo'yicha TAXMINIY ko'rsatkich (shablon iboralar va so'z xilma-xilligi)."""
    if not (enabled & AI_MODULE_IDS) or not sentences:
        return 0.0
    score = 0.0
    for sent in sentences:
        sl = sent.lower()
        if any(c.lower() in sl for c in AI_CLICHES):
            score += 1.0
            continue
        words = _normalize_words(sent)
        if len(words) >= 10 and len(set(words)) / len(words) < 0.52:
            score += 0.45
    return round(min(92.0, (score / len(sentences)) * 100), 2)


def _section_scores(sentences: list[str], hits: list[dict]) -> list[dict]:
    """Hujjat bo'limlari bo'yicha haqiqiy qoplanish (topilgan gaplar ulushi)."""
    covered_keys = {
        _sentence_key(h.get('document_fragment') or '')
        for h in hits
        if not h.get('self_citation') and not h.get('cited')
    }
    sections = []
    chunk_size = max(3, len(sentences) // min(8, max(1, len(sentences))))
    for i in range(0, len(sentences), chunk_size):
        chunk = sentences[i : i + chunk_size]
        total = sum(_chars(s) for s in chunk) or 1
        covered = sum(_chars(s) for s in chunk if _sentence_key(s) in covered_keys)
        ratio = covered / total
        joined = ' '.join(chunk)
        sections.append({
            'index': len(sections) + 1,
            'preview': joined[:120] + ('...' if len(joined) > 120 else ''),
            'word_count': len(_normalize_words(joined)),
            'plagiarism_score': round(min(100.0, ratio * 100), 1),
            'risk': 'high' if ratio > 0.5 else 'medium' if ratio > 0.25 else 'low',
        })
    return sections


class AntiplagiatEngine:
    """Suniy intellektsiz antiplagiat tekshiruvi — faqat haqiqiy mosliklar."""

    def check_text(
        self,
        text: str,
        *,
        exclude_article_id=None,
        exclude_author_id=None,
        enabled_modules: list[str] | None = None,
        progress_callback: ProgressCallback | None = None,
        deep: bool = True,
        file_tricks: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        from apps.articles.antiplagiat_tricks import clean_text, summarize

        # Aldash usullari (ko'rinmas belgilar, o'xshash harflar) zararsizlantiriladi — tekshiruv asl matn bo'yicha
        clean, trick_stats = clean_text((text or '').strip())
        # Adabiyotlar ro'yxati o'zlashtirish emas — tekshiruvdan va foiz hisobidan chiqariladi
        clean, bibliography_chars = strip_bibliography(clean.strip())
        if len(clean) < 50:
            return self._empty_report(enabled_modules)

        enabled = _normalize_enabled_modules(enabled_modules)
        words = _normalize_words(clean)
        sentences = _split_sentences(clean)
        total_chars = _chars(clean) or 1

        from apps.articles.antiplagiat_corpus import load_platform_corpus
        from apps.articles.antiplagiat_index import index_ready
        from apps.articles.antiplagiat_modules import CORPUS_MODULE_IDS
        from apps.articles.antiplagiat_real_scan import run_real_antiplag_scan

        # Indeks qurilgan bo'lsa korpus xotiraga yuklanmaydi (PDF'lar ham qayta o'qilmaydi)
        needs_corpus = bool(enabled & CORPUS_MODULE_IDS) or bool(exclude_author_id)
        corpus = load_platform_corpus(exclude_article_id) if needs_corpus and not index_ready() else []

        real_hits: list[dict] = []
        real_coverage: dict[str, Any] = {}
        if getattr(settings, 'ANTIPLAG_REAL_SCAN_ENABLED', True):
            real_hits, real_coverage = run_real_antiplag_scan(
                clean,
                sentences,
                corpus=corpus,
                enabled=enabled,
                exclude_article_id=str(exclude_article_id) if exclude_article_id else None,
                exclude_author_id=str(exclude_author_id) if exclude_author_id else None,
                progress_callback=progress_callback,
            )

        # To'g'ri iqtibos qilingan gap (iqtibos belgisi bor) o'zlashtirish emas — iqtibos sifatida hisoblanadi
        citation_enabled = 'iqtibos_keltirish' in enabled
        cited_keys = _cited_sentence_keys(sentences) if citation_enabled else set()
        for h in real_hits:
            h['cited'] = _sentence_key(h.get('document_fragment') or '') in cited_keys

        coverage = compute_verified_coverage([h for h in real_hits if not h['cited']], total_chars, text=clean)
        plagiarism_pct = coverage['verified_plagiarism_pct']
        self_citation_pct = coverage['verified_self_citation_pct'] if citation_enabled else 0.0
        citation_pct = 0.0
        if citation_enabled:
            cited_chars = sum(_chars(s) for s in sentences if _sentence_key(s) in cited_keys)
            citation_pct = round(min(100.0, cited_chars / total_chars * 100), 2)
        # Yig'indi 100% dan oshmasin (o'zlashtirish ustuvor)
        citation_pct = round(max(0.0, min(citation_pct, 100.0 - plagiarism_pct - self_citation_pct)), 2)
        originality_pct = round(max(0.0, 100.0 - plagiarism_pct - citation_pct - self_citation_pct), 2)

        sources = _finalize_sources(
            sorted(real_hits, key=lambda h: float(h.get('similarity') or 0), reverse=True)
        )

        if progress_callback:
            progress_callback(
                phase='finalizing', progress_percent=95, module_label='Yakuniy hisobot',
                sources_found=len(sources),
            )

        fivegrams = [' '.join(words[i : i + 5]) for i in range(max(0, len(words) - 4))]
        repeat_ratio = sum(1 for _, c in Counter(fivegrams).items() if c > 2) / max(len(set(fivegrams)), 1)
        internal_repeat_pct = round(min(40.0, repeat_ratio * 100), 1)

        paraphrase_chars = sum(
            int(h.get('overlap_chars') or 0) for h in real_hits
            if h.get('match_subtype') in ('paraphrase', 'reordered')
            and not h.get('self_citation') and not h.get('cited')
        )
        paraphrase_pct = round(min(plagiarism_pct, paraphrase_chars / total_chars * 100), 1)

        ai_content_pct = _compute_ai_content_percentage(enabled, sentences)

        executed = set(real_coverage.get('executed_modules') or [])
        if citation_enabled:
            executed.add('iqtibos_keltirish')
        if enabled & AI_MODULE_IDS:
            executed |= enabled & AI_MODULE_IDS
        checked = int(real_coverage.get('checked_sentences') or 0)
        total_sent = max(len(sentences), 1)
        scan_coverage_pct = round(min(100.0, checked / total_sent * 100), 1)

        overall_risk = 'high' if plagiarism_pct > 50 else 'medium' if plagiarism_pct > 25 else 'low'
        if ai_content_pct > 35:
            overall_risk = 'high'
        bypass = summarize(trick_stats, file_tricks, total_chars)
        recommendations = []
        if bypass['detected']:
            overall_risk = 'high'
            recommendations.append(
                "DIQQAT: hujjatda antiplagiat tizimini aldashga urinish belgilari aniqlandi ("
                + '; '.join(bypass['items'])
                + "). Bu belgilar olib tashlanib, tekshiruv asl matn bo'yicha o'tkazildi."
            )
        if plagiarism_pct > 40:
            recommendations.append(
                "Matnda boshqa manbalar bilan o'xshash qismlar aniqlandi. Manbalarni to'g'ri iqtibos qiling."
            )
        if internal_repeat_pct > 15:
            recommendations.append("Hujjat ichida takrorlanuvchi iboralar ko'p. Matnni qayta tahrirlang.")
        if plagiarism_pct < 20:
            recommendations.append("Originallik darajasi yuqori. Kichik tahrirlar bilan yetarli.")
        if ai_content_pct > 25:
            recommendations.append(
                "Matnda SI (sun'iy intellekt) uslubidagi iboralar aniqlangan (taxminiy ko'rsatkich). "
                "Matnni qo'lda tahrirlash yoki manbalar bilan boyitish tavsiya etiladi."
            )

        executed_labels = _labels(executed)
        report = {
            'overall_risk': overall_risk,
            # Ishonchlilik = hujjatdagi gaplarning qancha qismi haqiqatda tekshirildi
            'confidence': scan_coverage_pct,
            'scan_coverage_percent': scan_coverage_pct,
            'checked_sentences': checked,
            'word_count': len(words),
            'sentence_count': total_sent,
            'character_count': len(clean),
            'sections': _section_scores(sentences, real_hits),
            'plagiarism_breakdown': {
                'direct_copy': round(max(0.0, plagiarism_pct - paraphrase_pct), 1),
                'paraphrase': paraphrase_pct,
                'mosaic': internal_repeat_pct,
                'self_citation': self_citation_pct,
            },
            'citation_percent': citation_pct,
            'self_citation_percent': self_citation_pct,
            # Faqat haqiqatda bajarilgan modullar (sertifikatda shular ko'rsatiladi)
            'search_modules': executed_labels,
            'executed_module_ids': sorted(executed),
            'enabled_module_ids': sorted(enabled),
            'recommendations': recommendations,
            'sources': sources,
            'fragment_details': [
                {
                    'source_index': s['source_index'],
                    'title': s.get('title', ''),
                    'source': s.get('source', ''),
                    'document_fragment': s.get('document_fragment', ''),
                    'source_fragment': s.get('source_fragment', ''),
                    'similarity': s.get('similarity', 0),
                    'search_module': s.get('search_module', ''),
                }
                for s in sources[:200]
                if float(s.get('similarity') or 0) > 0
            ],
            'annotated_document': _generate_annotated_document(clean, sources),
            'analysis_mode': 'verified_scan',
            'algorithm_version': ALGORITHM_VERSION,
            'real_scan_hits': len(real_hits),
            'verified_plagiarism_pct': plagiarism_pct,
            'verified_hit_count': coverage['verified_hit_count'],
            'paraphrase_hits': real_coverage.get('paraphrase_hits'),
            'web_snippet_hits': real_coverage.get('web_snippet_hits'),
            'opensearch_used': real_coverage.get('opensearch_used'),
            'ai_content_percent': ai_content_pct,
            'llm_model': None,
            'sources_count': len(sources),
            'modules_scanned': len(executed_labels),
            'corpus_documents_indexed': int(real_coverage.get('corpus_documents') or len(corpus)),
            'corpus_hits_found': sum(1 for h in real_hits if h.get('module_id') in CORPUS_MODULE_IDS),
            'index_used': bool(real_coverage.get('index_used')),
            'reordered_hits': sum(1 for h in real_hits if h.get('match_subtype') == 'reordered'),
            'api_works_compared': real_coverage.get('api_works_compared', 0),
            'fulltext_docs_compared': real_coverage.get('fulltext_docs', 0),
            'web_pages_compared': real_coverage.get('web_pages_compared', 0),
            'bypass_attempts': bypass,
            'excluded_bibliography_chars': bibliography_chars,
            'disclaimer_uz': (
                f"Natija faqat haqiqatda topilgan mosliklarga asoslangan. Tekshirilgan bazalar: "
                f"{len(executed_labels)} ta "
                f"({int(real_coverage.get('corpus_documents') or len(corpus))} ta ichki hujjat"
                + (f", {real_coverage.get('api_works_compared')} ta ochiq bazadagi ish"
                   if real_coverage.get('api_works_compared') else '')
                + (f", {real_coverage.get('fulltext_docs')} ta to'liq matn"
                   if real_coverage.get('fulltext_docs') else '')
                + "). "
                f"Hujjatdagi {checked} / {total_sent} gap tekshirildi"
                + (" (ichki baza bilan butun hujjat barmoq izlari bo'yicha solishtirildi; "
                   "kirill/lotin yozuvi, qo'shimchalar va so'z tartibi o'zgarishi hisobga olinadi)"
                   if real_coverage.get('full_scan') else '')
                + ". SI ko'rsatkichi taxminiy."
            ),
        }

        return {
            'plagiarism_percentage': plagiarism_pct,
            'ai_content_percentage': ai_content_pct,
            'originality': originality_pct,
            'report': report,
            'sources': sources,
        }

    def check_file(
        self,
        file_path: str,
        *,
        exclude_article_id=None,
        exclude_author_id=None,
        enabled_modules: list[str] | None = None,
        progress_callback: ProgressCallback | None = None,
        deep: bool = True,
    ) -> dict[str, Any]:
        from apps.articles.antiplagiat_tricks import extract_visible_text
        from apps.services import extract_plain_text_from_file

        # Oq / juda mayda / yashirin matn bo'lsa — faqat ko'rinadigan matn tekshiriladi
        visible, file_tricks = extract_visible_text(file_path)
        text = visible if visible is not None else extract_plain_text_from_file(file_path)
        return self.check_text(
            text,
            exclude_article_id=exclude_article_id,
            exclude_author_id=exclude_author_id,
            enabled_modules=enabled_modules,
            progress_callback=progress_callback,
            deep=deep,
            file_tricks=file_tricks,
        )

    def _empty_report(self, enabled_modules: list[str] | None = None) -> dict[str, Any]:
        enabled = _normalize_enabled_modules(enabled_modules)
        return {
            'plagiarism_percentage': 0.0,
            'ai_content_percentage': 0.0,
            'originality': 100.0,
            'report': {
                'overall_risk': 'low',
                'confidence': 0,
                'word_count': 0,
                'sentence_count': 0,
                'character_count': 0,
                'sections': [],
                'plagiarism_breakdown': {'direct_copy': 0, 'paraphrase': 0, 'mosaic': 0, 'self_citation': 0},
                'citation_percent': 0,
                'self_citation_percent': 0,
                'search_modules': [],
                'executed_module_ids': [],
                'enabled_module_ids': sorted(enabled),
                'recommendations': [],
                'sources': [],
                'analysis_mode': 'insufficient_text',
                'algorithm_version': ALGORITHM_VERSION,
                'llm_model': None,
                'disclaimer_uz': 'Tekshirish uchun matn yetarli emas (kamida ~50 belgi).',
            },
            'sources': [],
        }


def get_antiplagiat_engine() -> AntiplagiatEngine:
    return AntiplagiatEngine()
