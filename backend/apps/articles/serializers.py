import json
import re
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from .models import Article, ArticleVersion, ActivityLog, DoiRequest, ArticleSampleRequest, ArticleOperatorMessage
from apps.users.serializers import UserSerializer
from apps.users.models import User
from apps.journals.models import Journal
from apps.payments.pricing import BOOK_MAX_PAGES
from config.upload_validation import (
    DEFAULT_MAX_MB, DOCUMENT_EXTENSIONS, IMAGE_EXTENSIONS, LARGE_DOCUMENT_MAX_MB, validate_upload,
)


def _normalize_journal_lookup_string(value: str) -> str:
    """Unicode apostrof va variantlarini ASCII ga yaqinlashtirish (TA'LIM va DB mosligi)."""
    return (
        str(value)
        .strip()
        .replace('\u2019', "'")
        .replace('\u2018', "'")
        .replace('\u02bc', "'")
        .replace('\u0060', "'")
    )


def _issn_alnum(value: str) -> str:
    return ''.join(ch for ch in value if ch.isalnum())


def _article_author_display(obj) -> str:
    submitted = (getattr(obj, 'submitted_author_name', None) or '').strip()
    if submitted:
        return submitted
    if not obj.author:
        return ''
    try:
        return getattr(obj.author, 'get_full_name', lambda: str(obj.author))() or ''
    except Exception:
        return ''


def _journal_names_match(a: str, b: str) -> bool:
    return _normalize_journal_lookup_string(a) == _normalize_journal_lookup_string(b)


class JournalPKField(serializers.PrimaryKeyRelatedField):
    """Bo'sh journal ID FormData/JSON da Journal.objects.get(pk='') ORM xatosini oldini oladi."""

    default_error_messages = {
        **serializers.PrimaryKeyRelatedField.default_error_messages,
        'blank_pk': 'Jurnal tanlanishi majburiy (ID bo\'sh).',
    }

    def to_internal_value(self, data):
        if data is None:
            self.fail('required')
        if isinstance(data, Journal):
            return data
        raw = str(data).strip()
        if not raw:
            self.fail('blank_pk')
        s = _normalize_journal_lookup_string(raw)
        first_exc = None
        for candidate in (s, raw):
            try:
                return super().to_internal_value(candidate)
            except (serializers.ValidationError, DjangoValidationError) as exc:
                if first_exc is None:
                    if isinstance(exc, serializers.ValidationError):
                        first_exc = exc
                    else:
                        first_exc = serializers.ValidationError(
                            exc.messages if hasattr(exc, 'messages') else [str(exc)]
                        )
                continue
            except (TypeError, AttributeError):
                if first_exc is None:
                    first_exc = serializers.ValidationError('Jurnal identifikatori noto\'g\'ri.')
                continue

        # Frontend ba'zan UUID o'rniga jurnal nomi yoki "__str__" ko'rinishini yuborishi mumkin.
        # Masalan: "Jurnal nomi (1230-3494)". ISSN bazada chiziqli/chiziqsiz farq qilishi mumkin.
        for label in (s, raw):
            norm_label = _normalize_journal_lookup_string(label)
            for j in Journal.objects.only('id', 'name', 'issn'):
                if _journal_names_match(j.name, norm_label):
                    return j

        display = s if (s.endswith(')') and ' (' in s) else None
        if display is None and raw.endswith(')') and ' (' in raw:
            display = raw
        if display:
            left, _, right = display.rpartition(' (')
            issn_raw = right[:-1].strip()
            name_part = left.strip()
            if name_part and issn_raw:
                issn_digits = _issn_alnum(issn_raw)
                norm_name = _normalize_journal_lookup_string(name_part)
                for j in Journal.objects.only('id', 'name', 'issn'):
                    if _journal_names_match(j.name, norm_name) and _issn_alnum(j.issn) == issn_digits:
                        return j
                exact = Journal.objects.filter(name__iexact=name_part, issn__iexact=issn_raw).first()
                if exact:
                    return exact
                only_name = Journal.objects.filter(name__iexact=name_part)
                if only_name.count() == 1:
                    return only_name.first()
                cand = Journal.objects.filter(name__icontains=name_part[:120])
                for j in cand:
                    if _issn_alnum(j.issn) == issn_digits:
                        return j
                if issn_digits:
                    found_j = None
                    for j in Journal.objects.only('id', 'issn').iterator(chunk_size=200):
                        if _issn_alnum(j.issn) != issn_digits:
                            continue
                        if found_j is not None:
                            found_j = None
                            break
                        found_j = j
                    if found_j is not None:
                        return found_j

        if first_exc:
            raise first_exc
        raise serializers.ValidationError('Jurnal identifikatori noto\'g\'ri yoki jurnal topilmadi.')


def is_large_document_flow(title, keywords) -> bool:
    """Antiplagiat tekshiruvi yoki kitob qo'lyozmasi — 100 MB gacha fayl qabul qilinadi."""
    title_l = (title or '').strip().lower()
    kws = [str(k).strip().lower() for k in (keywords or [])] if isinstance(keywords, (list, tuple)) else []
    return title_l.startswith('[kitob]') or title_l.startswith('plagiarism check') or 'plagiarism' in kws


def enforce_regular_size_limit(file_obj, large_flow: bool) -> None:
    """Oddiy jurnal maqolasi — 25 MB; antiplagiat/kitob — 100 MB (maydon validatori yuqori chegarani tekshiradi)."""
    if large_flow or not file_obj or not hasattr(file_obj, 'size') or getattr(file_obj, '_committed', False):
        return
    if (file_obj.size or 0) > DEFAULT_MAX_MB * 1024 * 1024:
        raise serializers.ValidationError(
            {'final_pdf_path': f'Maqola fayli hajmi {DEFAULT_MAX_MB} MB dan oshmasligi kerak.'}
        )


ANONYMOUS_AUTHOR = 'Anonim muallif'
# Taqrizchidan yashiriladigan, muallifni aniqlaydigan maydonlar
_AUTHOR_IDENTITY_KEYS = ('author', 'co_authors')
_AUTHOR_NAME_KEYS = ('submitted_author_name',)
_REPORT_IDENTITY_KEYS = ('author_first_name', 'author_last_name', 'author_workplace', 'author_position')


def hide_author_from_viewer(context, article) -> bool:
    """
    Yopiq taqriz: taqrizchi muallif kimligini ko'rmasligi kerak ("Maxfiylik" sahifasidagi va'da).
    Faqat shu maqola bo'yicha OCHIQ (open) taqrizga tayinlangan taqrizchi muallifni ko'radi.
    """
    request = context.get('request') if context else None
    user = getattr(request, 'user', None) if request else None
    if not user or not getattr(user, 'is_authenticated', False):
        return False
    if (getattr(user, 'role', '') or '').strip().lower() != 'reviewer':
        return False
    if article.author_id == user.id or article.co_authors.filter(pk=user.pk).exists():
        return False
    return not article.peer_reviews.filter(reviewer=user, review_type='open').exists()


def _needs_publication_payment(context, article) -> bool:
    """
    Muallif uchun: qoralama nashr to'lovini kutyapti va hali to'lanmagan. Avval to'lov bekor qilinsa yoki
    Click'da xato bo'lsa (kutilayotgan tranzaksiya qolmasa) "To'lash" tugmasi yo'qolib, maqola qoralamada
    qotib qolardi — endi shu belgi bo'yicha yangi to'lov boshlanadi.
    """
    if article.status != 'Draft':
        return False
    request = context.get('request') if context else None
    user = getattr(request, 'user', None) if request else None
    if not user or article.author_id != getattr(user, 'id', None):
        return False
    journal = article.journal
    if journal is None or journal.payment_model != 'pre-payment':
        return False
    if not (float(journal.publication_fee or 0) > 0 or float(journal.price_per_page or 0) > 0):
        return False
    if (article.title or '').strip().startswith('[KITOB]'):
        return False  # kitob — alohida (book_publication) to'lov
    from .antiplagiat_utils import is_standalone_antiplagiat
    from apps.payments.models import Transaction

    if is_standalone_antiplagiat(article):
        return False
    return not Transaction.objects.filter(
        article_id=article.pk, service_type='publication_fee', status='completed',
    ).exists()


def _allowed_transitions(context, article) -> list[str]:
    """UI shu ro'yxatga qarab qaror tugmalarini ko'rsatadi (backend update_status bilan bir xil qoida)."""
    from .workflow import allowed_transitions_for

    request = context.get('request') if context else None
    user = getattr(request, 'user', None) if request else None
    if not user or not getattr(user, 'is_authenticated', False):
        return []
    return allowed_transitions_for(user, article)


def _can_publish(context, article) -> bool:
    """«Nashr qilish» (sertifikat yuklash) bloki: bosh admin, jurnal admini yoki taqrizini yakunlagan taqrizchi."""
    from .workflow import reviewer_can_manage

    request = context.get('request') if context else None
    user = getattr(request, 'user', None) if request else None
    if not user or not getattr(user, 'is_authenticated', False):
        return False
    if article.status not in ('Accepted', 'NashrgaYuborilgan'):
        return False
    role = (getattr(user, 'role', '') or '').strip().lower()
    if role == 'super_admin' or getattr(user, 'is_superuser', False):
        return True
    if role == 'journal_admin':
        return getattr(article.journal, 'journal_admin_id', None) == user.id
    return reviewer_can_manage(user, article)


def _my_review_status_map(context):
    """
    Taqrizchi uchun: maqola → o'zining eng so'nggi taqriz holati (pending / accepted / in_progress / completed).
    Ro'yxat "Faol" va "Yakunlangan" ga ajratiladi — avval barcha tayinlangan maqolalar bitta ro'yxatda (34 ta)
    chiqib, bosh sahifadagi "6 ta taqrizda" bilan mos kelmasdi. Bir so'rovda bir marta hisoblanadi.
    """
    if not context:
        return None
    if '_my_review_status_map' in context:
        return context['_my_review_status_map']
    user = _viewer(context)
    result = None
    if user is not None and (getattr(user, 'role', '') or '').lower() == 'reviewer':
        from apps.reviews.models import PeerReview

        result = {}
        for article_id, status in (
            PeerReview.objects.filter(reviewer=user).exclude(status='declined')
            .order_by('assigned_at').values_list('article_id', 'status')
        ):
            result[article_id] = status
    context['_my_review_status_map'] = result
    return result


def anonymize_author(data: dict, article) -> dict:
    for key in _AUTHOR_IDENTITY_KEYS:
        if key in data:
            data[key] = [] if key == 'co_authors' else None
    for key in _AUTHOR_NAME_KEYS:
        if key in data:
            data[key] = ''
    if 'author_name' in data:
        data['author_name'] = ANONYMOUS_AUTHOR
    report = data.get('plagiarism_report')
    if isinstance(report, dict):
        data['plagiarism_report'] = {k: v for k, v in report.items() if k not in _REPORT_IDENTITY_KEYS}
    author_ids = {str(article.author_id)} | {str(pk) for pk in article.co_authors.values_list('pk', flat=True)}
    for log in data.get('activity_logs') or []:
        if str(log.get('user')) in author_ids:
            log['user'] = None
            log['user_name'] = ANONYMOUS_AUTHOR
    for version in data.get('versions') or []:
        if str(version.get('signed_by')) in author_ids:
            version['signed_by'] = None
    return data


class ArticleVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ArticleVersion
        fields = '__all__'


_LEGACY_STATUS_LOG_RE = re.compile(r'^Status changed from (\S+) to (\S+)$')
_PLAGIARISM_LOG_RE = re.compile(r'^Plagiarism: ([\d.]+)%, Originality: ([\d.]+)%(?: \(deep module scan, (\d+) sources\))?')
AUTHOR_PLAGIARISM_REVIEW_LABEL = "Antiplagiat natijasi ko'rib chiqilmoqda"
_STAFF_ROLES = ('super_admin', 'journal_admin', 'reviewer', 'operator', 'accountant')
_ROLE_TITLES = {
    'super_admin': 'Bosh muharrir',
    'journal_admin': 'Jurnal muharriri',
    'reviewer': 'Taqrizchi',
    'operator': 'Operator',
    'accountant': 'Moliya bo\'limi',
}
# Muallifga ko'rsatilmaydigan ichki yozuvlar (bosh admin qarori, chegara hisob-kitobi)
_INTERNAL_LOG_PREFIXES = ("Status: Antiplagiat ko'rib chiqish",)


_STAFF_PLAGIARISM_REVIEW_LABEL = dict(Article.STATUS_CHOICES)['PlagiarismReview']


def status_change_text(old_status: str, new_status: str) -> str:
    """Faoliyat jurnali uchun o'zbekcha matn (avval inglizcha 'Status changed from X to Y' yozilardi)."""
    labels = dict(Article.STATUS_CHOICES)
    # "QabulQilingan" (taqrizda) va "Accepted" (qabul qilindi) model yorliqlari deyarli bir xil — jurnalda
    # «"Qabul Qilingan" → "Qabul qilingan"» chalkash ko'rinardi. Sahifadagi holat nomlari ishlatiladi.
    labels.update({'QabulQilingan': 'Ko‘rib chiqilmoqda', 'Accepted': 'Qabul qilindi', 'NashrgaYuborilgan': 'Nashrga tayyorlanmoqda'})
    return f'Holat: "{labels.get(old_status, old_status)}" → "{labels.get(new_status, new_status)}"'


def _viewer(context):
    request = context.get('request') if context else None
    return getattr(request, 'user', None)


def viewer_is_staff(context) -> bool:
    user = _viewer(context)
    if not user or not getattr(user, 'is_authenticated', False):
        return False
    return user.is_superuser or (getattr(user, 'role', '') or '').lower() in _STAFF_ROLES


class ActivityLogSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = ActivityLog
        fields = '__all__'

    def get_user_name(self, obj):
        if not obj.user:
            return 'Tizim'
        if not viewer_is_staff(self.context) and obj.user_id != getattr(_viewer(self.context), 'id', None):
            # Muallifga xodim ismi emas, vazifasi (taqriz anonimligi)
            return _ROLE_TITLES.get((getattr(obj.user, 'role', '') or '').lower(), 'Tahririyat')
        try:
            return getattr(obj.user, 'get_full_name', lambda: str(obj.user))() or 'Tizim'
        except Exception:
            return 'Tizim'

    def to_representation(self, instance):
        data = super().to_representation(instance)
        match = _LEGACY_STATUS_LOG_RE.match(data.get('action') or '')
        if match:
            data['action'] = status_change_text(match.group(1), match.group(2))
        elif data.get('action') == 'Plagiarism check completed':
            # Bazadagi matn o'zgarmaydi (vaqt chizig'i shu kalit bo'yicha qidiradi) — faqat ko'rsatish o'zbekcha
            data['action'] = 'Antiplagiat tekshiruvi yakunlandi'
            details = _PLAGIARISM_LOG_RE.match(data.get('details') or '')
            if details:
                data['details'] = (
                    f'Plagiat: {details.group(1)}%, originallik: {details.group(2)}%'
                    + (f' ({details.group(3)} ta manba)' if details.group(3) else '')
                )
        if not viewer_is_staff(self.context) and data.get('action'):
            # Holat o'zgarishi yozuvida ham muallifga "(bosh admin qarori)" emas, umumiy nom
            data['action'] = data['action'].replace(_STAFF_PLAGIARISM_REVIEW_LABEL, AUTHOR_PLAGIARISM_REVIEW_LABEL)
        return data


class ActivityLogListSerializer(serializers.ListSerializer):
    """Muallifga ichki yozuvlar (antiplagiat bosh admin qarori tafsilotlari) ko'rsatilmaydi."""

    def to_representation(self, data):
        items = super().to_representation(data)
        if viewer_is_staff(self.context):
            return items
        return [i for i in items if not str(i.get('action') or '').startswith(_INTERNAL_LOG_PREFIXES)]


ActivityLogSerializer.Meta.list_serializer_class = ActivityLogListSerializer


def _article_work_type(obj) -> str:
    """Ish turi: konferensiya — Tezis, jurnal — Maqola, kitob — Kitob, mustaqil tekshiruv — Antiplagiat."""
    from .antiplagiat_utils import looks_like_standalone_antiplagiat
    from .works_report import work_type_label, is_book_title

    if looks_like_standalone_antiplagiat(obj):
        return 'Antiplagiat'
    category = getattr(getattr(obj.journal, 'category', None), 'name', '') if obj.journal_id else ''
    return work_type_label(category, is_book_title(obj.title))


class ArticleListSerializer(serializers.ModelSerializer):
    """Minimal serializer for list action only — avoids nested/expensive fields that can cause 500."""
    author_name = serializers.SerializerMethodField()
    journal_name = serializers.SerializerMethodField()
    publication_link = serializers.SerializerMethodField()
    certificate_download_link = serializers.SerializerMethodField()
    pending_payment_transaction_id = serializers.SerializerMethodField()
    work_type = serializers.SerializerMethodField()
    antiplagiat_state = serializers.SerializerMethodField()
    antiplagiat_check_active = serializers.SerializerMethodField()

    class Meta:
        model = Article
        fields = (
            'id', 'title', 'abstract', 'keywords', 'status', 'author', 'journal',
            'author_name', 'journal_name', 'doi', 'submission_date', 'views_count',
            'downloads_count', 'citations_count', 'page_count', 'fast_track',
            'plagiarism_percentage', 'ai_content_percentage', 'originality_percentage', 'plagiarism_checked_at',
            'publication_url', 'publication_link', 'certificate_download_link',
            'pending_payment_transaction_id', 'work_type', 'antiplagiat_state', 'antiplagiat_check_active',
        )

    def get_work_type(self, obj):
        return _article_work_type(obj)

    def get_antiplagiat_state(self, obj):
        from .antiplagiat_utils import standalone_antiplagiat_state

        return standalone_antiplagiat_state(obj)

    def get_antiplagiat_check_active(self, obj):
        from .antiplagiat_utils import antiplagiat_check_active, looks_like_standalone_antiplagiat

        return looks_like_standalone_antiplagiat(obj) and antiplagiat_check_active(obj)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['allowed_transitions'] = _allowed_transitions(self.context, instance)
        data['needs_publication_payment'] = _needs_publication_payment(self.context, instance)
        status_map = _my_review_status_map(self.context)
        if status_map is not None:
            data['my_review_status'] = status_map.get(instance.pk)
        if hide_author_from_viewer(self.context, instance):
            anonymize_author(data, instance)
        return data

    def get_author_name(self, obj):
        return _article_author_display(obj)

    def get_journal_name(self, obj):
        if not obj.journal:
            return ''
        try:
            return getattr(obj.journal, 'name', '') or ''
        except Exception:
            return ''

    def _build_absolute_url_list(self, value):
        if not value:
            return ''
        value_str = str(value)
        if value_str.startswith('http://') or value_str.startswith('https://'):
            return value_str
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(value_str)
        return value_str

    def get_publication_link(self, obj):
        if not getattr(obj, 'publication_url', None):
            return ''
        return self._build_absolute_url_list(obj.publication_url)

    def get_certificate_download_link(self, obj):
        if getattr(obj, 'publication_certificate_path', None) and obj.publication_certificate_path:
            return self._build_absolute_url_list(obj.publication_certificate_path.url)
        if getattr(obj, 'publication_certificate_url', None) and obj.publication_certificate_url:
            return self._build_absolute_url_list(obj.publication_certificate_url)
        if getattr(obj, 'certificate_url', None) and obj.certificate_url:
            return self._build_absolute_url_list(obj.certificate_url)
        return ''

    def get_pending_payment_transaction_id(self, obj):
        """Muallif: to'lov kutilayotgan Draft uchun Click sahifasiga qaytish."""
        if getattr(obj, 'status', None) != 'Draft':
            return None
        try:
            from apps.payments.models import Transaction
            tx = (
                Transaction.objects.filter(
                    article_id=obj.pk,
                    service_type='publication_fee',
                    status='pending',
                )
                .order_by('-created_at')
                .first()
            )
            return str(tx.id) if tx else None
        except Exception:
            return None


class ArticleSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    journal_name = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()
    versions = ArticleVersionSerializer(many=True, read_only=True)
    activity_logs = ActivityLogSerializer(many=True, read_only=True)
    analytics = serializers.SerializerMethodField()
    status_label = serializers.SerializerMethodField()
    workflow_stage = serializers.SerializerMethodField()
    workflow_steps = serializers.SerializerMethodField()
    status_timeline = serializers.SerializerMethodField()
    publication_payment = serializers.SerializerMethodField()
    work_type = serializers.SerializerMethodField()

    def get_work_type(self, obj):
        return _article_work_type(obj)

    def get_publication_payment(self, obj):
        """
        Muallifga: rad etilgan maqolaning nashr to'lovi va qaytarish holati (qaytarishni so'rash tugmasi uchun).
        Faqat maqola egasiga; boshqa rollarga — None.
        """
        user = _viewer(self.context)
        if not user or obj.author_id != getattr(user, 'id', None) or obj.status != 'Rejected':
            return None
        from apps.payments.models import Transaction

        tx = (
            Transaction.objects.filter(article_id=obj.pk, service_type='publication_fee', status__in=('completed', 'refunded'))
            .order_by('-created_at')
            .first()
        )
        if tx is None:
            return None
        return {
            'transaction_id': str(tx.id),
            'amount': float(tx.amount),
            'status': tx.status,
            'refund_requested_at': tx.refund_requested_at,
            'refunded_at': tx.refunded_at,
            'refund_note': tx.refund_note if tx.status == 'refunded' else '',
        }

    # Muallif PATCH orqali faqat antiplagiat sozlamalarini yuborishi mumkin (savePlagiarismConfig).
    PLAGIARISM_CONFIG_KEYS = (
        'pending_enabled_modules',
        'document_type',
        'document_name',
        'author_first_name',
        'author_last_name',
    )

    class Meta:
        model = Article
        fields = '__all__'
        # Holat, natijalar, sertifikatlar va to'lovga ta'sir qiluvchi maydonlar faqat server
        # amallari (update_status, complete_publication, antiplagiat tekshiruvi) orqali o'zgaradi.
        read_only_fields = (
            'id', 'submission_date', 'views_count', 'downloads_count', 'citations_count',
            'status', 'author', 'co_authors', 'journal', 'issue', 'doi', 'published_by',
            'plagiarism_percentage', 'ai_content_percentage', 'originality_percentage',
            'plagiarism_checked_at',
            'udk_code', 'udk_description', 'udk_certificate_path',
            'certificate_url', 'publication_url', 'publication_certificate_url',
            'publication_certificate_path', 'thesis_url', 'review_content',
            'page_count', 'fast_track',
        )

    def validate_final_pdf_path(self, value):
        return validate_upload(value, allowed=DOCUMENT_EXTENSIONS, max_mb=LARGE_DOCUMENT_MAX_MB, field='final_pdf_path')

    def validate_additional_document_path(self, value):
        # Kitob muqovasi rasm bo'lishi mumkin
        return validate_upload(value, allowed=DOCUMENT_EXTENSIONS | IMAGE_EXTENSIONS, field='additional_document_path')

    def validate(self, attrs):
        # Faylni almashtirish (PATCH): oddiy maqola 25 MB, antiplagiat/kitob 100 MB
        if self.instance is not None and 'final_pdf_path' in attrs:
            enforce_regular_size_limit(
                attrs['final_pdf_path'],
                is_large_document_flow(self.instance.title, self.instance.keywords),
            )
        return super().validate(attrs)

    def validate_plagiarism_report(self, value):
        """Faqat sozlama kalitlari qabul qilinadi va mavjud hisobotga qo'shiladi (natijalar o'zgarmaydi)."""
        if not isinstance(value, dict):
            raise serializers.ValidationError('plagiarism_report obyekt bo\'lishi kerak.')
        instance = getattr(self, 'instance', None)
        existing = instance.plagiarism_report if instance is not None and isinstance(instance.plagiarism_report, dict) else {}
        if instance is not None and (
            instance.plagiarism_checked_at or existing.get('check_status') in ('processing', 'completed')
        ):
            raise serializers.ValidationError('Tekshiruv boshlangan — sozlamalarni o\'zgartirib bo\'lmaydi.')
        merged = dict(existing)
        for key in self.PLAGIARISM_CONFIG_KEYS:
            if key not in value:
                continue
            raw = value[key]
            if key == 'pending_enabled_modules':
                merged[key] = [str(m)[:80] for m in raw][:300] if isinstance(raw, list) else []
            else:
                merged[key] = str(raw or '')[:300]
        return merged

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['publication_link'] = self.get_publication_link(instance)
        data['certificate_download_link'] = self.get_certificate_download_link(instance)
        data['allowed_transitions'] = _allowed_transitions(self.context, instance)
        data['needs_publication_payment'] = _needs_publication_payment(self.context, instance)
        # Muharrir "Qabul qilish" tugmasini faqat yakunlangan taqriz bo'lsa ko'radi (backend ham tekshiradi)
        data['has_completed_review'] = instance.peer_reviews.filter(status='completed').exists()
        data['can_publish'] = _can_publish(self.context, instance)
        if hide_author_from_viewer(self.context, instance):
            anonymize_author(data, instance)
        return data

    def _build_absolute_url(self, value):
        if not value:
            return ''
        value_str = str(value)
        if value_str.startswith('http://') or value_str.startswith('https://'):
            return value_str
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(value_str)
        return value_str

    def get_publication_link(self, obj):
        return self._build_absolute_url(obj.publication_url) if obj.publication_url else ''

    def get_certificate_download_link(self, obj):
        if getattr(obj, 'publication_certificate_path', None) and obj.publication_certificate_path:
            return self._build_absolute_url(obj.publication_certificate_path.url)
        if getattr(obj, 'publication_certificate_url', None) and obj.publication_certificate_url:
            return self._build_absolute_url(obj.publication_certificate_url)
        return self._build_absolute_url(obj.certificate_url) if getattr(obj, 'certificate_url', None) else ''
    
    def get_file_url(self, obj):
        """Return absolute URL for main PDF so frontend can open/download."""
        if not obj.final_pdf_path:
            return None
        try:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.final_pdf_path.url)
            from django.conf import settings
            base = getattr(settings, 'MEDIA_URL', '/media/').rstrip('/')
            path = str(obj.final_pdf_path).lstrip('/')
            return f"{base}/{path}" if path else None
        except Exception:
            return None
    
    def get_author_name(self, obj):
        return _article_author_display(obj)

    def get_journal_name(self, obj):
        if not obj.journal:
            return ''
        return getattr(obj.journal, 'name', '') or ''
    
    def get_analytics(self, obj):
        return {
            'views': obj.views_count,
            'downloads': obj.downloads_count,
            'citations': obj.citations_count
        }

    def _is_book_submission(self, obj):
        return (obj.title or '').strip().startswith('[KITOB]')

    def _status_labels(self):
        labels = self._base_status_labels()
        if not viewer_is_staff(self.context):
            # Muallifga kim qaror qilishi (bosh admin) emas, umumiy holat ko'rsatiladi
            labels['PlagiarismReview'] = AUTHOR_PLAGIARISM_REVIEW_LABEL
        return labels

    def _base_status_labels(self):
        return {
            'Draft': "Qoralama (to'lov kutilmoqda)",
            'Yangi': 'Yangi topshirildi',
            'WithEditor': 'Tekshiruvda',
            'Revision': 'To‘ldirish talab qilinadi',
            'QabulQilingan': 'Ko‘rib chiqilmoqda',
            'WritingInProgress': 'Tuzatish kiritilmoqda',
            'Accepted': 'Qabul qilindi',
            'NashrgaYuborilgan': 'Nashrga tayyorlanmoqda',
            'PlagiarismReview': 'Antiplagiat ko\'rib chiqish (bosh admin qarori)',
            'Published': 'Nashr etildi',
            'Rejected': 'Jarayon to‘xtatildi',
            # Book-specific extension statuses
            'ContractProcessing': 'Shartnoma rasmiylashtirilmoqda',
            'IsbnProcessing': 'ISBN olinmoqda',
            'AuthorDataVerified': 'Muallif ma’lumotlari tasdiqlandi',
            'PaymentCompleted': 'To‘lov jarayoni yakunlandi',
            'SentToPrint': 'Bosmaga berildi',
            'Printing': 'Chop etilmoqda',
            'Ready': 'Tayyor',
            'Packaging': 'Qadoqlanmoqda',
            'Shipping': 'Yuborilmoqda (pochta)',
            'Delivered': 'Yetkazildi',
            'ProcessPaused': 'Jarayon to‘xtatildi',
        }

    # Kitob buyurtmasi o'z bosqichlariga ega. Avval jurnal maqolasi bosqichlari ("Tekshiruv", "Muharrirlik")
    # ishlatilib, "Shartnoma" bosqichidagi kitob "Tekshiruv 40%" deb ko'rinardi.
    BOOK_STEPS = ["To'lov", 'Shartnoma va ISBN', 'Bosmaxona', 'Tayyorlash', 'Yetkazish']
    BOOK_STAGE_INDEX = {
        'Draft': 0,
        'Yangi': 1, 'QabulQilingan': 1, 'ContractProcessing': 1, 'IsbnProcessing': 1,
        'AuthorDataVerified': 1, 'PaymentCompleted': 1, 'ProcessPaused': 1,
        'SentToPrint': 2, 'Printing': 2,
        'Ready': 3, 'Packaging': 3,
        'Shipping': 4,
        'Delivered': 5,  # hammasi bajarilgan
        'Rejected': 1,
    }

    def _workflow_steps_by_type(self, is_book):
        if is_book:
            return list(self.BOOK_STEPS)
        return ['Topshirildi', 'Tekshiruv', 'Muharrirlik', 'Nashr']

    def _stage_index_by_status(self, status_value, is_book):
        if is_book:
            return self.BOOK_STAGE_INDEX.get(status_value, 1)
        common_map = {
            'Draft': 0,
            'Yangi': 0,
            'WithEditor': 1,
            'Revision': 1,
            'QabulQilingan': 2,
            'WritingInProgress': 2,
            'Accepted': 2,
            'PlagiarismReview': 2,
            'NashrgaYuborilgan': 3,
            'Published': 4,  # hammasi bajarilgan
            'Rejected': 3,
            'ProcessPaused': 3,
        }
        return common_map.get(status_value, 0)

    def get_status_label(self, obj):
        return self._status_labels().get(obj.status, obj.status)

    def get_workflow_stage(self, obj):
        is_book = self._is_book_submission(obj)
        current_idx = self._stage_index_by_status(obj.status, is_book)
        steps = self._workflow_steps_by_type(is_book)
        return steps[min(current_idx, len(steps) - 1)]

    def get_workflow_steps(self, obj):
        is_book = self._is_book_submission(obj)
        steps = self._workflow_steps_by_type(is_book)
        current_idx = self._stage_index_by_status(obj.status, is_book)

        items = []
        for idx, step in enumerate(steps):
            items.append({
                'name': step,
                'done': idx < current_idx,
                'current': idx == current_idx,
            })
        return items

    # Muallifga har bir holatda "hozir nima bo'lyapti" degan qisqa tushuntirish
    STATUS_HINTS = {
        'Draft': "To'lov kutilmoqda. To'lovdan so'ng maqola tahririyatga yuboriladi.",
        'Yangi': 'Maqola qabul qilindi va tahririyat navbatiga qo\'yildi.',
        'WithEditor': 'Muharrir maqolani dastlabki tekshiruvdan o\'tkazmoqda.',
        'QabulQilingan': 'Maqola taqrizchiga yuborildi va ko\'rib chiqilmoqda.',
        'WritingInProgress': 'Maqolaga tuzatishlar kiritilmoqda.',
        'Revision': 'Tahrirga qaytarildi. Izohni o\'qib, tuzatilgan faylni qayta yuboring.',
        'Accepted': 'Maqola qabul qilindi va nashrga tayyorlanmoqda.',
        'NashrgaYuborilgan': 'Maqola jurnalga nashr uchun yuborildi.',
        'PlagiarismReview': 'Antiplagiat natijasi bo\'yicha bosh administrator qarori kutilmoqda.',
        'Published': 'Maqola nashr etildi. Sertifikat va havola maqola sahifasida.',
        'Rejected': 'Maqola rad etildi. Sababini izohda ko\'ring.',
        'ProcessPaused': 'Jarayon vaqtincha to\'xtatildi.',
    }
    STATUS_TONES = {
        'Published': 'success', 'Accepted': 'success', 'Delivered': 'success', 'Ready': 'success',
        'Revision': 'warning', 'PlagiarismReview': 'warning', 'Draft': 'warning',
        'Rejected': 'danger', 'ProcessPaused': 'danger',
    }
    ROLE_LABELS = {
        'author': 'Muallif',
        'reviewer': 'Taqrizchi',
        'journal_admin': 'Jurnal muharriri',
        'super_admin': 'Bosh muharrir',
        'accountant': 'Buxgalteriya',
        'operator': 'Operator',
    }

    def _viewer_is_staff(self):
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        if not user or not getattr(user, 'is_authenticated', False):
            return False
        role = (getattr(user, 'role', '') or '').lower()
        return role in ('super_admin', 'journal_admin', 'reviewer', 'operator', 'accountant') or user.is_superuser

    def _viewer_is_reviewer(self):
        user = _viewer(self.context)
        return (getattr(user, 'role', '') or '').lower() == 'reviewer'

    def _responsible_label(self, actor, actor_role, obj, staff_view):
        if actor is None:
            return 'Tizim'
        if actor.pk == obj.author_id:
            return 'Muallif'
        role_label = self.ROLE_LABELS.get((actor_role or getattr(actor, 'role', '') or '').lower(), 'Tahririyat')
        if not staff_view:
            # Muallifga xodimning ismi emas, vazifasi ko'rsatiladi (taqriz anonimligi).
            return role_label
        name = getattr(actor, 'get_full_name', lambda: '')() or ''
        return f'{name} ({role_label})' if name else role_label

    def get_status_timeline(self, obj):
        """
        Vaqt chizig'i (eskidan yangiga): holat o'zgarishlari + muhim hodisalar (to'lov, antiplagiat).
        Har bir yozuv: status (nom), to_status, date, comment, responsible, hint, tone, kind.
        """
        status_labels = self._status_labels()
        staff_view = self._viewer_is_staff()
        items = []

        events = list(obj.status_events.select_related('actor').all())
        for ev in events:
            internal = not staff_view and ev.to_status == 'PlagiarismReview'
            items.append({
                'kind': 'status',
                # Muallifga bosh admin qarori va chegara hisob-kitobi emas — umumiy holat ko'rsatiladi
                'status': "Antiplagiat natijasi tahririyatda ko'rib chiqilmoqda" if internal else status_labels.get(ev.to_status, ev.to_status),
                'to_status': ev.to_status,
                'from_status': ev.from_status,
                'date': ev.created_at,
                'comment': '' if internal else (ev.note or ''),
                'responsible': self._responsible_label(ev.actor, ev.actor_role, obj, staff_view),
                'hint': "Tahririyat qarori bilan maqola keyingi bosqichga o'tadi." if internal else self.STATUS_HINTS.get(ev.to_status, ''),
                'tone': self.STATUS_TONES.get(ev.to_status, 'info'),
            })

        if not events:
            # Migratsiyadan oldingi yoki tarixsiz maqola: kamida yuborilgan sana ko'rinsin
            items.append({
                'kind': 'status',
                'status': status_labels.get(obj.status, obj.status),
                'to_status': obj.status,
                'from_status': '',
                'date': obj.submission_date,
                'comment': '',
                'responsible': 'Muallif',
                'hint': self.STATUS_HINTS.get(obj.status, ''),
                'tone': self.STATUS_TONES.get(obj.status, 'info'),
            })

        try:
            from apps.payments.models import Transaction

            for tx in Transaction.objects.filter(article_id=obj.pk, status='completed').only(
                'id', 'amount', 'service_type', 'completed_at', 'created_at'
            ):
                items.append({
                    'kind': 'payment',
                    'status': "To'lov qabul qilindi",
                    'to_status': '',
                    'from_status': '',
                    'date': tx.completed_at or tx.created_at,
                    # Taqrizchiga to'lov summasi ko'rsatilmaydi (taqriz to'lovdan mustaqil bo'lishi kerak)
                    'comment': '' if self._viewer_is_reviewer() else f"{int(tx.amount):,} so'm".replace(',', ' '),
                    'responsible': 'Tizim',
                    'hint': '',
                    'tone': 'success',
                })
        except Exception:
            pass

        for log in obj.activity_logs.filter(action='Plagiarism check completed').order_by('timestamp')[:5]:
            items.append({
                'kind': 'plagiarism',
                'status': 'Antiplagiat tekshiruvi yakunlandi',
                'to_status': '',
                'from_status': '',
                'date': log.timestamp,
                'comment': '',
                'responsible': 'Tizim',
                'hint': '',
                'tone': 'info',
            })

        items.sort(key=lambda x: x['date'] or obj.submission_date)
        return items


class JSONListOfDictsField(serializers.ListField):
    """Fayl bilan yuborilganda (multipart) ro'yxat JSON satr bo'lib keladi: '[{"name": ..}]'.
    Avval bu "Expected a dictionary ... got str" bilan rad etilardi — hammuallif qo'shilsa maqola yaratilmas edi."""

    def to_internal_value(self, data):
        if isinstance(data, list) and len(data) == 1 and isinstance(data[0], str):
            data = data[0]
        if isinstance(data, str):
            if not data.strip():
                return []
            try:
                data = json.loads(data)
            except ValueError:
                raise serializers.ValidationError("Hammualliflar ro'yxati noto'g'ri formatda.")
        return super().to_internal_value(data)


class CreateArticleSerializer(serializers.ModelSerializer):
    journal = JournalPKField(queryset=Journal.objects.all())
    co_author_contacts = JSONListOfDictsField(
        child=serializers.DictField(),
        required=False,
        allow_empty=True,
        write_only=True,
    )

    class Meta:
        model = Article
        fields = ('id', 'title', 'abstract', 'keywords', 'journal', 'final_pdf_path',
                  'additional_document_path', 'page_count', 'fast_track', 'co_author_contacts',
                  'submitted_author_name', 'bibliography')
        read_only_fields = ('id',)
        extra_kwargs = {
            'abstract': {'required': False, 'allow_blank': True},
        }

    def validate_final_pdf_path(self, value):
        return validate_upload(value, allowed=DOCUMENT_EXTENSIONS, max_mb=LARGE_DOCUMENT_MAX_MB, field='final_pdf_path')

    def validate_additional_document_path(self, value):
        return validate_upload(value, allowed=DOCUMENT_EXTENSIONS | IMAGE_EXTENSIONS, field='additional_document_path')

    def validate_keywords(self, value):
        """Accept list, JSON string (e.g. from multipart), or comma-separated string; normalize to list."""
        if value is None:
            return []
        if isinstance(value, list):
            return [str(x).strip() for x in value if str(x).strip()]
        if isinstance(value, str):
            value = value.strip()
            if not value:
                return []
            if (value.startswith('[') and value.endswith(']')) or value.startswith('{'):
                try:
                    parsed = json.loads(value)
                    if isinstance(parsed, list):
                        return [str(x).strip() for x in parsed if str(x).strip()]
                except (ValueError, TypeError):
                    pass
            return [k.strip() for k in value.split(',') if k.strip()]
        return []

    def validate_title(self, value):
        """Title is required and must not be only a file name (e.g. ending with extension, no spaces)."""
        if not value or not str(value).strip():
            raise serializers.ValidationError('Maqola mavzusi (sarlavha) majburiy.')
        title = str(value).strip()
        if len(title) < 3:
            raise serializers.ValidationError('Maqola mavzusi kamida 3 ta belgidan iborat bo\'lishi kerak.')
        lower = title.lower()
        for ext in ('.pdf', '.docx', '.doc'):
            if lower.endswith(ext):
                stem = title[: -len(ext)].strip()
                # Reject only if it looks like a bare filename (no space or very short stem)
                if not stem or ' ' not in stem and len(stem) < 15:
                    raise serializers.ValidationError(
                        'Maqola mavzusi fayl nomi emas, balki maqolaning haqiqiy sarlavhasi bo\'lishi kerak.'
                    )
                break
        return title

    def validate_co_author_contacts(self, value):
        if value in (None, ''):
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError('Hammualliflar ro\'yxat ko\'rinishida yuborilishi kerak.')
        normalized = []
        for row in value:
            if not isinstance(row, dict):
                continue
            identifier = str(row.get('identifier') or row.get('id') or '').strip()
            email = str(row.get('email') or '').strip().lower()
            phone = str(row.get('phone') or '').strip()
            name = str(row.get('name') or '').strip()
            if not any([identifier, email, phone]):
                continue
            normalized.append({
                'identifier': identifier,
                'email': email,
                'phone': phone,
                'name': name,
            })
        return normalized

    def _resolve_co_author_user(self, entry):
        import uuid as uuid_module
        from apps.users.phone_verification import normalize_phone

        identifier = entry.get('identifier', '')
        email = entry.get('email', '')
        phone = entry.get('phone', '')

        if identifier:
            # id=<telefon/email> UUID maydonida ValidationError (500) berardi — faqat haqiqiy UUID bo'yicha qidiramiz
            try:
                user_by_id = User.objects.filter(id=uuid_module.UUID(identifier)).first()
            except ValueError:
                user_by_id = None
            if user_by_id:
                return user_by_id
            if '@' in identifier:
                user_by_email = User.objects.filter(email__iexact=identifier).first()
                if user_by_email:
                    return user_by_email
            # "922222222", "+998 92 222 22 22" → 998922222222 (login bilan bir xil normallashtirish)
            digits = normalize_phone(identifier)
            if len(digits) >= 9:
                user_by_phone = User.objects.filter(phone=digits).first()
                if user_by_phone:
                    return user_by_phone

        if email:
            user_by_email = User.objects.filter(email__iexact=email).first()
            if user_by_email:
                return user_by_email

        if phone:
            user_by_phone = User.objects.filter(phone=normalize_phone(phone)).first()
            if user_by_phone:
                return user_by_phone
        return None

    def validate(self, attrs):
        """
        Sahifalar soni (bet bo'yicha narx shunga qarab olinadi) fayldan SERVER tomonida aniqlanadi.
        Aniqlab bo'lmasa (masalan, eski .doc dan matn chiqmasa) — muallif kiritgan qiymat (1..500).
        """
        from .page_count import count_pages

        large_flow = is_large_document_flow(attrs.get('title'), attrs.get('keywords'))
        enforce_regular_size_limit(attrs.get('final_pdf_path'), large_flow)
        # Kitob: sahifalar soni — bosma nashr betlari (narx book_publication to'lovida, foydalanuvchi kiritadi)
        is_book = (attrs.get('title') or '').strip().startswith('[KITOB]')
        pages = None if is_book else count_pages(attrs.get('final_pdf_path'))
        if pages:
            attrs['page_count'] = pages
        else:
            try:
                attrs['page_count'] = max(1, min(BOOK_MAX_PAGES if is_book else 500, int(attrs.get('page_count') or 1)))
            except (TypeError, ValueError):
                attrs['page_count'] = 1
        return attrs

    def validate_journal(self, journal):
        """Namuna (demo) jurnalga haqiqiy foydalanuvchi maqola yubora olmaydi (pul to'lab qo'ymasin)."""
        from config.demo import is_demo_journal, is_demo_user

        request = self.context.get('request')
        if (self.instance is None and journal is not None and is_demo_journal(journal)
                and request is not None and not is_demo_user(request.user)):
            raise serializers.ValidationError(
                "Bu namuna (demo) jurnal — haqiqiy maqolalar qabul qilinmaydi. Boshqa jurnalni tanlang."
            )
        if self.instance is None and journal is not None and getattr(journal, 'is_archived', False):
            raise serializers.ValidationError("Bu jurnal arxivlangan — maqola qabul qilinmaydi. Boshqa jurnalni tanlang.")
        return journal

    def create(self, validated_data):
        from apps.users.phone_verification import verification_required_message

        blocked = verification_required_message(self.context['request'].user)
        if blocked:
            raise serializers.ValidationError({'detail': blocked})
        co_author_contacts = validated_data.pop('co_author_contacts', [])
        validated_data['author'] = self.context['request'].user
        title = (validated_data.get('title') or '').strip()
        keywords = validated_data.get('keywords') or []
        is_antiplagiat = title.lower().startswith('plagiarism check') or any(
            str(k).lower() == 'plagiarism' for k in keywords
        )
        # Mustaqil antiplagiat: Draft — keyin to'lov (language_editing) va tekshiruv; jurnal topshirig'i Yangi
        if self.context.get('awaiting_publication_payment'):
            validated_data['status'] = 'Draft'
        else:
            validated_data['status'] = 'Draft' if is_antiplagiat else 'Yangi'
        article = super().create(validated_data)
        if is_antiplagiat:
            report = article.plagiarism_report if isinstance(article.plagiarism_report, dict) else {}
            report = {**report, 'is_standalone': True}
            article.plagiarism_report = report
            article.save(update_fields=['plagiarism_report'])

        owner_id = str(self.context['request'].user.id)
        co_author_ids = set()
        for entry in co_author_contacts:
            co_author = self._resolve_co_author_user(entry)
            if co_author and str(co_author.id) != owner_id:
                co_author_ids.add(str(co_author.id))
        if co_author_ids:
            article.co_authors.set(User.objects.filter(id__in=list(co_author_ids)))
        return article


class PublicArticleShareSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    journal_name = serializers.SerializerMethodField()
    publication_link = serializers.SerializerMethodField()
    certificate_download_link = serializers.SerializerMethodField()
    plagiarism_history = serializers.SerializerMethodField()

    class Meta:
        model = Article
        fields = (
            'id',
            'title',
            'status',
            'doi',
            'submission_date',
            'author_name',
            'journal_name',
            'publication_link',
            'certificate_download_link',
            'plagiarism_history',
        )

    def _build_absolute_url(self, value):
        if not value:
            return ''

        value_str = str(value)
        if value_str.startswith('http://') or value_str.startswith('https://'):
            return value_str

        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(value_str)

        return value_str

    def get_author_name(self, obj):
        return _article_author_display(obj)

    def get_journal_name(self, obj):
        return obj.journal.name if obj.journal else ''

    def get_publication_link(self, obj):
        return self._build_absolute_url(obj.publication_url)

    def get_certificate_download_link(self, obj):
        # Uploaded file is primary for publication certificate
        if getattr(obj, 'publication_certificate_path', None) and obj.publication_certificate_path:
            return self._build_absolute_url(obj.publication_certificate_path.url)
        if obj.publication_certificate_url:
            return self._build_absolute_url(obj.publication_certificate_url)
        return self._build_absolute_url(obj.certificate_url)

    def get_plagiarism_history(self, obj):
        import re

        history = []
        logs = obj.activity_logs.filter(action='Plagiarism check completed').order_by('-timestamp')[:20]

        for log in logs:
            plagiarism_percentage = None
            ai_content_percentage = None

            if log.details:
                plagiarism_match = re.search(r'Plagiarism:\s*([\d.]+)%', log.details)
                ai_match = re.search(r'AI\s*Content:\s*([\d.]+)%', log.details)

                if plagiarism_match:
                    plagiarism_percentage = float(plagiarism_match.group(1))
                if ai_match:
                    ai_content_percentage = float(ai_match.group(1))

            history.append({
                'checked_at': log.timestamp,
                'plagiarism_percentage': plagiarism_percentage,
                'ai_content_percentage': ai_content_percentage,
                'details': log.details or '',
            })

        return history


class DoiRequestSerializer(serializers.ModelSerializer):
    """DOI so'rovi: muallif va taqrizchi uchun."""
    file_url = serializers.SerializerMethodField()
    author_short = serializers.SerializerMethodField()

    class Meta:
        model = DoiRequest
        fields = (
            'id', 'author_first_name', 'author_last_name', 'author_short',
            'file', 'file_url', 'status', 'doi_link', 'created_at', 'completed_at',
        )
        read_only_fields = fields

    def get_file_url(self, obj):
        if not obj.file:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.file.url)
        return str(obj.file.url) if obj.file else None

    def get_author_short(self, obj):
        return f"{obj.author_last_name} {obj.author_first_name}"


class ArticleSampleRequestSerializer(serializers.ModelSerializer):
    """Maqola namuna so'rovi: taqrizchi barcha submitted ni ko'radi, muallif o'zini."""
    author_short = serializers.SerializerMethodField()
    result_file_url = serializers.SerializerMethodField()
    taken_by_me = serializers.SerializerMethodField()
    reviewer_name = serializers.SerializerMethodField()

    class Meta:
        model = ArticleSampleRequest
        fields = (
            'id', 'author_first_name', 'author_last_name', 'author_short',
            'requirements', 'pages', 'topic', 'quality_level', 'amount', 'status', 'created_at',
            'reviewer_note', 'result_file_url', 'taken_at', 'completed_at', 'taken_by_me', 'reviewer_name',
        )
        read_only_fields = fields

    def get_author_short(self, obj):
        return f"{obj.author_last_name} {obj.author_first_name}"

    def get_result_file_url(self, obj):
        if not obj.result_file:
            return None
        request = self.context.get('request')
        url = obj.result_file.url
        return request.build_absolute_uri(url) if request else url

    def get_taken_by_me(self, obj):
        request = self.context.get('request')
        return bool(request and obj.reviewer_id and obj.reviewer_id == request.user.id)

    def get_reviewer_name(self, obj):
        # Muallifga bajaruvchi ismi ko'rsatilmaydi (taqrizchilar anonim), xodimlarga — ko'rsatiladi
        request = self.context.get('request')
        role = (getattr(getattr(request, 'user', None), 'role', '') or '').lower()
        if not obj.reviewer_id or role not in ('reviewer', 'super_admin', 'operator'):
            return None
        return obj.reviewer.get_full_name() or obj.reviewer.phone


class ArticleOperatorMessageSerializer(serializers.ModelSerializer):
    """Muallifga operator ismi yashirin; operatorlar o‘rtasida kim yozgani ko‘rinadi."""

    display_name = serializers.SerializerMethodField()
    is_from_author = serializers.SerializerMethodField()

    class Meta:
        model = ArticleOperatorMessage
        fields = ('id', 'body', 'created_at', 'display_name', 'is_from_author')
        read_only_fields = fields

    def get_is_from_author(self, obj):
        return getattr(obj.sender, 'role', None) == 'author'

    def get_display_name(self, obj):
        request = self.context.get('request')
        viewer = request.user if request and request.user.is_authenticated else None
        sender = obj.sender
        s_role = (getattr(sender, 'role', '') or '').lower()
        if s_role == 'author':
            name = (sender.get_full_name() or '').strip()
            return name or (getattr(sender, 'email', None) or getattr(sender, 'phone', None) or 'Muallif')
        if viewer and (getattr(viewer, 'role', '') or '').lower() == 'author':
            return 'Operator'
        name = (sender.get_full_name() or '').strip()
        return name or 'Operator'
