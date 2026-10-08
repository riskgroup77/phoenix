"""
Analitika (admin), taqrizchi navbati (SLA), global qidiruv (Ctrl+K) va ochiq bosh sahifa ma'lumotlari.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Count, Q, Sum
from django.db.models.functions import Coalesce, TruncMonth
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from config.demo import demo_q

from .sla import processing_stats, reviewer_queue

User = get_user_model()

MONTHS_UZ = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek']
IN_PROGRESS_STATUSES = ('Yangi', 'WithEditor', 'QabulQilingan', 'WritingInProgress', 'Revision',
                        'Accepted', 'NashrgaYuborilgan', 'PlagiarismReview')


def _role(user) -> str:
    role = getattr(user, 'role', '') or ''
    if getattr(user, 'is_superuser', False) and not role:
        return 'super_admin'
    return role.strip().lower() if isinstance(role, str) else ''


def _standalone_q() -> Q:
    return (
        Q(title__istartswith='plagiarism check')
        | Q(abstract__icontains='tekshiruv uchun yuborilgan')
        | Q(abstract__icontains='hujjat turi:')
    )


def _month_keys(months: int):
    """Oxirgi `months` oy: [(yil, oy), ...] eskidan yangiga."""
    now = timezone.localtime()
    y, m = now.year, now.month
    keys = []
    for _ in range(months):
        keys.append((y, m))
        m -= 1
        if m == 0:
            m, y = 12, y - 1
    return list(reversed(keys))


def _key(dt):
    if dt is None:
        return None
    if timezone.is_aware(dt):
        dt = timezone.localtime(dt)
    return (dt.year, dt.month)


def _money(value) -> float:
    if value is None:
        return 0.0
    return float(value if not isinstance(value, Decimal) else value)


# ---------------------------------------------------------------- Analitika

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def overview(request):
    """
    Bosh admin: to'liq; buxgalter: moliya; jurnal admini: o'z jurnallari bo'yicha maqolalar.
    ?months=12 (3..24)
    """
    from apps.articles.models import Article, ArticleStatusEvent
    from apps.journals.models import Journal
    from apps.payments.labels import service_label
    from apps.payments.models import Transaction

    role = _role(request.user)
    if role not in ('super_admin', 'accountant', 'journal_admin'):
        return Response({'detail': "Ruxsat yo'q."}, status=status.HTTP_403_FORBIDDEN)
    try:
        months = max(3, min(24, int(request.query_params.get('months', 12))))
    except (TypeError, ValueError):
        months = 12

    keys = _month_keys(months)
    y0, m0 = keys[0]
    period_start = timezone.make_aware(datetime(y0, m0, 1))
    data = {
        'role_scope': role,
        'months': [{'key': f'{y}-{m:02d}', 'label': f'{MONTHS_UZ[m - 1]} {str(y)[2:]}'} for y, m in keys],
        'generated_at': timezone.now().isoformat(),
    }

    # ---- Moliya (bosh admin, buxgalter)
    if role in ('super_admin', 'accountant'):
        # Tushum to'langan sana bo'yicha (completed_at; eski yozuvlarda bo'lmasa created_at)
        tx = (
            Transaction.objects.filter(status='completed')
            .exclude(service_type='top_up')
            .exclude(demo_q('user__'))  # demo to'lovlar tushumga qo'shilmaydi
            .annotate(paid_at=Coalesce('completed_at', 'created_at'))
        )
        tx_period = tx.filter(paid_at__gte=period_start)
        monthly = defaultdict(lambda: {'total': 0.0, 'count': 0})
        for row in tx_period.annotate(mon=TruncMonth('paid_at')).values('mon').annotate(total=Sum('amount'), cnt=Count('id')):
            k = _key(row['mon'])
            monthly[k]['total'] += _money(row['total'])
            monthly[k]['count'] += row['cnt']
        series = [{'key': f'{y}-{m:02d}', 'total': monthly[(y, m)]['total'], 'count': monthly[(y, m)]['count']} for y, m in keys]
        this_month = series[-1]['total'] if series else 0
        prev_month = series[-2]['total'] if len(series) > 1 else 0
        change = None
        if prev_month > 0:
            change = round((this_month - prev_month) / prev_month * 100, 1)
        by_service = [
            {'service_type': r['service_type'], 'label': service_label(r['service_type']),
             'total': _money(r['total']), 'count': r['cnt']}
            for r in tx_period.values('service_type').annotate(total=Sum('amount'), cnt=Count('id')).order_by('-total')
        ]
        total_period = sum(s['total'] for s in series)
        paid_count = sum(s['count'] for s in series)
        data['revenue'] = {
            'total_period': total_period,
            'this_month': this_month,
            'prev_month': prev_month,
            'change_pct': change,
            'average_check': round(total_period / paid_count) if paid_count else 0,
            'monthly': series,
            'by_service': by_service,
            'pending_count': Transaction.objects.filter(status='pending', created_at__gte=period_start).count(),
            'failed_count': Transaction.objects.filter(status__in=('failed', 'cancelled'), created_at__gte=period_start).count(),
        }

    # ---- Maqolalar oqimi (bosh admin, jurnal admini)
    if role in ('super_admin', 'journal_admin'):
        articles = Article.objects.exclude(_standalone_q()).exclude(status='Draft')
        journals = Journal.objects.all()
        if role == 'journal_admin':
            articles = articles.filter(journal__journal_admin=request.user)
            journals = journals.filter(journal_admin=request.user)
        art_period = articles.filter(submission_date__gte=period_start)

        flow = defaultdict(lambda: {'submitted': 0, 'published': 0, 'rejected': 0})
        for row in art_period.annotate(mon=TruncMonth('submission_date')).values('mon').annotate(cnt=Count('id')):
            flow[_key(row['mon'])]['submitted'] += row['cnt']

        events = ArticleStatusEvent.objects.filter(
            created_at__gte=period_start, to_status__in=('Published', 'Rejected'), article__in=articles,
        )
        for row in events.annotate(mon=TruncMonth('created_at')).values('mon', 'to_status').annotate(cnt=Count('id')):
            flow[_key(row['mon'])]['published' if row['to_status'] == 'Published' else 'rejected'] += row['cnt']

        flow_series = [{'key': f'{y}-{m:02d}', **flow[(y, m)]} for y, m in keys]
        published_total = sum(f['published'] for f in flow_series)
        rejected_total = sum(f['rejected'] for f in flow_series)
        decided = published_total + rejected_total

        # Yuborilgandan nashrgacha o'rtacha kun
        pub_events = events.filter(to_status='Published').select_related('article').only('created_at', 'article__submission_date')
        durations = [
            (ev.created_at - ev.article.submission_date).total_seconds() / 86400
            for ev in pub_events if ev.article.submission_date and ev.created_at >= ev.article.submission_date
        ]

        per_journal = []
        status_counts = defaultdict(lambda: defaultdict(int))
        for row in art_period.values('journal_id', 'status').annotate(cnt=Count('id')):
            status_counts[row['journal_id']][row['status']] += row['cnt']
        revenue_by_journal = {}
        if role == 'super_admin':
            for row in (
                Transaction.objects.filter(status='completed', service_type='publication_fee')
                .exclude(demo_q('user__'))
                .annotate(paid_at=Coalesce('completed_at', 'created_at'))
                .filter(paid_at__gte=period_start)
                .values('article__journal_id').annotate(total=Sum('amount'))
            ):
                revenue_by_journal[row['article__journal_id']] = _money(row['total'])
        for j in journals.only('id', 'name'):
            sc = status_counts.get(j.id, {})
            submitted = sum(sc.values())
            pub = sc.get('Published', 0)
            rej = sc.get('Rejected', 0)
            per_journal.append({
                'id': str(j.id),
                'name': j.name,
                'submitted': submitted,
                'published': pub,
                'rejected': rej,
                'in_progress': sum(v for k, v in sc.items() if k in IN_PROGRESS_STATUSES),
                'rejection_rate': round(rej / (pub + rej) * 100, 1) if (pub + rej) else None,
                'revenue': revenue_by_journal.get(j.id, 0.0),
            })
        per_journal.sort(key=lambda r: (r['submitted'], r['published']), reverse=True)

        by_status = {row['status']: row['cnt'] for row in articles.values('status').annotate(cnt=Count('id'))}
        data['articles'] = {
            'monthly': flow_series,
            'submitted_period': sum(f['submitted'] for f in flow_series),
            'published_period': published_total,
            'rejected_period': rejected_total,
            'rejection_rate': round(rejected_total / decided * 100, 1) if decided else None,
            'avg_days_to_publish': round(sum(durations) / len(durations), 1) if durations else None,
            'in_progress_now': sum(by_status.get(s, 0) for s in IN_PROGRESS_STATUSES),
            'by_status': by_status,
            'journals': per_journal[:15],
        }

    # ---- Foydalanuvchilar (bosh admin)
    if role == 'super_admin':
        month_start = timezone.make_aware(datetime(keys[-1][0], keys[-1][1], 1))
        signups = defaultdict(int)
        for row in User.objects.filter(date_joined__gte=period_start).annotate(mon=TruncMonth('date_joined')).values('mon').annotate(cnt=Count('id')):
            signups[_key(row['mon'])] += row['cnt']
        data['users'] = {
            'total': User.objects.count(),
            'authors': User.objects.filter(role='author').count(),
            'new_this_month': User.objects.filter(date_joined__gte=month_start).count(),
            'monthly_signups': [{'key': f'{y}-{m:02d}', 'count': signups[(y, m)]} for y, m in keys],
        }

    return Response(data)


# ---------------------------------------------------------------- Taqrizchi navbati

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def workload(request):
    """
    Taqrizchi: o'z ishchi navbati (muddatlar bilan). Bosh admin/operator: navbat + taqrizchilar kesimi.
    """
    role = _role(request.user)
    if role not in ('reviewer', 'super_admin', 'operator'):
        return Response({'detail': "Ruxsat yo'q."}, status=status.HTTP_403_FORBIDDEN)
    now = timezone.now()
    items = reviewer_queue(request.user if role == 'reviewer' else None)
    rows = [it.as_dict(now) for it in items]
    stats = processing_stats(90)
    reviewer_done = stats.pop('reviewer_done')
    payload = {
        'items': rows,
        'counts': {
            'total': len(rows),
            'overdue': sum(1 for r in rows if r['overdue']),
            'due_soon': sum(1 for r in rows if r['due_soon']),
        },
        'processing': stats,
    }
    if role in ('super_admin', 'operator'):
        reviewers = []
        open_translations = defaultdict(int)
        for it in items:
            if it.kind == 'translation' and it.assignee_id:
                open_translations[it.assignee_id] += 1
        for u in User.objects.filter(role='reviewer', is_active=True).only('id', 'first_name', 'last_name', 'last_login'):
            done = reviewer_done.get(u.id, [])
            durations = [(e - s).total_seconds() / 86400 for s, e in done if s and e and e >= s]
            reviewers.append({
                'id': str(u.id),
                'name': f'{u.last_name} {u.first_name}'.strip(),
                'completed_90d': len(done),
                'avg_days': round(sum(durations) / len(durations), 1) if durations else None,
                'open_assigned': open_translations.get(str(u.id), 0),
                'last_login': u.last_login.isoformat() if u.last_login else None,
            })
        reviewers.sort(key=lambda r: r['completed_90d'], reverse=True)
        payload['reviewers'] = reviewers
    return Response(payload)


# ---------------------------------------------------------------- Global qidiruv

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def global_search(request):
    """Ctrl+K: maqolalar (rolga mos), jurnallar, foydalanuvchilar (faqat bosh admin/operator)."""
    from apps.articles.models import Article
    from apps.journals.models import Journal

    q = (request.query_params.get('q') or '').strip()
    if len(q) < 2:
        return Response({'query': q, 'articles': [], 'journals': [], 'users': []})
    q = q[:100]
    user = request.user
    role = _role(user)

    articles = Article.objects.select_related('journal')
    if role in ('super_admin', 'operator', 'accountant'):
        pass
    elif role == 'journal_admin':
        articles = articles.filter(journal__journal_admin=user)
    elif role == 'reviewer':
        articles = articles.filter(status='QabulQilingan')
    else:
        articles = articles.filter(Q(author=user) | Q(co_authors=user)).distinct()
    art_filter = Q(title__icontains=q) | Q(doi__icontains=q) | Q(udk_code__icontains=q)
    if role in ('super_admin', 'operator', 'journal_admin', 'accountant'):
        art_filter |= Q(author__last_name__icontains=q) | Q(author__first_name__icontains=q) | Q(submitted_author_name__icontains=q)
    article_rows = [
        {
            'id': str(a.id),
            'title': a.title,
            'status': a.status,
            'journal': getattr(a.journal, 'name', '') or '',
            'link': f'/articles/{a.id}',
        }
        for a in articles.filter(art_filter).order_by('-submission_date')[:8]
    ]

    journal_rows = [
        {'id': str(j.id), 'name': j.name, 'issn': j.issn, 'link': f'/articles?journal={j.id}' if role in ('super_admin', 'journal_admin') else '/browse'}
        for j in Journal.objects.filter(Q(name__icontains=q) | Q(issn__icontains=q)).order_by('name')[:6]
    ]

    user_rows = []
    if role in ('super_admin', 'operator'):
        digits = ''.join(ch for ch in q if ch.isdigit())
        uq = Q(first_name__icontains=q) | Q(last_name__icontains=q) | Q(email__icontains=q)
        if len(digits) >= 4:
            uq |= Q(phone__icontains=digits)
        user_rows = [
            {'id': str(u.id), 'name': f'{u.last_name} {u.first_name}'.strip(), 'role': u.role, 'phone': u.phone,
             'link': f'/users?q={u.phone}'}
            for u in User.objects.filter(uq).order_by('last_name')[:6]
        ]

    return Response({'query': q, 'articles': article_rows, 'journals': journal_rows, 'users': user_rows})


# ---------------------------------------------------------------- Ochiq bosh sahifa

class PublicOverviewThrottle(AnonRateThrottle):
    rate = '60/min'


@api_view(['GET'])
@permission_classes([AllowAny])
@throttle_classes([PublicOverviewThrottle])
def public_overview(request):
    """Kirishsiz bosh sahifa: jurnallar katalogi, so'nggi nashrlar, ko'rsatkichlar va narxlar."""
    from django.core.cache import cache

    cached = cache.get('public_overview_v1')
    if cached:
        return Response(cached)

    from apps.articles.models import Article
    from apps.journals.models import Journal
    from apps.udc.models import ServicePrice

    published = Article.objects.filter(status='Published').exclude(_standalone_q())
    pub_counts = {row['journal_id']: row['cnt'] for row in published.values('journal_id').annotate(cnt=Count('id'))}

    journals = []
    for j in Journal.objects.select_related('category').order_by('name')[:60]:
        image = ''
        try:
            if j.image_url:
                image = request.build_absolute_uri(j.image_url.url)
        except Exception:
            image = ''
        journals.append({
            'id': str(j.id),
            'name': j.name,
            'issn': j.issn,
            'category': getattr(j.category, 'name', '') or '',
            'description': (j.description or '')[:280],
            'image': image,
            'published_count': pub_counts.get(j.id, 0),
            'publication_fee': _money(j.publication_fee),
            'price_per_page': _money(j.price_per_page),
            'pricing_type': j.pricing_type,
        })

    recent = [
        {
            'id': str(a.id),
            'title': a.title,
            'journal': getattr(a.journal, 'name', '') or '',
            'authors': (a.submitted_author_name or '').strip() or (a.author.get_full_name() if a.author else ''),
            'doi': a.doi,
            'date': a.submission_date.isoformat() if a.submission_date else None,
            'link': f'/public/article/{a.id}',
        }
        for a in published.select_related('journal', 'author').order_by('-submission_date')[:8]
    ]

    price_keys = ('plagiarism_check', 'udk_request', 'doi_request', 'translation_per_word', 'article_sample_quyi', 'fast_track')
    prices = [
        {'key': p.service_key, 'label': p.label or p.service_key, 'amount': _money(p.amount)}
        for p in ServicePrice.objects.filter(service_key__in=price_keys)
    ]
    prices.sort(key=lambda p: price_keys.index(p['key']))

    fees = [j['publication_fee'] for j in journals if j['publication_fee'] > 0]
    payload = {
        'stats': {
            'journals': len(journals),
            'published_articles': published.count(),
            'authors': User.objects.filter(role='author', is_active=True).count(),
        },
        'journals': journals,
        'recent_articles': recent,
        'prices': prices,
        'publication_fee_from': min(fees) if fees else None,
    }
    cache.set('public_overview_v1', payload, 300)
    return Response(payload)
