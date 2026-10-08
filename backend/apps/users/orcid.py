"""ORCID iD tekshiruvi (ISO 7064 Mod 11-2 nazorat raqami) va normallashtirish."""
from __future__ import annotations

import re

_ORCID_RE = re.compile(r'^(\d{4})-?(\d{4})-?(\d{4})-?(\d{3}[\dX])$')


def orcid_checksum_ok(digits16: str) -> bool:
    """digits16: chiziqchasiz 16 belgi (oxirgisi raqam yoki X)."""
    total = 0
    for ch in digits16[:-1]:
        total = (total + int(ch)) * 2
    remainder = total % 11
    result = (12 - remainder) % 11
    expected = 'X' if result == 10 else str(result)
    return digits16[-1] == expected


def normalize_orcid(value: str) -> str:
    """
    '0000-0002-1825-0097', '0000000218250097' yoki 'https://orcid.org/0000-0002-1825-0097'
    → '0000-0002-1825-0097'. Bo'sh qiymat → ''. Noto'g'ri bo'lsa ValueError.
    """
    raw = (value or '').strip()
    if not raw:
        return ''
    raw = re.sub(r'^(https?://)?(www\.)?orcid\.org/', '', raw, flags=re.IGNORECASE).strip().upper()
    m = _ORCID_RE.match(raw)
    if not m:
        raise ValueError("ORCID iD formati: 0000-0000-0000-0000 (16 belgi).")
    digits = ''.join(m.groups())
    if not orcid_checksum_ok(digits):
        raise ValueError("ORCID iD nazorat raqami noto'g'ri. Raqamni orcid.org profilingizdan nusxalang.")
    return '-'.join(m.groups())


def orcid_url(orcid_id: str) -> str:
    return f'https://orcid.org/{orcid_id}' if orcid_id else ''
