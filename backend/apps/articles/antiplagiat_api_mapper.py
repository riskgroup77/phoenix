"""Ichki modul ID ↔ Antiplagiat ApiCorp CheckService kodlari va natija konvertatsiyasi."""
from __future__ import annotations

import re
from typing import Any

from apps.articles.antiplagiat_modules import MODULE_CATALOG

# Aniq moslik (Antiplagiat kodlari kompaniya litsenziyasiga qarab farq qiladi)
EXPLICIT_SERVICE_MAP: dict[str, str] = {
    'elibrary_ru': 'elibrary',
    'elibrary_translations': 'elibrary',
    'wikipedia': 'wikipedia',
    'internet_plus': 'internet',
    'internet_ru_paraphrase': 'internet',
    'internet_en_paraphrase': 'internet',
    'internet_ru_translation': 'internet',
    'internet_en_translation': 'internet',
    'internet_uz': 'internet',
    'springer': 'springer',
    'ieee': 'ieee',
    'ieee_search': 'ieee',
    'ieee_crosslang': 'ieee',
    'crossref': 'crossref',
    'pubmed': 'pubmed',
    'arxiv': 'arxiv',
    'scopus': 'scopus',
    'wos': 'wos',
    'patentlar': 'patents',
    'patent_uspto': 'patents',
    'patent_epo': 'patents',
    'cyberleninka': 'cyberleninka',
    'dissercat': 'dissercat',
    'rsl_full': 'rsl',
    'google_scholar': 'scholar',
}

MODULE_KEYWORDS: dict[str, list[str]] = {
    'openalex': ['openalex'],
    'semantic_scholar': ['semantic'],
    'core_ac': ['core'],
    'doaj': ['doaj'],
    'zenodo': ['zenodo'],
    'jstor': ['jstor'],
    'eric': ['eric'],
    'dblp': ['dblp'],
    'mdpi': ['mdpi'],
    'nature': ['nature'],
    'wiley': ['wiley'],
    'elsevier': ['elsevier', 'sciencedirect'],
    'milliy_reestr': ['collection', 'company'],
    'slib_uz': ['uzbek', 'slib'],
    'ziyonet_uz': ['ziyonet'],
    'lex_uz': ['lex'],
    'chatgpt_ai': ['ai', 'gpt'],
    'gemini_ai': ['ai', 'gemini'],
    'claude_ai': ['ai', 'claude'],
}


def _module_label(module_id: str) -> str:
    for item in MODULE_CATALOG:
        if item['id'] == module_id:
            return item['label']
    return module_id


def _active_module_labels(enabled: set[str]) -> list[str]:
    return [m['label'] for m in MODULE_CATALOG if m['id'] in enabled]


def resolve_api_service_codes(
    enabled_module_ids: list[str] | None,
    available_services: list[dict[str, str]],
) -> list[str] | None:
    """
    Ichki modullarni API CheckService kodlariga aylantiradi.
    Hech narsa topilmasa None qaytaradi (= barcha mavjud modullar).
    """
    if not enabled_module_ids:
        return None

    by_code = {s['code'].lower(): s['code'] for s in available_services if s.get('code')}
    if not by_code:
        return None

    resolved: list[str] = []
    for module_id in enabled_module_ids:
        explicit = EXPLICIT_SERVICE_MAP.get(module_id, '').lower()
        if explicit and explicit in by_code:
            resolved.append(by_code[explicit])
            continue

        keywords = MODULE_KEYWORDS.get(module_id) or [
            part for part in re.split(r'[_\s]+', module_id) if len(part) > 2
        ]
        label_words = [w.lower() for w in re.split(r'[^\w]+', _module_label(module_id)) if len(w) > 3]
        search_terms = keywords + label_words[:4]

        best_code = ''
        best_score = 0
        for service in available_services:
            code = (service.get('code') or '').lower()
            desc = (service.get('description') or '').lower()
            haystack = f'{code} {desc}'
            score = sum(1 for term in search_terms if term.lower() in haystack)
            if score > best_score:
                best_score = score
                best_code = service['code']
        if best_code and best_score > 0:
            resolved.append(best_code)

    unique = list(dict.fromkeys(resolved))
    return unique or None


def convert_api_report_to_phonix(
    *,
    report_view: dict[str, Any],
    check_status: dict[str, Any],
    enabled_module_ids: list[str] | None,
    company_url: str = '',
    external_doc_id: int | None = None,
) -> dict[str, Any]:
    """ApiCorp natijasini platforma formatiga o'tkazadi."""
    enabled = set(enabled_module_ids or [])
    active_labels = _active_module_labels(enabled) if enabled else []

    score = report_view.get('score') or check_status.get('score') or {}
    plagiarism_pct = round(float(score.get('plagiarism') or 0), 2)
    citation_pct = round(float(score.get('legal') or 0), 2)
    self_cite_pct = round(float(score.get('self_cite') or 0), 2)
    originality_pct = round(
        float(score.get('originality') or max(0.0, 100.0 - plagiarism_pct)),
        2,
    )

    sources: list[dict[str, Any]] = []
    modules_scanned: list[str] = []
    idx = 1
    for svc in report_view.get('service_results') or []:
        module_name = svc.get('service_name') or svc.get('collection') or 'Antiplagiat moduli'
        modules_scanned.append(str(module_name))
        for src in svc.get('sources') or []:
            sim = float(src.get('similarity') or 0)
            if sim <= 0:
                continue
            url = str(src.get('url') or '')
            title = str(src.get('name') or 'Manba')
            sources.append({
                'source_index': idx,
                'title': title,
                'source': url or title,
                'snippet': title,
                'similarity': round(sim, 2),
                'search_module': module_name,
                'published_at': '',
                'document_fragment': '',
                'source_fragment': title,
            })
            idx += 1

    stats = report_view.get('stats') or {}
    summary = report_view.get('summary') or {}
    company = (company_url or '').rstrip('/')
    report_links = {}
    if company and summary.get('readonly_report_web_id'):
        report_links['readonly_web'] = f"{company}/report/{summary['readonly_report_web_id']}"
    if company and summary.get('report_web_id'):
        report_links['full_web'] = f"{company}/report/{summary['report_web_id']}"

    overall_risk = 'high' if plagiarism_pct > 50 else 'medium' if plagiarism_pct > 25 else 'low'
    recommendations: list[str] = []
    if plagiarism_pct > 40:
        recommendations.append(
            "Antiplagiat tizimi bo'yicha matnda o'xshashliklar aniqlandi. Manbalarni to'g'ri iqtibos qiling."
        )
    if summary.get('is_suspicious'):
        recommendations.append('Hujjat shubhali deb belgilangan — qo\'shimcha tekshiruv tavsiya etiladi.')
    if plagiarism_pct < 20:
        recommendations.append('Originallik darajasi yuqori.')

    if not active_labels and modules_scanned:
        active_labels = modules_scanned
    elif not active_labels:
        active_labels = [m['label'] for m in MODULE_CATALOG[: min(20, len(MODULE_CATALOG))]]

    report = {
        'overall_risk': overall_risk,
        'confidence': 92,
        'word_count': 0,
        'sentence_count': int(stats.get('sentence_count') or 0),
        'character_count': int(stats.get('text_size') or 0),
        'sections': [],
        'plagiarism_breakdown': {
            'direct_copy': round(plagiarism_pct * 0.55, 1),
            'paraphrase': round(plagiarism_pct * 0.35, 1),
            'mosaic': round(plagiarism_pct * 0.10, 1),
            'self_citation': self_cite_pct,
        },
        'citation_percent': citation_pct,
        'self_citation_percent': self_cite_pct,
        'search_modules': active_labels,
        'enabled_module_ids': sorted(enabled) if enabled else [],
        'recommendations': recommendations,
        'sources': sources,
        'fragment_details': sources[:200],
        'annotated_document': report_view.get('document_text') or '',
        'analysis_mode': 'external_apicorp',
        'llm_model': None,
        'sources_count': len(sources),
        'modules_scanned': len(modules_scanned) or len(active_labels),
        'external_provider': 'antiplagiat_apicorp',
        'external_doc_id': external_doc_id,
        'external_report_links': report_links,
        'is_suspicious': bool(summary.get('is_suspicious') or check_status.get('is_suspicious')),
        'disclaimer_uz': (
            'Natija Antiplagiat ApiCorp (antiplag.uz) tizimi orqali olingan. '
            f'Tekshirilgan modullar: {len(modules_scanned) or len(active_labels)} ta.'
        ),
    }

    return {
        'plagiarism_percentage': plagiarism_pct,
        'ai_content_percentage': 0.0,
        'originality': originality_pct,
        'report': report,
        'sources': sources,
    }
