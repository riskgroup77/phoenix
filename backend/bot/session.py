"""Persistent Telegram ↔ JWT session storage."""
from typing import Any, Optional

from asgiref.sync import sync_to_async

from apps.users.models import TelegramSession, User
from bot.api_client import PhonixApiClient


def _get_session_sync(telegram_id: int) -> Optional[TelegramSession]:
    return TelegramSession.objects.select_related('user').filter(telegram_id=telegram_id).first()


def _save_session_sync(
    telegram_id: int,
    user: User,
    access: str,
    refresh: str,
    telegram_username: str = '',
) -> TelegramSession:
    obj, _ = TelegramSession.objects.update_or_create(
        telegram_id=telegram_id,
        defaults={
            'user': user,
            'access_token': access,
            'refresh_token': refresh,
            'telegram_username': telegram_username or '',
        },
    )
    return obj


def _delete_session_sync(telegram_id: int) -> None:
    TelegramSession.objects.filter(telegram_id=telegram_id).delete()


def _get_user_by_id_sync(user_id) -> Optional[User]:
    try:
        return User.objects.get(id=user_id)
    except User.DoesNotExist:
        return None


get_session = sync_to_async(_get_session_sync)
save_session = sync_to_async(_save_session_sync)
delete_session = sync_to_async(_delete_session_sync)
get_user_by_id = sync_to_async(_get_user_by_id_sync)


async def restore_client(telegram_id: int) -> Optional[PhonixApiClient]:
    row = await get_session(telegram_id)
    if not row:
        return None
    client = PhonixApiClient(row.access_token, row.refresh_token)
    try:
        await sync_to_async(client.profile)()
        return client
    except Exception:
        if client.refresh():
            await save_session(
                telegram_id,
                row.user,
                client.access_token or row.access_token,
                client.refresh_token or row.refresh_token,
                row.telegram_username,
            )
            return client
        await delete_session(telegram_id)
        return None


def apply_client_to_context(context, client: PhonixApiClient, user_data: dict) -> None:
    if context.user_data is None:
        return
    context.user_data['authenticated'] = True
    context.user_data['access'] = client.access_token
    context.user_data['refresh'] = client.refresh_token
    context.user_data['user'] = user_data
    context.user_data['role'] = user_data.get('role', 'author')
    context.user_data['user_id'] = user_data.get('id')


def get_client_from_context(context) -> Optional[PhonixApiClient]:
    if not context.user_data or not context.user_data.get('authenticated'):
        return None
    access = context.user_data.get('access')
    refresh = context.user_data.get('refresh')
    if not access:
        return None
    return PhonixApiClient(access, refresh)


async def persist_login(context, telegram_id: int, login_response: dict, telegram_username: str = '') -> None:
    user = login_response.get('user') or {}
    access = login_response.get('access')
    refresh = login_response.get('refresh')
    if not access or not refresh or not user.get('id'):
        return
    db_user = await get_user_by_id(user['id'])
    if not db_user:
        return
    await save_session(telegram_id, db_user, access, refresh, telegram_username)
    apply_client_to_context(context, PhonixApiClient(access, refresh), user)
