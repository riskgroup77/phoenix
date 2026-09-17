"""To'lov havolalari va Telegram inline tugmalari."""
from __future__ import annotations

from typing import Any

from asgiref.sync import sync_to_async
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Message

from bot.api_client import PhonixApiClient
from bot.app_links import dashboard_url, profile_url
from bot.constants import SERVICE_LABELS
from bot.utils import format_money


def app_payments_url(client: PhonixApiClient) -> str:
    return profile_url(client, 'payments')


def app_home_url(client: PhonixApiClient) -> str:
    return dashboard_url(client)


def payment_page_url(client: PhonixApiClient, transaction_id: str) -> str:
    return client.payment_page_url(str(transaction_id))


def payment_button_keyboard(
    client: PhonixApiClient,
    transaction_id: str,
    *,
    amount: Any = None,
    label: str | None = None,
) -> InlineKeyboardMarkup:
    btn_label = label or "💳 To'lov qilish"
    if amount is not None:
        btn_label = f"{btn_label} — {format_money(amount)}"
    return InlineKeyboardMarkup(
        [[InlineKeyboardButton(btn_label, url=payment_page_url(client, transaction_id))]]
    )


def pending_payments_keyboard(client: PhonixApiClient, transactions: list[dict]) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []
    pending = [t for t in transactions if (t.get('status') or '').lower() == 'pending']
    for tx in pending[:8]:
        tx_id = str(tx.get('id', ''))
        if not tx_id:
            continue
        svc = SERVICE_LABELS.get(tx.get('service_type', ''), tx.get('service_type', 'To\'lov'))
        amt = format_money(tx.get('amount'))
        rows.append(
            [InlineKeyboardButton(f"💳 {svc} — {amt}", url=payment_page_url(client, tx_id))]
        )
    rows.append([InlineKeyboardButton("📱 Barcha to'lovlar (ilova)", url=app_payments_url(client))])
    return InlineKeyboardMarkup(rows)


def open_app_keyboard(client: PhonixApiClient) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("📱 Ilovani ochish", url=app_home_url(client))],
            [InlineKeyboardButton("💳 To'lovlar tarixi", url=app_payments_url(client))],
        ]
    )


async def reply_with_payment_button(
    message: Message,
    client: PhonixApiClient,
    transaction_id: str,
    *,
    text: str,
    amount: Any = None,
) -> None:
    """Matn + ilovadagi to'lov sahifasiga ochiladigan inline tugma."""
    await sync_to_async(client.process_payment)(str(transaction_id))
    await message.reply_text(
        text,
        reply_markup=payment_button_keyboard(client, transaction_id, amount=amount),
        disable_web_page_preview=True,
    )
