#!/usr/bin/env python3
"""Bitta fayl uchun antiplagiat tekshiruvi + HTML sertifikat va hisobot."""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from apps.articles.antiplagiat_engine import DEFAULT_MODULE_IDS, get_antiplagiat_engine  # noqa: E402
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


def build_html(result: dict, file_path: Path, out_dir: Path) -> tuple[Path, Path]:  # noqa: C901
    report = result.get("report") or {}
    sources = result.get("sources") or report.get("sources") or []
    cert_no = datetime.now().strftime("%y%m%d%H%M")
    check_date = datetime.now().strftime("%d.%m.%Y")
    enabled_count = len(report.get("enabled_module_ids") or DEFAULT_MODULE_IDS)
    search_modules_label = f"{enabled_count} ta moduldan / {enabled_count} tasida tekshirilgan"

    cert_data = {
        "certificate_number": cert_no,
        "check_date": check_date,
        "author": report.get("author_name") or "Foydalanuvchi",
        "work_type": report.get("document_type") or "Ilmiy ish",
        "file_name": file_path.name,
        "citations": f"{float(report.get('citation_percent') or 0):.1f}%",
        "self_citation": f"{float(report.get('self_citation_percent') or 0):.1f}%",
        "plagiarism": f"{float(result.get('plagiarism_percentage') or 0):.2f}%",
        "originality": f"{float(result.get('originality') or 0):.2f}%",
        "search_modules": search_modules_label,
    }
    rep_data = {
        "document_number": cert_no,
        "upload_date": f"{check_date}, {datetime.now().strftime('%H:%M')}",
        "author": cert_data["author"],
        "workplace": report.get("author_workplace") or "",
        "position": report.get("author_position") or "",
        "file_name": file_path.name,
        "plagiarism_percent": result.get("plagiarism_percentage"),
        "originality_percent": result.get("originality"),
        "citation_percent": report.get("citation_percent"),
        "self_citation_percent": report.get("self_citation_percent"),
        "character_count": report.get("character_count"),
        "sentence_count": report.get("sentence_count"),
    }

    _ensure_assets(out_dir)
    cert_path = out_dir / f"antiplagiat-sertifikat-{cert_no}.html"
    report_path = out_dir / f"antiplagiat-hisobot-{cert_no}.html"
    cert_path.write_text(build_certificate_html(cert_data, asset_prefix=''), encoding="utf-8")
    report_path.write_text(build_report_body_html(rep_data, sources, asset_prefix=''), encoding="utf-8")

    cert_jpg = out_dir / f"antiplagiat-sertifikat-{cert_no}.jpg"
    save_image(render_certificate(cert_data, verify_id=cert_no), cert_jpg)

    cert_docx = out_dir / f"antiplagiat-sertifikat-{cert_no}.docx"
    cert_docx.write_bytes(build_filled_certificate_docx(cert_data))

    cert_v, cover_v, inner = values_from_check_result(result, file_name=file_path.name)
    cert_v.update(cert_data)
    rep_docx = out_dir / f"antiplagiat-hisobot-{cert_no}.docx"
    rep_docx.write_bytes(build_filled_report_docx(cover_v, inner))

    # Word da qo'lda to'ldirish uchun bo'sh shablonlar
    from apps.articles.antiplagiat_template_docx import build_empty_template_docx  # noqa: E402

    (out_dir / 'shablon-sertifikat-bosh.docx').write_bytes(build_empty_template_docx('certificate'))
    (out_dir / 'shablon-hisobot-muqova.docx').write_bytes(build_empty_template_docx('report_cover'))
    (out_dir / 'shablon-hisobot-ichki.docx').write_bytes(build_empty_template_docx('report_inner'))

    return cert_path, report_path


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python scripts/_run_antiplag_check.py <file.docx> [out_dir]")
        return 1

    file_path = Path(sys.argv[1]).resolve()
    if not file_path.is_file():
        print(f"Fayl topilmadi: {file_path}")
        return 1

    out_dir = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else file_path.parent
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Tekshirilmoqda: {file_path.name} ({file_path.stat().st_size // 1024} KB)...")
    engine = get_antiplagiat_engine()
    result = engine.check_file(str(file_path), enabled_modules=list(DEFAULT_MODULE_IDS))

    json_path = out_dir / f"antiplagiat-natija-{datetime.now().strftime('%y%m%d%H%M')}.json"
    json_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    cert_path, report_path = build_html(result, file_path, out_dir)

    plagiarism = result.get("plagiarism_percentage", 0)
    sources_count = len(result.get("sources") or [])
    print("\n=== NATIJA ===")
    print(f"O'zlashtirish: {plagiarism}%")
    print(f"Originallik: {result.get('originality', 0)}%")
    print(f"Manbalar: {sources_count} ta")
    print(f"Modullar: {len((result.get('report') or {}).get('search_modules') or [])} ta")
    print(f"\nSertifikat HTML: {cert_path}")
    print(f"Sertifikat JPG:  {cert_path.with_suffix('.jpg')}")
    print(f"Sertifikat DOCX: {cert_path.with_suffix('.docx')}")
    print(f"Hisobot HTML:    {report_path}")
    print(f"Hisobot DOCX:    {report_path.with_suffix('.docx')}")
    print(f"Shablon DOCX:    {out_dir / 'shablon-sertifikat-bosh.docx'} (+ muqova, ichki)")
    print(f"JSON:            {json_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
