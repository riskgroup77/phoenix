"""Maqola nashr jarayoni amallari (ArticleViewSet mixin): update_status, crossref, complete_publication va h.k."""
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Article, ActivityLog
from .serializers import ArticleSerializer
from apps.notifications.models import Notification
from .views_antiplagiat import _check_plagiarism_thresholds
import logging

logger = logging.getLogger(__name__)


class ArticlePublicationActionsMixin:
    """ArticleViewSet: ko'rish/yuklash hisoblagichlari, holatni o'zgartirish, Crossref, nashrni yakunlash."""

    @action(detail=True, methods=['post'])
    def increment_views(self, request, pk=None):
        """Increment article views"""
        article = self.get_object()
        article.increment_views()
        return Response({'views': article.views_count})
    
    @action(detail=True, methods=['post'])
    def increment_downloads(self, request, pk=None):
        """Increment article downloads"""
        article = self.get_object()
        article.increment_downloads()
        return Response({'downloads': article.downloads_count})
    
    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        """Update article status. Author: own; super_admin: any; journal_admin: only own journal."""
        article = self.get_object()
        new_status = request.data.get('status')
        if self._is_super_admin():
            pass
        elif request.user.role == 'journal_admin':
            if article.journal.journal_admin_id != request.user.id:
                return Response(
                    {'error': 'Siz faqat o\'z jurnalingizdagi maqolalarni yangilashingiz mumkin'},
                    status=status.HTTP_403_FORBIDDEN
                )
        elif article.author_id == request.user.id:
            # Muallif faqat tahrirga qaytarilgan maqolasini qayta yuborishi mumkin.
            # (Aks holda o'z maqolasini to'lovsiz "Qabul qilingan"/"Nashr etilgan" qila olardi.)
            if not (article.status == 'Revision' and new_status == 'Yangi'):
                return Response(
                    {'error': 'Muallif maqola holatini o\'zgartira olmaydi (faqat tahrirdan keyin qayta yuborish mumkin).'},
                    status=status.HTTP_403_FORBIDDEN
                )
        else:
            return Response(
                {'error': 'Siz bu maqolani yangilash huquqiga ega emassiz'},
                status=status.HTTP_403_FORBIDDEN
            )

        
        if not new_status:
            return Response({'error': 'Status kiritilishi shart'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate status value
        valid_statuses = [choice[0] for choice in Article.STATUS_CHOICES]
        if new_status not in valid_statuses:
            return Response(
                {'error': f'Noto\'g\'ri status. Ruxsat etilgan statuslar: {", ".join(valid_statuses)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        old_status = article.status
        final_status = new_status
        # Antiplagiat tekshiruvi faqat jurnal admin "Nashrga yuborilgan" qilganda. Bosh admin qabul qilsa qayta tekshirilmaydi.
        if new_status == 'NashrgaYuborilgan' and getattr(request.user, 'role', None) != 'super_admin':
            article.journal.refresh_from_db()
            decision, reason = _check_plagiarism_thresholds(article)
            if decision == 'reject':
                final_status = 'Rejected'
                article.status = final_status
                article._status_note = reason or "Plagiat / AI / originalilik bo'yicha jurnal talablariga mos kelmadi."
                article.save()
                ActivityLog.objects.create(
                    article=article,
                    user=request.user,
                    action='Status: NashrgaYuborilgan → Rejected (antipiagiat talablar bajarilmadi)',
                    details=reason or 'Plagiat / AI / originalilik bo\'yicha jurnal talablariga mos kelmadi.'
                )
                try:
                    Notification.notify(
                        user=article.author,
                        title='Maqola rad etildi',
                        message=f'"{article.title}" jurnal talablariga ko\'ra rad etildi: plagiat, AI kontent yoki originalilik chegarasiga mos kelmadi.',
                        notification_type='plagiarism',
                        link=f'/articles/{article.id}',
                        metadata={'article_id': str(article.id), 'reason': reason},
                    )
                except Exception as e:
                    logger.warning(f"Notify author reject: {e}")
                return Response({
                    'status': 'success',
                    'new_status': final_status,
                    'plagiarism_check': 'rejected',
                    'reason': reason,
                })
            if decision == 'review':
                final_status = 'PlagiarismReview'
                article.status = final_status
                article._status_note = reason or ''
                article.save()
                ActivityLog.objects.create(
                    article=article,
                    user=request.user,
                    action='Status: Antiplagiat ko\'rib chiqish (bosh admin qarori kutilmoqda)',
                    details=reason or 'Qisman talablar bajarildi. Bosh administrator qabul/rad qiladi.'
                )
                from django.contrib.auth import get_user_model
                User = get_user_model()
                super_admins = list(User.objects.filter(role='super_admin'))
                journal_admin = getattr(article.journal, 'journal_admin', None)
                link = f'/articles/{article.id}'
                for u in super_admins:
                    try:
                        Notification.notify(
                            user=u,
                            title='Antiplagiat: bosh admin qarori kerak',
                            message=f'Maqola "{article.title}" — plagiat/AI/originalilik talablari qisman bajarildi. Qabul yoki rad qiling.',
                            notification_type='plagiarism',
                            link=link,
                            metadata={'article_id': str(article.id), 'reason': reason},
                        )
                    except Exception as e:
                        logger.warning(f"Notify super_admin: {e}")
                if journal_admin and journal_admin not in super_admins:
                    try:
                        Notification.notify(
                            user=journal_admin,
                            title='Antiplagiat ko\'rib chiqish',
                            message=f'Maqola "{article.title}" bosh administrator qaroriga yuborildi (plagiat/AI/originalilik).',
                            notification_type='article',
                            link=link,
                            metadata={'article_id': str(article.id)},
                        )
                    except Exception as e:
                        logger.warning(f"Notify journal_admin: {e}")
                return Response({
                    'status': 'success',
                    'new_status': final_status,
                    'plagiarism_check': 'review',
                    'reason': reason,
                })
            # decision == 'accept': final_status stays NashrgaYuborilgan

        reason_text = request.data.get('reason', '') or ''
        article.status = final_status
        article._status_note = reason_text
        article.save()

        ActivityLog.objects.create(
            article=article,
            user=request.user,
            action=f'Status changed from {old_status} to {final_status}',
            details=reason_text
        )

        status_labels = dict(Article.STATUS_CHOICES)
        new_label = status_labels.get(final_status, final_status)
        notif_metadata = {'article_id': str(article.id), 'old_status': old_status, 'new_status': final_status}
        if final_status == 'Revision' and reason_text:
            notif_metadata['revision_reason'] = reason_text
        if final_status == 'Rejected' and reason_text:
            notif_metadata['rejection_reason'] = reason_text
        if final_status == 'Revision':
            notif_title = 'Maqola tahrirga qaytarildi'
            notif_message = f'"{article.title}" maqolangiz tahrirga qaytarildi.'
            if reason_text:
                notif_message += f' Sabab: {reason_text}'
            else:
                notif_message += ' Tahrirlash uchun maqola sahifasidagi izohni ko\'ring.'
        elif final_status == 'Rejected':
            notif_title = 'Maqola rad etildi'
            notif_message = f'"{article.title}" maqolangiz rad etildi.'
            if reason_text:
                notif_message += f' Sabab: {reason_text}'
            else:
                notif_message += ' Batafsil maqola sahifasidagi izohni ko\'ring.'
        else:
            notif_title = 'Maqola holati yangilandi'
            notif_message = f'"{article.title}" maqolangiz holati "{new_label}" ga o\'zgartirildi.'
        try:
            Notification.notify(
                user=article.author,
                title=notif_title,
                message=notif_message,
                notification_type='status_change',
                link=f'/articles/{article.id}',
                metadata=notif_metadata,
            )
        except Exception as e:
            logger.warning(f"Failed to send status notification: {e}")
        
        return Response({'status': 'success', 'new_status': final_status})

    @action(detail=True, methods=['get', 'post'], url_path='crossref')
    def crossref(self, request, pk=None):
        """
        Crossref DOI: GET — depozit XML (yuklab olish), POST — Crossref'ga yuborish.
        Faqat nashr etilgan maqola; bosh admin yoki shu jurnal admini.
        """
        from django.http import HttpResponse
        from .crossref import CrossrefError, build_deposit_xml, crossref_configured, deposit, normalized_doi, suggested_doi

        article = self.get_object()
        role = self._user_role()
        allowed = role == 'super_admin' or request.user.is_superuser or (
            role == 'journal_admin' and article.journal and article.journal.journal_admin_id == request.user.id
        )
        if not allowed:
            return Response({'detail': "Ruxsat yo'q."}, status=status.HTTP_403_FORBIDDEN)
        if article.status != 'Published':
            return Response({'detail': 'Crossref faqat nashr etilgan maqola uchun.'}, status=status.HTTP_400_BAD_REQUEST)
        from config.demo import is_demo_article

        if is_demo_article(article):
            return Response({'detail': "Namuna (demo) maqola uchun DOI berilmaydi."}, status=status.HTTP_400_BAD_REQUEST)

        if request.method == 'GET':
            if request.query_params.get('info'):
                return Response({
                    'configured': crossref_configured(),
                    'doi': normalized_doi(article),
                    'suggested_doi': suggested_doi(article),
                })
            try:
                xml = build_deposit_xml(article)
            except CrossrefError as exc:
                return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            response = HttpResponse(xml, content_type='application/xml; charset=utf-8')
            response['Content-Disposition'] = f'attachment; filename="crossref-{str(article.pk)[:8]}.xml"'
            return response

        try:
            result = deposit(article)
        except CrossrefError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        if not normalized_doi(article) and result.get('doi'):
            article.doi = result['doi'][:100]
            article.save(update_fields=['doi'])
        ActivityLog.objects.create(
            article=article,
            user=request.user,
            action='Crossref DOI depozit yuborildi',
            details=f"DOI: {result.get('doi', '')}",
        )
        return Response({'status': 'success', 'doi': result.get('doi'), 'message': "Crossref'ga yuborildi. Ro'yxatga olish odatda bir necha daqiqa davom etadi."})

    @action(detail=True, methods=['post'])
    def complete_publication(self, request, pk=None):
        """
        Nashr qilish: sertifikat faylini yuklash, statusni Published qilish, muallifga bildirishnoma.
        Only for journal_admin (own journal) or super_admin. Article must be Accepted.
        Expects multipart: certificate (file, PDF or JPG), optional issue_id.
        """
        article = self.get_object()
        role_cp = getattr(request.user, 'role', None) or ''
        if isinstance(role_cp, str):
            role_cp = role_cp.strip().lower()
        if role_cp == 'super_admin':
            pass
        elif role_cp == 'journal_admin':
            if article.journal.journal_admin_id != request.user.id:
                return Response(
                    {'error': 'Siz faqat o\'z jurnalingizdagi maqolalarni nashr qilishingiz mumkin'},
                    status=status.HTTP_403_FORBIDDEN
                )
        else:
            return Response(
                {'error': 'Siz bu maqolani nashr qilish huquqiga egasiz'},
                status=status.HTTP_403_FORBIDDEN
            )
        if article.status != 'Accepted':
            return Response(
                {'error': 'Faqat "Qabul qilingan" holatidagi maqolani nashr qilish mumkin'},
                status=status.HTTP_400_BAD_REQUEST
            )
        certificate_file = request.FILES.get('certificate')
        if not certificate_file:
            return Response(
                {'error': 'Sertifikat fayli (PDF yoki JPG) yuklanishi shart'},
                status=status.HTTP_400_BAD_REQUEST
            )
        allowed_content_types = (
            'application/pdf',
            'image/jpeg',
            'image/jpg',
            'image/png',
        )
        if certificate_file.content_type not in allowed_content_types:
            return Response(
                {'error': 'Sertifikat faqat PDF yoki JPG (yoki PNG) formatida bo\'lishi kerak'},
                status=status.HTTP_400_BAD_REQUEST
            )
        issue_id = request.data.get('issue_id') or request.POST.get('issue_id')
        if issue_id:
            from apps.journals.models import Issue
            try:
                issue = Issue.objects.get(id=issue_id, journal=article.journal)
                article.issue = issue
            except Issue.DoesNotExist:
                pass
        publication_url = (request.data.get('publication_url') or request.POST.get('publication_url') or '').strip()
        if publication_url:
            article.publication_url = publication_url
        article.publication_certificate_path = certificate_file
        article.status = 'Published'
        article.published_by = request.user
        article.save()
        if article.publication_certificate_path:
            article.publication_certificate_url = article.publication_certificate_path.url
            article.save(update_fields=['publication_certificate_url'])
        ActivityLog.objects.create(
            article=article,
            user=request.user,
            action='Nashr qilindi — muallifga tayyor deb yuborildi',
            details='Sertifikat yuklandi, status: Nashr etilgan.'
        )
        try:
            Notification.notify(
                user=article.author,
                title='Maqolangiz tayyor',
                message=f'"{article.title}" maqolangiz nashr qilindi va tayyor. Sertifikatni maqola sahifasidan yuklab olishingiz mumkin.',
                notification_type='article',
                link=f'/articles/{article.id}',
                metadata={'article_id': str(article.id), 'status': 'Published'},
            )
        except Exception as e:
            logger.warning("Complete publication notify author failed: %s", e)
        return Response({
            'status': 'success',
            'new_status': 'Published',
            'message': 'Nashr qilindi. Muallifga bildirishnoma yuborildi.',
        })

    @action(detail=True, methods=['post'])
    def send_publication_delivery(self, request, pk=None):
        """
        Nashr etilgan maqola: nashr havolasi va/yoki sertifikat faylini yangilash, muallifga bildirishnoma.
        Faqat super_admin yoki o'sha jurnalning journal_admin'i.
        Kamida bittasi kerak: publication_url yoki certificate fayli.
        """
        article = self.get_object()
        role = getattr(request.user, 'role', None) or ''
        if isinstance(role, str):
            role = role.strip().lower()
        if role == 'super_admin':
            pass
        elif role == 'journal_admin':
            if article.journal.journal_admin_id != request.user.id:
                return Response(
                    {'error': 'Siz faqat o\'z jurnalingizdagi maqolalarni boshqarishingiz mumkin'},
                    status=status.HTTP_403_FORBIDDEN
                )
        else:
            return Response(
                {'error': 'Sizda bu amalni bajarish huquqi yo\'q'},
                status=status.HTTP_403_FORBIDDEN
            )
        if article.status != 'Published':
            return Response(
                {'error': 'Faqat "Nashr etilgan" holatidagi maqolalar uchun'},
                status=status.HTTP_400_BAD_REQUEST
            )
        publication_url = (request.data.get('publication_url') or request.POST.get('publication_url') or '').strip()
        certificate_file = request.FILES.get('certificate')
        if not publication_url and not certificate_file:
            return Response(
                {'error': 'Kamida bittasi kerak: nashr havolasi (URL) yoki sertifikat fayli'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if certificate_file:
            allowed_content_types = (
                'application/pdf',
                'image/jpeg',
                'image/jpg',
                'image/png',
            )
            if certificate_file.content_type not in allowed_content_types:
                return Response(
                    {'error': 'Sertifikat faqat PDF yoki JPG (PNG) formatida bo\'lishi kerak'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            article.publication_certificate_path = certificate_file
        if publication_url:
            article.publication_url = publication_url[:500]
        article.save()
        if certificate_file and article.publication_certificate_path:
            try:
                article.publication_certificate_url = article.publication_certificate_path.url
                article.save(update_fields=['publication_certificate_url'])
            except Exception as e:
                logger.warning('send_publication_delivery certificate URL sync failed: %s', e)
        ActivityLog.objects.create(
            article=article,
            user=request.user,
            action='Nashr havolasi/sertifikat yangilandi',
            details='Muallifga bildirishnoma yuborildi.',
        )
        try:
            Notification.notify(
                user=article.author,
                title='Maqolangiz bo\'yicha yangilanish',
                message=(
                    f'"{article.title}" maqolangiz uchun nashr havolasi yoki sertifikat yangilandi. '
                    f'Maqola sahifasidan ko\'ring.'
                ),
                notification_type='article',
                link=f'/articles/{article.id}',
                metadata={'article_id': str(article.id), 'status': 'Published'},
            )
        except Exception as e:
            logger.warning('send_publication_delivery notify failed: %s', e)
        serializer = ArticleSerializer(article, context={'request': request})
        return Response({
            'status': 'success',
            'message': 'Saqlandi. Muallifga bildirishnoma yuborildi.',
            'article': serializer.data,
        })
