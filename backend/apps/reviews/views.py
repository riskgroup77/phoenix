from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.http import HttpResponse
from django.db.models import Count
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import PeerReview
from .serializers import PeerReviewSerializer
from apps.notifications.models import Notification
from apps.users.models import User
import logging

logger = logging.getLogger(__name__)



ACTIVE_REVIEW_STATUSES = ('pending', 'accepted', 'in_progress')


def review_round_for(article) -> int:
    """Taqriz bosqichi: 1 + muallif tahrirdan keyin necha marta qayta yuborgan (Revision → Yangi)."""
    from apps.articles.models import ArticleStatusEvent

    return 1 + ArticleStatusEvent.objects.filter(article=article, from_status='Revision', to_status='Yangi').count()


class PeerReviewViewSet(viewsets.ModelViewSet):
    queryset = PeerReview.objects.select_related('article', 'reviewer').all()
    serializer_class = PeerReviewSerializer
    permission_classes = [IsAuthenticated]
    
    def _role(self):
        role = getattr(self.request.user, 'role', '') or ''
        return role.strip().lower() if isinstance(role, str) else role

    def _can_manage_article(self, article) -> bool:
        """Taqrizchi tayinlash/tahrirlash: bosh admin yoki shu jurnalning admini."""
        role = self._role()
        if role == 'super_admin' or self.request.user.is_superuser:
            return True
        return role == 'journal_admin' and getattr(article.journal, 'journal_admin_id', None) == self.request.user.id

    def get_queryset(self):
        # Eslatma: avval QuerySet Redis'da keshlanardi va mavjud bo'lmagan `created_at` bo'yicha
        # tartiblanardi — butun API 500 qaytarardi. Kesh olib tashlandi (yangi tayinlovlar darhol ko'rinadi).
        user = self.request.user
        role = self._role()
        qs = PeerReview.objects.select_related('article', 'article__journal', 'reviewer').order_by('-assigned_at')
        article_id = self.request.query_params.get('article')
        if article_id:
            try:
                import uuid

                qs = qs.filter(article_id=uuid.UUID(str(article_id)))
            except ValueError:
                return qs.none()
        if role == 'super_admin' or user.is_superuser:
            return qs
        if role == 'journal_admin':
            return qs.filter(article__journal__journal_admin=user)
        if role == 'reviewer':
            return qs.filter(reviewer=user)
        return qs.filter(article__author=user)

    def create(self, request, *args, **kwargs):
        """Taqrizchini faqat bosh admin yoki jurnal admini tayinlaydi."""
        from apps.articles.models import Article

        article_id = request.data.get('article')
        reviewer_id = request.data.get('reviewer')
        try:
            article = Article.objects.select_related('journal').get(pk=article_id)
            reviewer = User.objects.get(pk=reviewer_id, role='reviewer', is_active=True)
        except (Article.DoesNotExist, User.DoesNotExist, ValueError, TypeError, DjangoValidationError):
            return Response({'error': 'Maqola yoki taqrizchi topilmadi.'}, status=status.HTTP_400_BAD_REQUEST)
        if not self._can_manage_article(article):
            return Response({'error': 'Taqrizchi tayinlash huquqingiz yo\'q.'}, status=status.HTTP_403_FORBIDDEN)
        from apps.articles.workflow import is_book_submission

        if is_book_submission(article):
            return Response({'error': "Kitob buyurtmasiga taqrizchi tayinlanmaydi."}, status=status.HTTP_400_BAD_REQUEST)
        # Faqat faol (kutilayotgan / jarayondagi) taqriz takrorlanmasin. Yakunlangan yoki rad etilgan bo'lsa —
        # yangi bosqich: muallif tuzatgan maqolani o'sha taqrizchi qayta ko'rib chiqishi mumkin.
        existing = PeerReview.objects.filter(
            reviewer=reviewer, article=article, status__in=ACTIVE_REVIEW_STATUSES
        ).first()
        if existing:
            return Response({
                'error': 'Bu mutaxassisda ushbu maqola bo\'yicha yakunlanmagan taqriz bor',
                'existing_review_id': str(existing.id),
            }, status=status.HTTP_400_BAD_REQUEST)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer, reviewer=reviewer)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        review = self.get_object()
        if not self._can_manage_article(review.article):
            # Taqrizchi natijani submit_review orqali yuboradi; muallif taqrizni o'zgartira olmaydi
            return Response({'error': 'Taqrizni tahrirlash huquqingiz yo\'q.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        review = self.get_object()
        if not self._can_manage_article(review.article):
            return Response({'error': 'Taqrizni o\'chirish huquqingiz yo\'q.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    @staticmethod
    def _apply_default_deadline(review):
        if review.deadline is None:
            # Muddat ko'rsatilmasa — standart SLA (settings.REVIEW_SLA_DAYS['peer_review'])
            from datetime import timedelta
            from apps.analytics.sla import sla_days

            review.deadline = review.assigned_at + timedelta(days=sla_days('peer_review'))
            review.save(update_fields=['deadline'])

    def perform_create(self, serializer, reviewer=None):
        review = serializer.save(reviewer=reviewer, round_number=review_round_for(serializer.validated_data['article']))
        self._apply_default_deadline(review)

        # Taqrizchi tayinlanishi bilan maqola "Ko'rib chiqilmoqda" (QabulQilingan) holatiga o'tadi
        article = review.article
        if article.status in ('Yangi', 'WithEditor'):
            article.status = 'QabulQilingan'
            article._status_note = 'Maqola taqrizga yuborildi.'
            article.save(update_fields=['status'])

        # Notify reviewer if assigned by admin
        if review.reviewer != self.request.user:
            try:
                Notification.notify(
                    user=review.reviewer,
                    title='Yangi taqriz tayinlandi',
                    message=f'Sizga "{review.article.title}" maqolasini taqrizlash tayinlandi.',
                    notification_type='review_assigned',
                    link=f'/articles/{review.article.id}',
                    metadata={'review_id': str(review.id), 'article_id': str(review.article.id)},
                )
            except Exception as e:
                logger.warning(f"Failed to send review assignment notification: {e}")


    @action(detail=True, methods=['post'])
    def accept_review(self, request, pk=None):
        """Reviewer accepts - Optimized with cache clear"""
        review = self.get_object()
        if review.reviewer != request.user:
            return Response({'error': 'Bu taqriz sizga tegishli emas'}, status=status.HTTP_403_FORBIDDEN)
        
        if review.status not in ('pending', 'accepted'):
            return Response({'error': "Bu taqrizni qabul qilib bo'lmaydi."}, status=status.HTTP_400_BAD_REQUEST)
        review.status = 'in_progress'
        review.save(update_fields=['status'])
        return Response({'status': 'in_progress'})

    @action(detail=True, methods=['post'])
    def decline_review(self, request, pk=None):
        """Reviewer declines - With reason and notifications"""
        review = self.get_object()
        if review.reviewer != request.user:
            return Response({'error': 'Bu taqriz sizga tegishli emas'}, status=status.HTTP_403_FORBIDDEN)
        
        if review.status == 'completed':
            return Response({'error': "Yakunlangan taqrizni rad etib bo'lmaydi."}, status=status.HTTP_400_BAD_REQUEST)
        if review.status == 'declined':
            return Response({'error': 'Bu taqriz allaqachon rad etilgan.'}, status=status.HTTP_400_BAD_REQUEST)
        reason = str(request.data.get('reason', '') or '')[:1000]
        review.status = 'declined'
        review.save(update_fields=['status'])

        # Notify admin/editor
        try:
            if review.article.journal and review.article.journal.journal_admin:
                Notification.notify(
                    user=review.article.journal.journal_admin,
                    title='Taqriz rad etildi',
                    message=f'{review.reviewer.get_full_name()} "{review.article.title}" maqolasini taqrizlashni rad etdi. Sabab: {reason or "Belgilanmagan"}',
                    notification_type='system',
                    link=f'/articles/{review.article.id}',
                    metadata={'review_id': str(review.id), 'article_id': str(review.article.id)},
                )
        except Exception as e:
            logger.warning(f"Failed to send decline notification: {e}")
        
        return Response({'status': 'declined', 'reason': reason})

    @action(detail=True, methods=['post'])
    def submit_review(self, request, pk=None):
        """Submit completed review - Optimized with validation and duplicate prevention"""
        review = self.get_object()
        if review.reviewer != request.user:
            return Response({'error': 'Bu taqriz sizga tegishli emas'}, status=status.HTTP_403_FORBIDDEN)
        
        # PREVENT DUPLICATE SUBMISSION
        if review.status == 'completed':
            return Response({
                'error': 'Taqriz allaqachon yakunlangan',
                'warning': 'Takroriy yuborish aniqlandi'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        data = request.data
        
        # Validate required fields
        required_fields = ['review_content', 'recommendation']
        missing = [f for f in required_fields if not data.get(f)]
        if missing:
            return Response({
                'error': f'Majburiy maydonlar: {", ".join(missing)}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if review.status == 'declined':
            return Response({'error': "Rad etilgan taqrizni yuborib bo'lmaydi."}, status=status.HTTP_400_BAD_REQUEST)
        valid_recs = {c[0] for c in PeerReview.RECOMMENDATION_CHOICES}
        if data.get('recommendation') not in valid_recs:
            return Response({'error': "Tavsiya noto'g'ri."}, status=status.HTTP_400_BAD_REQUEST)

        def _score(name):
            try:
                return max(0, min(10, int(data.get(name, 0) or 0)))
            except (TypeError, ValueError):
                return 0

        review.review_content = data.get('review_content', review.review_content)
        review.recommendation = data.get('recommendation')
        review.originality_score = _score('originality_score')
        review.methodology_score = _score('methodology_score')
        review.clarity_score = _score('clarity_score')
        review.significance_score = _score('significance_score')
        review.references_score = _score('references_score')
        review.strengths = data.get('strengths', '')
        review.weaknesses = data.get('weaknesses', '')
        review.comments_to_author = data.get('comments_to_author', '')
        review.comments_to_editor = data.get('comments_to_editor', '')
        review.rating = review.overall_score
        review.status = 'completed'
        review.completed_at = timezone.now()
        review.save()
        
        # Update reviewer stats
        reviewer = review.reviewer
        reviewer.reviews_completed += 1
        # Recalculate average time
        if review.assigned_at and review.completed_at:
            days_taken = (review.completed_at - review.assigned_at).total_seconds() / 86400
            total_reviews = reviewer.reviews_completed
            old_avg = reviewer.average_review_time * (total_reviews - 1)
            reviewer.average_review_time = (old_avg + days_taken) / total_reviews
        reviewer.save(update_fields=['reviews_completed', 'average_review_time'])

        # Notify article author
        try:
            Notification.notify(
                user=review.article.author,
                title='Taqriz yakunlandi',
                message=f'"{review.article.title}" maqolangiz uchun taqriz yakunlandi.',
                notification_type='review_completed',
                link=f'/articles/{review.article.id}',
                metadata={'review_id': str(review.id), 'article_id': str(review.article.id)},
            )
        except Exception as e:
            logger.warning(f"Failed to send review completion notification: {e}")

        # Notify journal admin
        try:
            if review.article.journal and review.article.journal.journal_admin:
                Notification.notify(
                    user=review.article.journal.journal_admin,
                    title='Taqriz yakunlandi',
                    message=(
                        f'"{review.article.title}" maqolasi uchun taqriz yakunlandi. Tavsiya: '
                        f'{review.get_recommendation_display() if review.recommendation else "Belgilanmagan"}. '
                        "Taqrizchi maqolani nashrgacha o'zi olib boradi — sizning tasdig'ingiz shart emas."
                    ),
                    notification_type='review_completed',
                    link=f'/articles/{review.article.id}',
                    metadata={'review_id': str(review.id)},
                )
        except Exception as e:
            logger.warning(f"Failed to send admin review notification: {e}")

        return Response(PeerReviewSerializer(review).data)
    
    @action(detail=False, methods=['get'], url_path='find-specialists')
    def find_specialists(self, request):
        """
        Taqrizchi tanlash uchun faol taqrizchilar ro'yxati, mutaxassislikka moslik bo'yicha saralangan.
        ?specializations=a,b (ixtiyoriy) — bo'sh bo'lsa hammasi tajriba bo'yicha; ?article=<id> — o'sha maqolaga
        allaqachon tayinlanganlar belgilanadi.
        Avval JSONField'da mavjud bo'lmagan `__overlap` ishlatilib hech kim topilmas, telefon/email ham qaytardi.
        """
        if self._role() not in ('super_admin', 'journal_admin') and not request.user.is_superuser:
            return Response({'error': "Huquq yo'q."}, status=status.HTTP_403_FORBIDDEN)
        specializations = [
            s.strip() for s in (request.query_params.get('specializations', '') or '').split(',') if s.strip()
        ]
        query = (request.query_params.get('q') or '').strip().lower()
        assigned = {}
        article_id = request.query_params.get('article')
        if article_id:
            try:
                import uuid

                # Eng so'nggi taqriz holati (bir taqrizchida bir necha bosqich bo'lishi mumkin)
                assigned = dict(
                    PeerReview.objects.filter(article_id=uuid.UUID(str(article_id)))
                    .order_by('assigned_at')
                    .values_list('reviewer_id', 'status')
                )
            except ValueError:
                assigned = {}
        active_load = dict(
            PeerReview.objects.filter(status__in=('pending', 'accepted', 'in_progress'))
            .values('reviewer_id').annotate(n=Count('id')).values_list('reviewer_id', 'n')
        )
        result = []
        for reviewer in User.objects.filter(role='reviewer', is_active=True):
            specs = reviewer.specializations if isinstance(reviewer.specializations, list) else []
            name = reviewer.get_full_name()
            if query and query not in name.lower() and not any(query in str(sp).lower() for sp in specs):
                continue
            result.append({
                'id': str(reviewer.id),
                'full_name': name,
                'affiliation': reviewer.affiliation or '',
                'specializations': specs,
                'reviews_completed': reviewer.reviews_completed,
                'average_review_time': reviewer.average_review_time,
                'acceptance_rate': reviewer.acceptance_rate,
                'active_reviews': active_load.get(reviewer.id, 0),
                # Faqat faol taqriz bo'lsa qayta tayinlab bo'lmaydi; yakunlagan taqrizchi keyingi bosqichga tanlanadi
                'already_assigned': assigned.get(reviewer.id) in ACTIVE_REVIEW_STATUSES,
                'reviewed_before': assigned.get(reviewer.id) == 'completed',
                'assigned_status': assigned.get(reviewer.id),
                'match_score': self._calculate_match_score(reviewer, specializations) if specializations else min(reviewer.reviews_completed, 20),
            })
        result.sort(key=lambda x: (-x['match_score'], x['active_reviews'], x['full_name']))
        return Response(result[:100])

    def _calculate_match_score(self, reviewer, target_specializations):
        """Calculate match score (0-100) for reviewer specialization"""
        score = 0
        reviewer_specs = [str(s).lower() for s in (reviewer.specializations if isinstance(reviewer.specializations, list) else [])]
        target_specs = [s.lower() for s in target_specializations]
        
        # Exact match: +30 points per specialization
        exact_matches = len(set(reviewer_specs) & set(target_specs))
        score += exact_matches * 30
        
        # Partial match: +15 points
        for target in target_specs:
            for spec in reviewer_specs:
                if target in spec or spec in target:
                    score += 15
                    break
        
        # Experience bonus: +1 per review (max 20)
        score += min(reviewer.reviews_completed, 20)
        
        # Acceptance rate bonus: +10 if >80%
        if reviewer.acceptance_rate > 80:
            score += 10
        
        # Speed bonus: +5 if avg time < 7 days
        if reviewer.average_review_time < 7:
            score += 5
        
        return min(score, 100)
    
    @action(detail=False, methods=['post'], url_path='bulk-assign')
    def bulk_assign_reviewers(self, request):
        """
        Bulk assign multiple reviewers - Prevents conflicts and duplicates
        """
        article_id = request.data.get('article_id')
        reviewer_ids = request.data.get('reviewer_ids', [])
        
        if not article_id or not reviewer_ids:
            return Response({
                'error': 'article_id va reviewer_ids majburiy'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        from apps.articles.models import Article
        try:
            article = Article.objects.select_related('journal').get(id=article_id)
        except (Article.DoesNotExist, ValueError, DjangoValidationError):
            return Response({'error': 'Maqola topilmadi'}, status=status.HTTP_404_NOT_FOUND)
        if not self._can_manage_article(article):
            return Response({'error': "Taqrizchi tayinlash huquqingiz yo'q."}, status=status.HTTP_403_FORBIDDEN)
        
        assigned = []
        failed = []
        already_assigned = []
        
        for reviewer_id in reviewer_ids:
            try:
                reviewer = User.objects.get(id=reviewer_id, role='reviewer', is_active=True)
                
                # Check if already assigned (PREVENT DUPLICATE)
                existing = PeerReview.objects.filter(
                    article=article,
                    reviewer=reviewer,
                    status__in=ACTIVE_REVIEW_STATUSES,
                ).first()
                
                if existing:
                    already_assigned.append({
                        'reviewer_id': reviewer_id,
                        'review_id': str(existing.id),
                        'status': existing.status
                    })
                    continue
                
                # Create new assignment
                review = PeerReview.objects.create(
                    article=article,
                    reviewer=reviewer,
                    round_number=review_round_for(article),
                    status='pending',
                    assigned_at=timezone.now()
                )
                self._apply_default_deadline(review)
                
                assigned.append({
                    'review_id': str(review.id),
                    'reviewer': reviewer.get_full_name(),
                    'status': review.status
                })
                
                # Send notification
                try:
                    Notification.notify(
                        user=reviewer,
                        title='Yangi taqriz tayinlandi',
                        message=f'Sizga "{article.title}" maqolasini taqrizlash tayinlandi.',
                        notification_type='review_assigned',
                        link=f'/articles/{article.id}',
                    )
                except Exception as e:
                    logger.warning(f"Notification failed: {e}")
                
            except User.DoesNotExist:
                failed.append({'reviewer_id': reviewer_id, 'error': 'Reviewer topilmadi'})
            except Exception as e:
                failed.append({'reviewer_id': reviewer_id, 'error': str(e)})

        return Response({
            'success': True,
            'assigned': assigned,
            'already_assigned': already_assigned,
            'failed': failed,
            'total_assigned': len(assigned),
            'message': f'{len(assigned)} taqrizchi muvaffaqiyatli tayinlandi'
        })

    @action(detail=True, methods=['get'], url_path='review-document')
    def review_document(self, request, pk=None):
        """Taqriz natijasini matn fayl sifatida yuklab olish (muallif uchun)."""
        review = self.get_object()
        ur = getattr(request.user, 'role', '') or ''
        if isinstance(ur, str):
            ur = ur.strip().lower()
        if review.article.author_id != request.user.id and ur not in ('super_admin', 'journal_admin'):
            return Response({'error': 'Huquq yo\'q.'}, status=status.HTTP_403_FORBIDDEN)
        # Yopiq (blind) taqrizda taqrizchi shaxsi muallifga oshkor qilinmaydi
        show_reviewer = review.review_type == 'open' or ur in ('super_admin', 'journal_admin')
        reviewer_label = (review.reviewer.get_full_name() if review.reviewer else '') if show_reviewer else 'Anonim taqrizchi'
        lines = [
            f"Maqola: {review.article.title}",
            f"Taqrizchi: {reviewer_label}",
            f"Yakunlangan: {review.completed_at.strftime('%Y-%m-%d %H:%M') if review.completed_at else ''}",
            "",
            "--- Taqriz matni ---",
            review.review_content or "(yo'q)",
            "",
            "--- Muallifga izohlar ---",
            review.comments_to_author or "(yo'q)",
            "",
            "--- Kuchli tomonlar ---",
            review.strengths or "(yo'q)",
            "",
            "--- Zaif tomonlar ---",
            review.weaknesses or "(yo'q)",
            "",
            "--- Ballar ---",
            f"Originality: {review.originality_score}, Methodology: {review.methodology_score}",
            f"Clarity: {review.clarity_score}, Significance: {review.significance_score}, References: {review.references_score}",
            f"Umumiy: {review.rating}",
        ]
        if review.recommendation:
            rec_display = getattr(review, 'get_recommendation_display', lambda: review.recommendation)()
            lines.append(f"\nTavsiya: {rec_display}")
        text = "\n".join(lines)
        response = HttpResponse(text, content_type='text/plain; charset=utf-8')
        safe_title = "".join(c for c in (review.article.title or "")[:50] if c.isalnum() or c in " _-").strip() or "maqola"
        response['Content-Disposition'] = f'attachment; filename="taqriz_{safe_title}_{review.id}.txt"'
        return response
