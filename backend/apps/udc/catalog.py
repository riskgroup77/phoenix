"""UDK klassifikatorini (data/udk_ozbek.json) UdcClass jadvaliga yuklash."""
import json
import os

DATA_PATH = os.path.join(os.path.dirname(__file__), 'data', 'udk_ozbek.json')


def _parent(code: str, known: set) -> str:
    c = code
    while len(c) > 1:
        c = c[:-1].rstrip('.-/:')
        if c in known:
            return c
    return ''


def load_catalog(UdcClass, path: str = DATA_PATH) -> int:
    """JSON → UdcClass (mavjudlari yangilanadi). Yuklangan yozuvlar sonini qaytaradi."""
    from apps.udc.translit import cyr_to_latin

    with open(path, encoding='utf-8') as f:
        items = [i for i in json.load(f) if i.get('code') and i.get('description')]
    known = {i['code'] for i in items}
    parents = {i['code']: _parent(i['code'], known) for i in items}

    def depth(code):
        d, p = 0, parents.get(code)
        while p:
            d += 1
            p = parents.get(p)
        return d

    existing = {o.code: o for o in UdcClass.objects.filter(source='book')}
    new, changed = [], []
    for i in items:
        latin = i.get('description_latin') or cyr_to_latin(i['description'])
        vals = dict(title=i['description'], title_latin=latin, parent_code=parents[i['code']], depth=depth(i['code']))
        obj = existing.get(i['code'])
        if obj is None:
            new.append(UdcClass(code=i['code'], source='book', **vals))
        elif any(getattr(obj, k) != v for k, v in vals.items()):
            for k, v in vals.items():
                setattr(obj, k, v)
            changed.append(obj)
    UdcClass.objects.bulk_create(new, batch_size=500, ignore_conflicts=True)
    if changed:
        UdcClass.objects.bulk_update(changed, ['title', 'title_latin', 'parent_code', 'depth'], batch_size=500)
    return len(new) + len(changed)
