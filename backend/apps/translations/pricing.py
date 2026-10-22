"""Tarjima narxi: tarjima turiga qarab har bir so'z narxi (ServicePrice, bosh admin «Narxlar» da o'zgartiradi)."""
from __future__ import annotations

from .models import TranslationRequest

PRICE_KEYS = {
    TranslationRequest.QUALITY_BASIC: ('translation_per_word_basic', 30),
    TranslationRequest.QUALITY_STANDARD: ('translation_per_word_standard', 60),
    TranslationRequest.QUALITY_EXPERT: ('translation_per_word', 100),
}


def price_per_word(quality: str) -> int:
    from apps.udc.services import get_service_amount

    key, default = PRICE_KEYS.get(quality, PRICE_KEYS[TranslationRequest.QUALITY_EXPERT])
    return int(get_service_amount(key, default))


def all_prices() -> dict[str, int]:
    return {quality: price_per_word(quality) for quality in PRICE_KEYS}
