"""Shared utilities for the author Telegram bot."""
import json
import re
from typing import Any


def normalize_phone(raw: str) -> str:
    digits = ''.join(c for c in str(raw or '').strip() if c.isdigit())
    if len(digits) == 9:
        digits = '998' + digits
    elif len(digits) == 10 and digits.startswith('9'):
        digits = '998' + digits[1:]
    elif len(digits) > 12:
        digits = digits[-12:]
    return digits


def format_money(amount: Any) -> str:
    try:
        n = float(amount)
    except (TypeError, ValueError):
        return '0 so\'m'
    return f"{int(n):,}".replace(',', ' ') + " so'm"


def parse_keywords(text: str) -> list[str]:
    return [k.strip() for k in re.split(r'[,;]', text or '') if k.strip()]


def truncate(text: str, max_len: int = 200) -> str:
    text = (text or '').strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 1] + '…'


def api_list(data: Any) -> list:
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        if isinstance(data.get('results'), list):
            return data['results']
        if isinstance(data.get('data'), list):
            return data['data']
        if isinstance(data.get('items'), list):
            return data['items']
    return []


def format_api_error(err: Exception) -> str:
    msg = str(err)
    if hasattr(err, 'response') and err.response:
        try:
            body = err.response if isinstance(err.response, dict) else json.loads(str(err.response))
            if isinstance(body, dict):
                if body.get('detail'):
                    return str(body['detail'])
                parts = []
                for k, v in body.items():
                    if isinstance(v, list):
                        parts.append(f"{k}: {', '.join(str(x) for x in v)}")
                    else:
                        parts.append(f"{k}: {v}")
                if parts:
                    return '; '.join(parts)
        except Exception:
            pass
    return msg or 'Noma\'lum xatolik'
