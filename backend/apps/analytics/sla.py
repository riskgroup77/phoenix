"""
Taqrizchi navbati va muddatlar (SLA).

Taqrizchilar umumiy navbat bilan ishlaydi: "Ko'rib chiqilmoqda" (QabulQilingan) holatidagi maqolalar,
to'langan DOI/UDK so'rovlari, tarjima va maqola namunasi buyurtmalari. Har bir ish turi uchun
muddat (kun) settings.REVIEW_SLA_DAYS da; muddat ish taqrizchiga kelgan paytdan hisoblanadi.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from django.conf import settings
from django.db.models import Q
from django.utils import timezone

DEFAULT_SLA_DAYS = {
    'article': 7,
    'article_fast': 3,
    'doi': 3,
    'udk': 2,
    'translation': 5,
    'sample': 7,
    'peer_review': 14,
}

KIND_LABELS = {
    'article': 'Maqola taqrizi',
    'doi': "DOI so'rovi",
    'udk': "UDK so'rovi",
    'translation': 'Tarjima',
    'sample': 'Maqola namunasi',
    'peer_review': 'Taqriz (tayinlangan)',
}

DUE_SOON_HOURS = 24


def sla_days(kind: str) -> int:
    custom = getattr(settings, 'REVIEW_SLA_DAYS', None) or {}
    try:
        return int(custom.get(kind, DEFAULT_SLA_DAYS.get(kind, 7)))
    except (TypeError, ValueError):
        return DEFAULT_SLA_DAYS.get(kind, 7)


@dataclass
class WorkItem:
    kind: str
    id: str
    title: str
    link: str
    started_at: datetime
    due_at: datetime
    fast_track: bool = False
    assignee_id: str | None = None

    def as_dict(self, now: datetime) -> dict:
        left = (self.due_at - now).total_seconds()
        return {
            'kind': self.kind,
            'kind_label': KIND_LABELS.get(self.kind, self.kind),
            'id': self.id,
            'title': self.title,
            'link': self.link,
            'started_at': self.started_at.isoformat(),
            'due_at': self.due_at.isoformat(),
            'hours_left': round(left / 3600, 1),
            'overdue': left < 0,
            'due_soon': 0 <= left <= DUE_SOON_HOURS * 3600,
            'fast_track': self.fast_track,
        }


def _article_queue_entered(article_ids) -> dict:
    """Maqola oxirgi marta "QabulQilingan" holatiga o'tgan vaqt (holat tarixidan)."""
    from apps.articles.models import ArticleStatusEvent

    entered = {}
    for row in (
        ArticleStatusEvent.objects.filter(article_id__in=article_ids, to_status='QabulQilingan')
        .order_by('created_at')
        .values('article_id', 'created_at')
    ):
        entered[row['article_id']] = row['created_at']
    return entered


def _standalone_exclusion() -> Q:
    return (
        Q(title__istartswith='plagiarism check')
        | Q(abstract__icontains='tekshiruv uchun yuborilgan')
        | Q(abstract__icontains='hujjat turi:')
    )


def reviewer_queue(reviewer=None) -> list[WorkItem]:
    """Taqrizchilarning ochiq ishlari. reviewer berilsa — tayinlangan taqrizlar ham qo'shiladi."""
    from apps.articles.models import Article, ArticleSampleRequest, DoiRequest
    from apps.translations.models import TranslationRequest
    from apps.udc.models import UdkRequest

    items: list[WorkItem] = []

    articles = list(
        Article.objects.filter(status='QabulQilingan')
        .exclude(_standalone_exclusion())
        .exclude(title__istartswith='[KITOB]')
        .only('id', 'title', 'submission_date', 'fast_track')
    )
    entered = _article_queue_entered([a.id for a in articles])
    for a in articles:
        start = entered.get(a.id) or a.submission_date
        kind_days = sla_days('article_fast' if a.fast_track else 'article')
        items.append(WorkItem('article', str(a.id), a.title, f'/articles/{a.id}', start,
                              start + timedelta(days=kind_days), fast_track=a.fast_track))

    for r in DoiRequest.objects.filter(status='submitted').select_related('transaction'):
        start = (r.transaction.completed_at if r.transaction and r.transaction.completed_at else r.created_at)
        title = f'{r.author_last_name} {r.author_first_name}'.strip() or "DOI so'rovi"
        items.append(WorkItem('doi', str(r.id), title, '/doi-requests', start, start + timedelta(days=sla_days('doi'))))

    for r in UdkRequest.objects.filter(status='submitted').select_related('transaction'):
        start = (r.transaction.completed_at if r.transaction and r.transaction.completed_at else r.created_at)
        items.append(WorkItem('udk', str(r.id), r.title or "UDK so'rovi", '/udk-requests', start,
                              start + timedelta(days=sla_days('udk'))))

    for t in TranslationRequest.objects.filter(status__in=('Yangi', 'Jarayonda')):
        start = t.submission_date
        items.append(WorkItem('translation', str(t.id), t.title, f'/translations/{t.id}', start,
                              start + timedelta(days=sla_days('translation')),
                              assignee_id=str(t.reviewer_id) if t.reviewer_id else None))

    for s in ArticleSampleRequest.objects.filter(status__in=('submitted', 'in_progress')):
        start = s.created_at
        items.append(WorkItem('sample', str(s.id), s.topic, '/article-sample-requests', start,
                              start + timedelta(days=sla_days('sample'))))

    if reviewer is not None:
        from apps.reviews.models import PeerReview

        for pr in PeerReview.objects.filter(reviewer=reviewer, status__in=('pending', 'accepted', 'in_progress')).select_related('article'):
            start = pr.assigned_at
            due = pr.deadline or (start + timedelta(days=sla_days('peer_review')))
            items.append(WorkItem('peer_review', str(pr.id), pr.article.title, f'/articles/{pr.article_id}', start, due,
                                  assignee_id=str(reviewer.pk)))

    items.sort(key=lambda it: it.due_at)
    return items


def _avg_days(pairs) -> float | None:
    durations = [(end - start).total_seconds() / 86400 for start, end in pairs if start and end and end >= start]
    if not durations:
        return None
    return round(sum(durations) / len(durations), 1)


def processing_stats(days: int = 90) -> dict:
    """Oxirgi `days` kun ichida yakunlangan ishlar bo'yicha o'rtacha bajarilish vaqti (kun)."""
    from apps.articles.models import ArticleStatusEvent, DoiRequest
    from apps.translations.models import TranslationRequest
    from apps.udc.models import UdkRequest

    since = timezone.now() - timedelta(days=days)

    # Maqola: QabulQilingan ga kirgan vaqtdan keyingi holatgacha
    article_pairs = []
    reviewer_done: dict = {}
    events = list(
        ArticleStatusEvent.objects.filter(created_at__gte=since - timedelta(days=60))
        .order_by('article_id', 'created_at')
        .values('article_id', 'from_status', 'to_status', 'created_at', 'actor_id', 'actor_role')
    )
    entered_at = {}
    for ev in events:
        if ev['to_status'] == 'QabulQilingan':
            entered_at[ev['article_id']] = ev['created_at']
        elif ev['from_status'] == 'QabulQilingan' and ev['created_at'] >= since:
            start = entered_at.pop(ev['article_id'], None)
            if start:
                article_pairs.append((start, ev['created_at']))
                if ev['actor_id'] and ev['actor_role'] == 'reviewer':
                    reviewer_done.setdefault(ev['actor_id'], []).append((start, ev['created_at']))

    doi_pairs = [
        ((r.transaction.completed_at if r.transaction and r.transaction.completed_at else r.created_at), r.completed_at)
        for r in DoiRequest.objects.filter(status='completed', completed_at__gte=since).select_related('transaction')
    ]
    udk_pairs = [
        ((r.transaction.completed_at if r.transaction and r.transaction.completed_at else r.created_at), r.completed_at)
        for r in UdkRequest.objects.filter(status='completed', completed_at__gte=since).select_related('transaction')
    ]
    tr_rows = list(
        TranslationRequest.objects.filter(status='Bajarildi', completion_date__gte=since)
        .values('reviewer_id', 'submission_date', 'completion_date')
    )
    for row in tr_rows:
        if row['reviewer_id']:
            reviewer_done.setdefault(row['reviewer_id'], []).append((row['submission_date'], row['completion_date']))

    return {
        'period_days': days,
        'by_kind': [
            {'kind': 'article', 'label': KIND_LABELS['article'], 'completed': len(article_pairs), 'avg_days': _avg_days(article_pairs)},
            {'kind': 'doi', 'label': KIND_LABELS['doi'], 'completed': len(doi_pairs), 'avg_days': _avg_days(doi_pairs)},
            {'kind': 'udk', 'label': KIND_LABELS['udk'], 'completed': len(udk_pairs), 'avg_days': _avg_days(udk_pairs)},
            {
                'kind': 'translation',
                'label': KIND_LABELS['translation'],
                'completed': len(tr_rows),
                'avg_days': _avg_days([(r['submission_date'], r['completion_date']) for r in tr_rows]),
            },
        ],
        'reviewer_done': reviewer_done,
    }
