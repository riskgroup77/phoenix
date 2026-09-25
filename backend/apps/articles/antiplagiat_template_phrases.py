"""Shablon iboralar — umumiy akademik va ilmiy klishe."""
from __future__ import annotations

import re

# Antiplag shablon moduli uchun keng ro'yxat (qisqa namuna + mavjud AI_CLICHES kengaytmasi)
TEMPLATE_PHRASES: tuple[str, ...] = (
    'birinchi navbatda',
    'shu munosabat bilan',
    'xulosa qilib aytganda',
    'mazkur tadqiqotda',
    'zamonaviy sharoitda',
    'muhim ahamiyatga ega',
    'keng qamrovli',
    'nazariy va amaliy',
    'ilmiy-nazariy',
    'dolzarb masala',
    'в настоящее время',
    'в заключение',
    'следует отметить',
    'как известно',
    'it is well known',
    'studies have shown',
    'research indicates',
    'according to recent studies',
    'the purpose of this study',
    'можно сделать вывод',
    'таким образом',
    'в связи с этим',
    'на основании вышеизложенного',
    'учитывая вышеизложенное',
    'в данной работе',
    'целью данной работы является',
    'актуальность темы',
    'объект исследования',
    'предмет исследования',
    'tezisning dolzarbligi',
    'mazkur fan',
    'zamonaviy dunyoda',
)

_COMPILED = tuple(re.compile(re.escape(p), re.IGNORECASE) for p in TEMPLATE_PHRASES if len(p) >= 6)


def find_template_hits_in_sentence(sentence: str) -> list[str]:
    found: list[str] = []
    sl = sentence.lower()
    for phrase in TEMPLATE_PHRASES:
        if len(phrase) >= 6 and phrase.lower() in sl:
            found.append(phrase)
    return found[:5]
