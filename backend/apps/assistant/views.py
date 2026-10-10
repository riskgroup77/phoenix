"""
Muallif AI yordamchisi API (faqat muallif roli, faqat o'z suhbatlari):

    GET  /api/v1/assistant/conversations/                 — suhbatlar ro'yxati
    POST /api/v1/assistant/conversations/                 — yangi suhbat
    GET  /api/v1/assistant/conversations/<id>/            — xabarlar
    PATCH/DELETE /api/v1/assistant/conversations/<id>/    — nomini o'zgartirish / o'chirish
    POST /api/v1/assistant/conversations/<id>/messages/   — xabar (text, lang, ixtiyoriy file) → yordamchi javobi
"""
import logging

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes, throttle_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from apps.assistant import engine
from apps.assistant.files import analyze_upload
from apps.assistant.models import AssistantConversation, AssistantMessage

logger = logging.getLogger(__name__)

MAX_CONVERSATIONS = 200
HISTORY_LIMIT = 200


class IsAuthor(BasePermission):
    message = "AI yordamchi hozircha faqat mualliflar uchun."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and getattr(request.user, 'role', '') == 'author')


class AssistantThrottle(UserRateThrottle):
    scope = 'assistant'
    rate = '40/min'


def _conv_json(c: AssistantConversation) -> dict:
    return {'id': str(c.pk), 'title': c.title or '', 'updated_at': c.updated_at.isoformat(),
            'created_at': c.created_at.isoformat()}


def _msg_json(m: AssistantMessage) -> dict:
    return {'id': m.pk, 'role': m.role, 'text': m.text, 'payload': m.payload or {}, 'created_at': m.created_at.isoformat()}


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated, IsAuthor])
def conversations(request):
    qs = AssistantConversation.objects.filter(user=request.user)
    if request.method == 'GET':
        return Response({'results': [_conv_json(c) for c in qs[:50]]})
    # Eski suhbatlar cheksiz ko'paymasin
    old = list(qs.values_list('pk', flat=True)[MAX_CONVERSATIONS - 1:])
    if old:
        AssistantConversation.objects.filter(pk__in=old).delete()
    title = str(request.data.get('title') or '').strip()[:120]
    conv = AssistantConversation.objects.create(user=request.user, title=title)
    return Response(_conv_json(conv), status=status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated, IsAuthor])
def conversation_detail(request, pk):
    conv = get_object_or_404(AssistantConversation, pk=pk, user=request.user)
    if request.method == 'DELETE':
        conv.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    if request.method == 'PATCH':
        conv.title = str(request.data.get('title') or '').strip()[:120]
        conv.save(update_fields=['title', 'updated_at'])
        return Response(_conv_json(conv))
    msgs = list(conv.messages.all().order_by('-created_at', '-id')[:HISTORY_LIMIT])
    msgs.reverse()
    active = (conv.state or {}).get('active')
    return Response({**_conv_json(conv), 'messages': [_msg_json(m) for m in msgs], 'active': active})


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAuthor])
@throttle_classes([AssistantThrottle])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def send_message(request, pk):
    conv = get_object_or_404(AssistantConversation, pk=pk, user=request.user)
    text = str(request.data.get('text') or '').strip()[:2000]
    lang = str(request.data.get('lang') or 'uz')[:8]
    upload = request.FILES.get('file')
    if not text and not upload:
        return Response({'detail': 'Xabar bo\'sh.'}, status=status.HTTP_400_BAD_REQUEST)

    file_info = None
    file_error = None
    if upload is not None:
        try:
            file_info = analyze_upload(upload)
        except ValueError as exc:
            file_error = str(exc)

    user_msg = AssistantMessage.objects.create(
        conversation=conv, role='user', text=text,
        payload={'file': {'name': upload.name[:200], 'size': upload.size}} if upload is not None else {},
    )

    if file_error:
        reply = {'reply': file_error, 'action': None, 'cards': [], 'suggestions': []}
        new_state = conv.state or {}
    else:
        try:
            reply, new_state = engine.respond(request.user, conv.state or {}, text, file_info=file_info, lang=lang)
        except Exception:
            logger.exception('Assistant engine xatosi')
            reply = {'reply': "Kechirasiz, ichki xatolik yuz berdi. Qayta urinib ko'ring.", 'action': None,
                     'cards': [], 'suggestions': []}
            new_state = conv.state or {}

    bot_msg = AssistantMessage.objects.create(
        conversation=conv, role='assistant', text=reply.get('reply', ''),
        payload={k: v for k, v in reply.items() if k != 'reply' and v},
    )
    conv.state = new_state
    if not conv.title:
        conv.title = (text or (upload.name if upload is not None else ''))[:80]
    conv.save(update_fields=['state', 'title', 'updated_at'])
    return Response({
        'conversation': _conv_json(conv),
        'user_message': _msg_json(user_msg),
        'assistant_message': _msg_json(bot_msg),
        'file_info': file_info,
    })
