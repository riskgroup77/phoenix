"""launch_check: sizib chiqqan kalit aniqlanadi (qiymat chop etilmaydi), FAIL bo'lsa chiqish kodi 1, demo kaliti ishlaydi."""
import hashlib
import io
import json
from unittest import mock

from django.core.management import call_command
from django.test import TestCase, override_settings

from apps.users.models import User
from config import leaked_secrets

FAKE_LEAKED = 'leaked-click-secret-for-tests-0123456789'


def run_check(*args):
    out = io.StringIO()
    code = 0
    try:
        call_command('launch_check', '--json', '--skip-celery', *args, stdout=out)
    except SystemExit as exc:
        code = exc.code
    return code, json.loads(out.getvalue())


class LaunchCheckTests(TestCase):
    def test_is_leaked_uses_hash_only(self):
        digest = hashlib.sha256(FAKE_LEAKED.encode()).hexdigest()
        with mock.patch.dict(leaked_secrets.LEAKED_SHA256, {'CLICK_SECRET_KEY': frozenset({digest})}):
            self.assertTrue(leaked_secrets.is_leaked('CLICK_SECRET_KEY', FAKE_LEAKED))
            self.assertTrue(leaked_secrets.is_leaked('CLICK_SECRET_KEY', f'  {FAKE_LEAKED}\n'))
            self.assertFalse(leaked_secrets.is_leaked('CLICK_SECRET_KEY', 'boshqa-kalit'))
            self.assertFalse(leaked_secrets.is_leaked('CLICK_SECRET_KEY', ''))

    def test_leaked_click_key_fails_without_printing_value(self):
        digest = hashlib.sha256(FAKE_LEAKED.encode()).hexdigest()
        with mock.patch.dict(leaked_secrets.LEAKED_SHA256, {'CLICK_SECRET_KEY': frozenset({digest})}), \
                override_settings(CLICK_SECRET_KEY=FAKE_LEAKED):
            code, results = run_check()
        self.assertEqual(code, 1)
        leaked = [r for r in results if r['area'] == 'Sizib chiqqan kalit']
        self.assertEqual(len(leaked), 1)
        self.assertEqual(leaked[0]['level'], 'FAIL')
        self.assertNotIn(FAKE_LEAKED, json.dumps(results))

    @override_settings(PHONIX_DEMO_ENABLED=False, DEBUG=False)
    def test_demo_disabled_skips_setup(self):
        out = io.StringIO()
        call_command('setup_demo_and_admin', stdout=out)
        self.assertIn('PHONIX_DEMO_ENABLED=false', out.getvalue())
        self.assertFalse(User.objects.filter(phone='998911111111').exists())

    @override_settings(DEBUG=True)
    def test_purge_logins_removes_demo_accounts(self):
        call_command('setup_demo_and_admin', stdout=io.StringIO())
        self.assertTrue(User.objects.filter(phone='998911111111').exists())
        real = User.objects.create_user(phone='998977777777', password='x-parol-123', email='real@mail.uz',
                                        first_name='R', last_name='U', affiliation='X')
        call_command('seed_demo_data', '--purge', '--logins', stdout=io.StringIO())
        self.assertFalse(User.objects.filter(phone='998911111111').exists())
        self.assertTrue(User.objects.filter(pk=real.pk).exists())
