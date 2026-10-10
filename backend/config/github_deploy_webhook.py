"""
GitHub Webhooks orqali deploy (SSH / GitHub Actions secret shart emas).

Sozlash:
  1) .env: GITHUB_DEPLOY_WEBHOOK_SECRET=<uzun tasodifiy qiymat>
  2) GitHub → riskgroup77/phoenix → Settings → Webhooks → Add webhook
     Payload URL: https://api.ilmiyfaoliyat.uz/hooks/github/deploy/
     Content type: application/json
     Secret: xuddi shu GITHUB_DEPLOY_WEBHOOK_SECRET
     Events: "Let me select individual events" → faqat "Workflow runs"
     (deploy faqat CI testlari MUVAFFAQIYATLI o'tgandan keyin; push hodisasi e'tiborga olinmaydi)
  3) Gunicorn foydalanuvchisi deploy skriptini ishga tushira olishi kerak
     (odatda NOPASSWD sudo yoki skriptni deploy user uchun).

Xavfsizlik: secret bo‘lmasa endpoint 404; imzo noto‘g‘ri bo‘lsa 401.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import subprocess
import threading
from typing import Any

from django.conf import settings
from django.http import HttpResponse, HttpResponseNotFound, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

logger = logging.getLogger(__name__)


def _verify_github_signature(payload: bytes, secret: str, signature_header: str | None) -> bool:
    if not signature_header or not secret:
        return False
    if not signature_header.startswith('sha256='):
        return False
    sent = signature_header[7:].strip()
    expected = hmac.new(secret.encode('utf-8'), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(sent, expected)


def _deploy_command(script: str, sha: str) -> list[str]:
    """
    Deploy skripti backend xizmatini qayta ishga tushiradi. Skript shu xizmat ichida (gunicorn) ishlasa,
    systemd uni xizmat bilan birga to'xtatib yuboradi — shuning uchun alohida transient unit (systemd-run).
    """
    import shutil

    if shutil.which('systemd-run') and shutil.which('sudo'):
        return [
            'sudo', '-n', 'systemd-run', '--unit', f'phoenix-deploy-{sha[:12] or "manual"}', '--collect',
            '--setenv=PHONIX_GIT_RESET=true', f'--setenv=PHONIX_GIT_REF={sha}',
            '/bin/bash', script,
        ]
    return ['/bin/bash', script]


def _run_deploy_script(sha: str = '') -> None:
    script = getattr(settings, 'DEPLOY_HOOK_SCRIPT', '/phonix/deploy_phonix.sh')
    env = {**os.environ, 'PHONIX_GIT_RESET': 'true', 'PHONIX_GIT_REF': sha}
    try:
        proc = subprocess.run(
            _deploy_command(script, sha),
            cwd='/phonix',
            env=env,
            timeout=3600,
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            logger.error(
                'Deploy hook script exit %s stderr=%s stdout_tail=%s',
                proc.returncode,
                (proc.stderr or '')[:2000],
                (proc.stdout or '')[-2000:],
            )
        else:
            logger.info('Deploy hook finished OK (stdout tail): %s', (proc.stdout or '')[-500:])
    except Exception:
        logger.exception('Deploy hook subprocess failed')


@csrf_exempt
@require_POST
def github_deploy_webhook(request) -> HttpResponse:
    secret = getattr(settings, 'GITHUB_DEPLOY_WEBHOOK_SECRET', '') or ''
    if not secret:
        return HttpResponseNotFound()

    raw = request.body
    sig = request.META.get('HTTP_X_HUB_SIGNATURE_256')
    if not _verify_github_signature(raw, secret, sig):
        logger.warning('GitHub deploy webhook: invalid signature')
        return JsonResponse({'detail': 'invalid signature'}, status=401)

    event = request.headers.get('X-GitHub-Event') or ''
    # Faqat CI tugaganda (workflow_run). "push" da deploy qilinmaydi — testdan o'tmagan kod chiqmasin.
    if event != 'workflow_run':
        return JsonResponse({'ok': True, 'ignored': f'event:{event}'}, status=200)

    try:
        data: dict[str, Any] = json.loads(raw.decode('utf-8'))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({'detail': 'invalid json'}, status=400)

    allowed_repos = getattr(settings, 'GITHUB_DEPLOY_REPOS', frozenset())
    repo_name = (data.get('repository') or {}).get('full_name') or ''
    if allowed_repos and repo_name not in allowed_repos:
        return JsonResponse({'ok': True, 'ignored': f'repo:{repo_name}'}, status=200)

    run = data.get('workflow_run') or {}
    branch = (getattr(settings, 'GITHUB_DEPLOY_HOOK_BRANCH', 'main') or 'main').strip()
    workflow = (getattr(settings, 'GITHUB_DEPLOY_CI_WORKFLOW', 'CI') or 'CI').strip()
    reasons = []
    if data.get('action') != 'completed':
        reasons.append(f"action:{data.get('action')}")
    if run.get('name') != workflow:
        reasons.append(f"workflow:{run.get('name')}")
    if run.get('head_branch') != branch:
        reasons.append(f"branch:{run.get('head_branch')}")
    if run.get('event') != 'push':
        reasons.append(f"trigger:{run.get('event')}")
    if run.get('conclusion') != 'success':
        reasons.append(f"conclusion:{run.get('conclusion')}")
    if reasons:
        return JsonResponse({'ok': True, 'ignored': ','.join(reasons)}, status=200)

    sha = str(run.get('head_sha') or '')
    t = threading.Thread(target=_run_deploy_script, args=(sha,), name='github-deploy-hook', daemon=True)
    t.start()
    logger.info('GitHub deploy webhook: CI success → deploy %s (%s)', sha[:12], repo_name)
    return JsonResponse({'accepted': True, 'sha': sha}, status=202)

