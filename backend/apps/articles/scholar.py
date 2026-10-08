"""
Google Scholar va qidiruv tizimlari uchun ochiq maqola sahifasi (server tomonida tayyor HTML).

Sayt HashRouter (/#/...) bilan ishlaydi — qidiruv robotlari bunday sahifalarni yaxshi indekslamaydi.
Shuning uchun nashr etilgan har bir maqola uchun /p/article/<id>/ manzilida Highwire Press
(citation_*) meta-teglari, Dublin Core, Open Graph va JSON-LD bilan oddiy HTML beriladi.
nginx'da /p/, /sitemap.xml va /robots.txt backend'ga yo'naltiriladi (docs/OPERATIONS.md).
"""
from __future__ import annotations

import json

from django.conf import settings
from django.http import FileResponse, Http404, HttpResponse
from django.urls import reverse
from django.utils import timezone
from django.utils.html import escape
from django.views.decorators.cache import cache_page
from django.views.decorators.http import require_GET

from config.demo import demo_q

from .antiplagiat_utils import is_standalone_antiplagiat
from .models import Article


def _site() -> str:
    return (getattr(settings, 'PUBLIC_SITE_URL', '') or getattr(settings, 'FRONTEND_BASE_URL', '')).rstrip('/')


def _published_article(pk) -> Article:
    article = (
        Article.objects.select_related('journal', 'author', 'issue')
        .prefetch_related('co_authors')
        .filter(pk=pk, status='Published')
        .first()
    )
    from config.demo import is_demo_article

    # Demo (namuna) maqolalar Google Scholar'ga chiqmaydi — soxta ilmiy yozuv indekslanmasin
    if article is None or is_standalone_antiplagiat(article) or is_demo_article(article):
        raise Http404('Maqola topilmadi')
    return article


def article_authors(article: Article) -> list[str]:
    raw = (article.submitted_author_name or '').strip()
    if raw:
        parts = [p.strip() for p in raw.replace(';', ',').split(',') if p.strip()]
        if parts:
            return parts
    names = []
    if article.author:
        names.append(article.author.get_full_name())
    for co in article.co_authors.all():
        full = co.get_full_name()
        if full and full not in names:
            names.append(full)
    return names


def publication_date(article: Article):
    event = article.status_events.filter(to_status='Published').order_by('-created_at').first()
    if event:
        return timezone.localtime(event.created_at).date()
    if article.issue_id and article.issue and article.issue.publication_date:
        return article.issue.publication_date
    return timezone.localtime(article.submission_date).date() if article.submission_date else None


def _expose_pdf(article: Article) -> bool:
    return bool(getattr(settings, 'SCHOLAR_EXPOSE_PDF', True) and article.final_pdf_path)


def _meta(name: str, content) -> str:
    if content in (None, ''):
        return ''
    return f'<meta name="{escape(name)}" content="{escape(str(content))}">'


_PAGE_TEMPLATE = """<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{PAGE_TITLE}}</title>
{{META}}
<script type="application/ld+json">{{JSON_LD}}</script>
<style>
:root{--lapis:#1f3f8f;--firuza:#0b6f74;--bg:#f5f7fb;--text:#172033;--muted:#55607a;--border:#e3e8f2}
*{box-sizing:border-box}body{margin:0;font-family:Onest,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--text);line-height:1.6}
header{background:var(--lapis);color:#fff;padding:18px 16px}header a{color:#fff;text-decoration:none;font-weight:700}
main{max-width:860px;margin:0 auto;padding:28px 16px 48px}
.card{background:#fff;border:1px solid var(--border);border-radius:14px;padding:24px}
h1{font-size:clamp(22px,4vw,30px);line-height:1.25;margin:0 0 12px}
.meta{color:var(--muted);font-size:15px;margin:0 0 6px}.meta b{color:var(--text)}
h2{font-size:17px;margin:24px 0 8px}
.kw{display:inline-block;background:#e6f4f4;color:var(--firuza);border-radius:999px;padding:3px 10px;margin:0 6px 6px 0;font-size:13px;font-weight:600}
.btn{display:inline-block;background:var(--lapis);color:#fff;border-radius:10px;padding:10px 16px;text-decoration:none;font-weight:600;margin:6px 8px 0 0}
.btn-ghost{background:#fff;color:var(--lapis);border:1px solid var(--border)}
footer{text-align:center;color:var(--muted);font-size:13px;padding:0 16px 32px}
</style>
</head>
<body>
<header><a href="{{SITE}}">Phoenix — Ilmiy nashrlar markazi</a></header>
<main>
<article class="card">
<h1>{{TITLE}}</h1>
<p class="meta"><b>Mualliflar:</b> {{AUTHORS}}</p>
<p class="meta"><b>Jurnal:</b> {{JOURNAL}}{{ISSN}}</p>
<p class="meta"><b>Nashr sanasi:</b> {{DATE}}</p>
{{DOI}}
{{UDK}}
<h2>Annotatsiya</h2>
<p>{{ABSTRACT}}</p>
{{KEYWORDS}}
<p>{{LINKS}}</p>
</article>
</main>
<footer>© {{YEAR}} Phoenix Ilmiy nashrlar markazi · ilmiyfaoliyat.uz</footer>
</body>
</html>"""


@require_GET
@cache_page(60 * 30)
def scholar_article_page(request, pk):
    article = _published_article(pk)
    site = _site()
    journal = article.journal
    authors = article_authors(article)
    pub_date = publication_date(article)
    page_url = request.build_absolute_uri(reverse('scholar_article_page', args=[article.pk]))
    app_url = f'{site}/#/public/article/{article.pk}'
    pdf_url = request.build_absolute_uri(reverse('scholar_article_pdf', args=[article.pk])) if _expose_pdf(article) else ''
    doi = (article.doi or '').strip()
    doi_url = doi if doi.startswith('http') else (f'https://doi.org/{doi}' if doi else '')
    keywords = [str(k).strip() for k in (article.keywords or []) if str(k).strip()] if isinstance(article.keywords, list) else []
    abstract = (article.abstract or '').strip()

    meta = [
        _meta('citation_title', article.title),
        *[_meta('citation_author', a) for a in authors],
        _meta('citation_publication_date', pub_date.strftime('%Y/%m/%d') if pub_date else ''),
        _meta('citation_online_date', pub_date.strftime('%Y/%m/%d') if pub_date else ''),
        _meta('citation_journal_title', getattr(journal, 'name', '')),
        _meta('citation_issn', getattr(journal, 'issn', '')),
        _meta('citation_issue', getattr(article.issue, 'issue_number', '') if article.issue_id else ''),
        _meta('citation_doi', doi.replace('https://doi.org/', '')),
        _meta('citation_abstract_html_url', page_url),
        _meta('citation_pdf_url', pdf_url),
        _meta('citation_publisher', 'Phoenix Ilmiy nashrlar markazi'),
        _meta('citation_keywords', '; '.join(keywords)),
        _meta('citation_language', 'uz'),
        _meta('DC.title', article.title),
        *[_meta('DC.creator', a) for a in authors],
        _meta('DC.date', pub_date.isoformat() if pub_date else ''),
        _meta('DC.identifier', doi_url or page_url),
        _meta('description', abstract[:300]),
        '<meta property="og:type" content="article">',
        '<meta property="og:title" content="%s">' % escape(article.title),
        '<meta property="og:description" content="%s">' % escape(abstract[:300]),
        '<meta property="og:url" content="%s">' % escape(page_url),
        '<link rel="canonical" href="%s">' % escape(page_url),
    ]
    json_ld = {
        '@context': 'https://schema.org',
        '@type': 'ScholarlyArticle',
        'headline': article.title[:110],
        'name': article.title,
        'author': [{'@type': 'Person', 'name': a} for a in authors],
        'datePublished': pub_date.isoformat() if pub_date else None,
        'isPartOf': {'@type': 'Periodical', 'name': getattr(journal, 'name', ''), 'issn': getattr(journal, 'issn', '')},
        'abstract': abstract,
        'keywords': ', '.join(keywords),
        'url': page_url,
    }
    if doi_url:
        json_ld['sameAs'] = doi_url

    authors_html = ', '.join(escape(a) for a in authors) or '—'
    kw_html = ''.join('<span class="kw">%s</span>' % escape(k) for k in keywords)
    links = ['<a class="btn" href="%s">Saytda ochish</a>' % escape(app_url)]
    if pdf_url:
        links.append('<a class="btn btn-ghost" href="%s">PDF yuklab olish</a>' % escape(pdf_url))
    if article.publication_url:
        links.append('<a class="btn btn-ghost" href="%s" rel="noopener">Jurnal sahifasi</a>' % escape(article.publication_url))

    # Eski Python versiyalari bilan mos bo'lishi uchun HTML oddiy o'rniga qo'yish bilan yig'iladi
    values = {
        'TITLE': escape(article.title),
        'PAGE_TITLE': '%s — %s' % (escape(article.title), escape(getattr(journal, 'name', '') or 'Phoenix')),
        'META': '\n'.join(m for m in meta if m),
        'JSON_LD': json.dumps(json_ld, ensure_ascii=False).replace('</', '<\\/'),
        'SITE': escape(site or '/'),
        'AUTHORS': authors_html,
        'JOURNAL': escape(getattr(journal, 'name', '') or '—'),
        'ISSN': (' · ISSN ' + escape(journal.issn)) if journal and journal.issn else '',
        'DATE': pub_date.strftime('%d.%m.%Y') if pub_date else '—',
        'DOI': ('<p class="meta"><b>DOI:</b> <a href="%s">%s</a></p>' % (escape(doi_url), escape(doi))) if doi else '',
        'UDK': ('<p class="meta"><b>UDK:</b> %s</p>' % escape(article.udk_code)) if article.udk_code else '',
        'ABSTRACT': escape(abstract) or '—',
        'KEYWORDS': ('<h2>Kalit so‘zlar</h2><p>%s</p>' % kw_html) if kw_html else '',
        'LINKS': ''.join(links),
        'YEAR': str(timezone.localtime().year),
    }
    html = _PAGE_TEMPLATE
    for key, val in values.items():
        html = html.replace('{{%s}}' % key, val)
    return HttpResponse(html, content_type='text/html; charset=utf-8')


@require_GET
def scholar_article_pdf(request, pk):
    """Nashr etilgan maqolaning PDF fayli (citation_pdf_url). SCHOLAR_EXPOSE_PDF=False bo'lsa yopiq."""
    article = _published_article(pk)
    if not _expose_pdf(article):
        raise Http404('PDF mavjud emas')
    try:
        handle = article.final_pdf_path.open('rb')
    except Exception:
        raise Http404('PDF topilmadi')
    filename = f'article-{str(article.pk)[:8]}.pdf'
    response = FileResponse(handle, content_type='application/pdf', as_attachment=False, filename=filename)
    response['Cache-Control'] = 'public, max-age=86400'
    return response


@require_GET
@cache_page(60 * 60)
def sitemap_xml(request):
    rows = []
    articles = (
        Article.objects.filter(status='Published')
        .exclude(title__istartswith='plagiarism check')
        .exclude(demo_q('author__') | demo_q('journal__journal_admin__'))
        .only('id', 'submission_date')
        .order_by('-submission_date')[:5000]
    )
    for a in articles:
        loc = request.build_absolute_uri(reverse('scholar_article_page', args=[a.pk]))
        lastmod = timezone.localtime(a.submission_date).date().isoformat() if a.submission_date else ''
        lastmod_xml = '<lastmod>%s</lastmod>' % lastmod if lastmod else ''
        rows.append('<url><loc>%s</loc>%s</url>' % (escape(loc), lastmod_xml))
    site = _site()
    if site:
        rows.insert(0, '<url><loc>%s/</loc></url>' % escape(site))
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        + ''.join(rows)
        + '</urlset>'
    )
    return HttpResponse(xml, content_type='application/xml; charset=utf-8')


@require_GET
def robots_txt(request):
    sitemap = request.build_absolute_uri(reverse('sitemap_xml'))
    body = '\n'.join([
        'User-agent: *',
        'Allow: /p/',
        'Disallow: /api/',
        'Disallow: /admin/',
        'Disallow: /media/',
        f'Sitemap: {sitemap}',
        '',
    ])
    return HttpResponse(body, content_type='text/plain; charset=utf-8')
