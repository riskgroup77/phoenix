"""O'zbek kirill → lotin transliteratsiyasi (UDK kitobi kirillda, mualliflar asosan lotinda yozadi)."""
import re

_MAP = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'ё': 'yo', 'ж': 'j', 'з': 'z', 'и': 'i', 'й': 'y',
    'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'x', 'ч': 'ch', 'ш': 'sh', 'щ': 'sh', 'ъ': '’', 'ы': 'i', 'ь': '', 'э': 'e',
    'ю': 'yu', 'я': 'ya', 'ў': 'o‘', 'қ': 'q', 'ғ': 'g‘', 'ҳ': 'h',
}
_VOWELS = set('аеёиоуўэюяъь')


def _letter(prev: str, ch: str) -> str:
    low = ch.lower()
    if low == 'е':
        out = 'ye' if (not prev or not prev.isalpha() or prev.lower() in _VOWELS) else 'e'
    elif low == 'ц':
        out = 's' if (not prev or not prev.isalpha()) else 'ts'
    elif low in _MAP:
        out = _MAP[low]
    else:
        return ch
    return out.capitalize() if ch.isupper() and out else out


def cyr_to_latin(text: str) -> str:
    if not text:
        return ''
    out = []
    prev = ''
    for ch in text:
        out.append(_letter(prev, ch))
        prev = ch
    res = ''.join(out)
    # BUTUNLAY KATTA so'zlar (masalan "ТАЪЛИМ") — "TA’LIM", "ShAHAR" emas "SHAHAR"
    return re.sub(r'\b\w*[A-Z]\w*[A-Z]\w*\b', lambda m: m.group(0).upper(), res)
