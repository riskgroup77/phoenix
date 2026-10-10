"""GitHub deploy webhook — imzo tekshiruvi va faqat CI muvaffaqiyatli bo'lganda deploy."""

import hashlib
import hmac
import json
import time
from unittest import mock

import pytest
from django.test import Client


def _sign(body: bytes, secret: str) -> str:
    digest = hmac.new(secret.encode('utf-8'), body, hashlib.sha256).hexdigest()
    return f'sha256={digest}'


def _post(event: str, payload: dict, secret: str = 'whsec_test'):
    body = json.dumps(payload).encode('utf-8')
    return Client().post(
        '/hooks/github/deploy/',
        data=body,
        content_type='application/json',
        HTTP_X_GITHUB_EVENT=event,
        HTTP_X_HUB_SIGNATURE_256=_sign(body, secret),
    )


def _run(conclusion='success', branch='main', name='CI', trigger='push'):
    return {
        'action': 'completed',
        'repository': {'full_name': 'riskgroup77/phoenix'},
        'workflow_run': {
            'name': name, 'head_branch': branch, 'event': trigger,
            'conclusion': conclusion, 'head_sha': 'abc123def4567890',
        },
    }


@pytest.fixture
def hook_settings(settings):
    settings.GITHUB_DEPLOY_WEBHOOK_SECRET = 'whsec_test'
    settings.GITHUB_DEPLOY_REPOS = frozenset({'riskgroup77/phoenix'})
    settings.GITHUB_DEPLOY_HOOK_BRANCH = 'main'
    settings.DEPLOY_HOOK_SCRIPT = '/phonix/deploy_phonix.sh'
    return settings


@pytest.mark.django_db
def test_webhook_disabled_returns_404(settings):
    settings.GITHUB_DEPLOY_WEBHOOK_SECRET = ''
    r = Client().post('/hooks/github/deploy/', b'{}', content_type='application/json')
    assert r.status_code == 404


@pytest.mark.django_db
@mock.patch('config.github_deploy_webhook._run_deploy_script')
def test_ci_success_starts_deploy_of_tested_commit(mock_run, hook_settings):
    r = _post('workflow_run', _run())
    assert r.status_code == 202
    assert r.json()['sha'] == 'abc123def4567890'
    time.sleep(0.15)
    mock_run.assert_called_once_with('abc123def4567890')


@pytest.mark.django_db
@mock.patch('config.github_deploy_webhook._run_deploy_script')
@pytest.mark.parametrize('payload', [
    _run(conclusion='failure'),
    _run(branch='feature-x'),
    _run(name='Deploy to server'),
    _run(trigger='pull_request'),
])
def test_failed_or_foreign_runs_ignored(mock_run, hook_settings, payload):
    r = _post('workflow_run', payload)
    assert r.status_code == 200
    assert 'ignored' in r.json()
    time.sleep(0.05)
    mock_run.assert_not_called()


@pytest.mark.django_db
@mock.patch('config.github_deploy_webhook._run_deploy_script')
def test_push_event_does_not_deploy(mock_run, hook_settings):
    r = _post('push', {'ref': 'refs/heads/main', 'repository': {'full_name': 'riskgroup77/phoenix'}})
    assert r.status_code == 200
    assert r.json()['ignored'] == 'event:push'
    mock_run.assert_not_called()


@pytest.mark.django_db
def test_wrong_signature_401(hook_settings):
    r = Client().post(
        '/hooks/github/deploy/', data=b'{}', content_type='application/json',
        HTTP_X_GITHUB_EVENT='workflow_run', HTTP_X_HUB_SIGNATURE_256='sha256=deadbeef',
    )
    assert r.status_code == 401
