"""
HTML: JPG shablon fon + layout.json koordinatalarida matn.
"""
from __future__ import annotations

import json
import shutil
from html import escape
from pathlib import Path
from typing import Any

from apps.articles.antiplagiat_template_render import ASSETS_DIR, _source_url

LAYOUT = json.loads((ASSETS_DIR / 'layout.json').read_text(encoding='utf-8'))


def _field_style(spec: dict[str, Any], *, base_width: int = 3509) -> str:
    parts = [
        f'left:{spec["x"] * 100}%',
        f'top:{spec["y"] * 100}%',
        f'max-width:{spec.get("max_width", 0.4) * 100}%',
        f'color:{spec.get("color", "#1e293b")}',
        f'font-size:calc(100cqw * {spec.get("size", 36)} / {base_width})',
        'font-family:Arial,Helvetica,sans-serif',
        'position:absolute',
        'font-weight:700' if spec.get('bold') else 'font-weight:400',
    ]
    size = float(spec.get('size', 36))
    if spec.get('multiline'):
        # layout.json da line_height px'da (PIL uchun) — CSS nisbatga o'giramiz
        lh = float(spec.get('line_height') or size * 1.25) / size
        parts.append(f'white-space:normal;line-height:{lh:.3f}')
        if spec.get('max_lines'):
            parts.append(f'display:-webkit-box;-webkit-line-clamp:{int(spec["max_lines"])};-webkit-box-orient:vertical;overflow:hidden')
    else:
        lh = 1.0
        parts.append('white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1')
    if spec.get('baseline'):
        # y — yorliq bilan umumiy tayanch chizig'i (Arial: ascent 0.905em, descent 0.212em)
        parts.append(f'transform:translateY(-{(lh - 1.117) / 2 + 0.905:.3f}em)')
    return ';'.join(parts)


def _qr_img_html(q: dict[str, Any], verify_id: str) -> str:
    from config.verify_links import qr_png_data_uri, verify_url

    # QR kod mahalliy yaratiladi (tashqi xizmatga hujjat raqami yuborilmaydi)
    qr_url = qr_png_data_uri(verify_url(verify_id))
    if q.get('center_x') is not None and q.get('center_y') is not None:
        return (
            f'<img class="jpg-qr jpg-qr-center" src="{qr_url}" alt="QR" '
            f'style="left:{q["center_x"]*100}%;top:{q["center_y"]*100}%;width:{q["size"]*100}%"/>'
        )
    return (
        f'<img class="jpg-qr" src="{qr_url}" alt="QR" '
        f'style="left:{q.get("x", 0)*100}%;top:{q.get("y", 0)*100}%;width:{q["size"]*100}%"/>'
    )


def _page_shell(
    bg_file: str,
    aspect: str,
    max_width: str,
    fields_html: str,
    qr_html: str = '',
) -> str:
    return f"""
<div class="jpg-page" style="aspect-ratio:{aspect};max-width:{max_width};container-type:inline-size;">
  <img class="jpg-bg" src="{escape(bg_file)}" alt=""/>
  <div class="jpg-overlay">{fields_html}{qr_html}</div>
</div>"""


def _ensure_assets(out_dir: Path) -> None:
    for name in ('sertifikat.jpg', 'hisobot1.jpg', 'hisobot2.jpg'):
        dest = out_dir / name
        if not dest.is_file():
            shutil.copy2(ASSETS_DIR / name, dest)


def build_certificate_html(data: dict[str, Any], *, asset_prefix: str = '') -> str:
    layout = LAYOUT['certificate']
    mapping = {
        'check_date': data.get('check_date', ''),
        'document_number': data.get('document_number', ''),
        'author': data.get('author', ''),
        'work_type': data.get('work_type', ''),
        'file_name': data.get('file_name', ''),
        'citations': data.get('citations', ''),
        'self_citation': data.get('self_citation', ''),
        'plagiarism': data.get('plagiarism', ''),
        'originality': data.get('originality', ''),
        'search_modules': data.get('search_modules', ''),
    }
    fields = ''.join(
        f'<span style="{_field_style(spec)}">{escape(str(mapping.get(k, "")))}</span>'
        for k, spec in layout['fields'].items()
    )
    qr = ''
    if layout.get('qr'):
        qr = _qr_img_html(layout['qr'], str(data.get('document_number', '')))
    bg = f'{asset_prefix}sertifikat.jpg'
    body = _page_shell(bg, '3509 / 2481', '297mm', fields, qr)
    return _html_doc('Sertifikat', body)


def build_report_body_html(data: dict[str, Any], sources: list[dict], *, asset_prefix: str = '') -> str:
    layout = LAYOUT['report_cover']
    mapping = {
        'upload_date': data.get('upload_date', ''),
        'document_number': data.get('document_number', ''),
        'author': data.get('author', ''),
        'workplace': data.get('workplace') or '—',
        'position': data.get('position') or '—',
    }
    fields = ''.join(
        f'<span style="{_field_style(spec, base_width=2481)}">{escape(str(mapping.get(k, "")))}</span>'
        for k, spec in layout['fields'].items()
    )
    qr = _qr_img_html(layout['qr'], str(data.get('document_number', ''))) if layout.get('qr') else ''
    cover = _page_shell(f'{asset_prefix}hisobot1.jpg', '2481 / 3509', '210mm', fields, qr)

    box = LAYOUT['report_inner']['content_box']
    rows = ''
    for i, s in enumerate(sources[:400], 1):
        sim = float(s.get('similarity') or 0)
        title = escape(str(s.get('title') or s.get('snippet') or '')[:120])
        url = _source_url(s)
        url_cell = (
            f'<a href="{escape(url)}" target="_blank" rel="noopener">{escape(url[:100])}</a>'
            if url
            else '<span class="muted">—</span>'
        )
        rows += f'<tr><td>[{i:02d}]</td><td>{sim:.2f}%</td><td>{title}</td><td>{url_cell}</td></tr>'

    inner = f"""
<div class="jpg-page page-break" style="aspect-ratio:2481/3509;max-width:210mm;container-type:inline-size;">
  <img class="jpg-bg" src="{asset_prefix}hisobot2.jpg" alt=""/>
  <div class="jpg-inner" style="left:{box['x']*100}%;top:{box['y']*100}%;width:{box['w']*100}%;height:{box['h']*100}%;">
    <h2 class="rep-title">Hujjat tekshirish natijalari</h2>
    <p class="rep-meta">O'zlashtirish: {float(data.get('plagiarism_percent') or 0):.2f}% · Originallik: {float(data.get('originality_percent') or 0):.2f}% · Iqtibos: {float(data.get('citation_percent') or 0):.2f}%</p>
    <table class="src"><thead><tr><th>№</th><th>%</th><th>Manba</th><th>Havola</th></tr></thead><tbody>{rows}</tbody></table>
  </div>
</div>"""
    return _html_doc('Hisobot', cover + inner)


def _html_doc(title: str, body: str) -> str:
    css = """
body{margin:0;background:#e2e8f0;font-family:Arial,sans-serif}
.jpg-page{position:relative;margin:12px auto;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,.12);overflow:hidden}
.jpg-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:fill}
.jpg-overlay,.jpg-inner{position:absolute;inset:0}
.jpg-qr{position:absolute;background:#fff;border-radius:2px}
.jpg-qr-center{transform:translate(-50%,-50%)}
.page-break{page-break-before:always}
.rep-title{margin:0 0 10px;font-size:17px;color:#0f2744;font-weight:700}
.rep-meta{margin:0 0 12px;font-size:12px;color:#334155}
table.src{width:100%;border-collapse:collapse;font-size:11px;line-height:1.35}
table.src th,table.src td{border:1px solid #cbd5e1;padding:4px 6px;vertical-align:top}
table.src th{background:#0a7a8c;color:#fff;font-size:10px}
table.src a{color:#0a7a8c;word-break:break-all}
table.src .muted{color:#94a3b8}
@media print{body{background:#fff}.jpg-page{box-shadow:none;margin:0}}
"""
    return f'<!DOCTYPE html><html lang="uz"><head><meta charset="utf-8"><title>{escape(title)}</title><style>{css}</style></head><body>{body}</body></html>'
