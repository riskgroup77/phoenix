"""Maqola bo'yicha muallif ↔ operator chati (ArticleViewSet mixin)."""
from django.db.models import Max
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Article, ArticleOperatorMessage
from .serializers import ArticleOperatorMessageSerializer
from apps.notifications.models import Notification
from apps.users.models import User
import logging

logger = logging.getLogger(__name__)


class ArticleOperatorChatMixin:
    """ArticleViewSet: muallif ↔ operator chati."""

    @action(detail=True, methods=['get', 'post'], url_path='operator-chat')
    def operator_chat(self, request, pk=None):
        """Muallif ↔ operatorlar: har bir maqola alohida thread. GET ro‘yxat, POST yangi xabar."""
        article = self.get_object()
        user = request.user
        role = (getattr(user, 'role', '') or '').lower()
        is_author = article.author_id == user.id
        is_operator = role == 'operator'
        if not is_author and not is_operator:
            return Response({'detail': 'Bu chatga kirish huquqingiz yo‘q.'}, status=status.HTTP_403_FORBIDDEN)

        if request.method == 'GET':
            qs = article.operator_messages.select_related('sender').all()
            ser = ArticleOperatorMessageSerializer(qs, many=True, context={'request': request})
            return Response(ser.data)

        body = (request.data.get('body') if isinstance(request.data, dict) else None) or ''
        body = str(body).strip()
        if not body:
            return Response({'detail': 'Xabar matni bo‘sh bo‘lmasligi kerak.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(body) > 10000:
            return Response({'detail': 'Xabar juda uzun (maksimum 10000 belgi).'}, status=status.HTTP_400_BAD_REQUEST)

        if article.author_id == user.id:
            author_post = True
        elif role == 'operator':
            author_post = False
        else:
            return Response({'detail': 'Xabar yuborish huquqingiz yo‘q.'}, status=status.HTTP_403_FORBIDDEN)

        msg = ArticleOperatorMessage.objects.create(article=article, sender=user, body=body)
        preview = (body[:240] + '…') if len(body) > 240 else body
        chat_link = f'/articles/{article.id}'
        try:
            if author_post:
                for op in User.objects.filter(role='operator', is_active=True):
                    Notification.notify(
                        user=op,
                        title='Muallifdan chat xabari',
                        message=f'«{article.title[:120]}» — {preview}',
                        notification_type='article',
                        link=chat_link,
                        metadata={'article_id': str(article.id), 'kind': 'author_operator_chat'},
                    )
            else:
                Notification.notify(
                    user=article.author,
                    title='Operator javobi',
                    message=f'«{article.title[:120]}» — {preview}',
                    notification_type='article',
                    link=chat_link,
                    metadata={'article_id': str(article.id), 'kind': 'author_operator_chat'},
                )
        except Exception as e:
            logger.warning('operator_chat notification failed: %s', e)

        out = ArticleOperatorMessageSerializer(msg, context={'request': request})
        return Response(out.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='operator-chat-inbox')
    def operator_chat_inbox(self, request):
        """So‘nggi faol chatlar: oxirgi xabar vaqti bo‘yicha (faqat operator)."""
        role = (getattr(request.user, 'role', '') or '').lower()
        if role != 'operator':
            return Response({'detail': 'Ruxsat yo‘q.'}, status=status.HTTP_403_FORBIDDEN)
        qs = (
            Article.objects.annotate(last_msg_at=Max('operator_messages__created_at'))
            .filter(last_msg_at__isnull=False)
            .select_related('author', 'journal')
            .order_by('-last_msg_at')[:100]
        )
        data = []
        for a in qs:
            data.append({
                'id': str(a.id),
                'title': a.title,
                'author_name': a.author.get_full_name() if a.author_id else '',
                'journal_name': getattr(a.journal, 'name', '') or '',
                'last_message_at': a.last_msg_at.isoformat() if a.last_msg_at else None,
            })
        return Response(data)
