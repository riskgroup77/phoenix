#!/usr/bin/env python3
"""Mavjud antiplag JSON dan Phoenix dizaynli HTML qayta yaratish."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from apps.articles.antiplagiat_html_export import (  # noqa: E402
    _ensure_assets,
    build_certificate_html,
    build_report_body_html,
)
from apps.articles.antiplagiat_template_docx import (  # noqa: E402
    build_filled_certificate_docx,
    build_filled_report_docx,
    values_from_check_result,
)
from apps.articles.antiplagiat_template_render import render_certificate, save_image  # noqa: E402


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python scripts/_regen_antiplag_html.py <antiplagiat-natija-*.json>")
        return 1
    jpath = Path(sys.argv[1]).resolve()
    out_dir = jpath.parent
    d = json.loads(jpath.read_text(encoding="utf-8"))
    r = d.get("report") or {}
    stem = jpath.stem.replace("antiplagiat-natija-", "")
    cert_no = stem
    enabled = len(r.get("enabled_module_ids") or [])
    cert = {
        "certificate_number": cert_no,
        "check_date": "25.09.2026",
        "author": r.get("author_name") or "Foydalanuvchi",
        "work_type": r.get("document_type") or "Ilmiy ish",
        "file_name": r.get("document_name") or "hujjat.docx",
        "citations": f"{float(r.get('citation_percent') or 0):.1f}%",
        "self_citation": f"{float(r.get('self_citation_percent') or 0):.1f}%",
        "plagiarism": f"{float(d.get('plagiarism_percentage') or 0):.2f}%",
        "originality": f"{float(d.get('originality') or 0):.2f}%",
        "search_modules": f"{enabled} ta moduldan / {enabled} tasida tekshirilgan",
    }
    rep = {
        "document_number": cert_no,
        "upload_date": cert["check_date"],
        "author": cert["author"],
        "workplace": r.get("author_workplace") or "",
        "position": r.get("author_position") or "",
        "file_name": cert["file_name"],
        "plagiarism_percent": d.get("plagiarism_percentage"),
        "originality_percent": d.get("originality"),
        "citation_percent": r.get("citation_percent"),
        "self_citation_percent": r.get("self_citation_percent"),
        "character_count": r.get("character_count"),
        "sentence_count": r.get("sentence_count"),
    }
    sources = d.get("sources") or []
    cert_path = out_dir / f"antiplagiat-sertifikat-{cert_no}.html"
    rep_path = out_dir / f"antiplagiat-hisobot-{cert_no}.html"
    _ensure_assets(out_dir)
    cert_path.write_text(build_certificate_html(cert, asset_prefix=''), encoding="utf-8")
    rep_path.write_text(build_report_body_html(rep, sources, asset_prefix=''), encoding="utf-8")
    save_image(render_certificate(cert, verify_id=cert_no), cert_path.with_suffix('.jpg'))
    cert_path.with_suffix('.docx').write_bytes(build_filled_certificate_docx(cert))
    _, cover, inner = values_from_check_result(d)
    rep_path.with_suffix('.docx').write_bytes(build_filled_report_docx(cover, inner))
    print(cert_path)
    print(rep_path)
    print(cert_path.with_suffix('.jpg'))
    print(cert_path.with_suffix('.docx'))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
