"""
Telegram fayl ombori: media kanalga yuboriladi, diskdan o'chirilsa qaytariladi; zaxira shifrlanib bo'laklanadi.
Telegram o'rniga xotiradagi soxta kanal ishlatiladi (tarmoqsiz).
"""
import os
import shutil
import tempfile
import time
from unittest import mock

from django.core.files.base import ContentFile
from django.core.management import call_command
from django.test import TestCase, override_settings

from apps.tgstorage import backup, client, services
from apps.tgstorage.models import TelegramStoredFile
from apps.tgstorage.storage import TelegramBackedStorage

TG = dict(
    TG_STORAGE_BOT_TOKENS=['111:aaa', '222:bbb'],
    TG_STORAGE_CHAT_ID='-1001',
    TG_STORAGE_MEDIA_ENABLED=True,
    TG_STORAGE_BACKUP_ENABLED=True,
    TG_STORAGE_SYNC=True,
    TG_BACKUP_PASSPHRASE='sinov-kaliti',
)


class FakeChannel:
    """client.send_document / download_to / delete_message o'rnini bosadi."""

    def __init__(self):
        self.messages = {}
        self.next_id = 1

    def send_document(self, path, caption='', bot=None):
        bot = bot or client.pick_bot()
        mid = self.next_id
        self.next_id += 1
        with open(path, 'rb') as fh:
            self.messages[mid] = fh.read()
        return {'bot_id': bot.id, 'chat_id': -1001, 'message_id': mid, 'file_id': f'F{mid}',
                'file_unique_id': f'U{mid}'}

    def download_to(self, *, bot_id, chat_id_value, message_id, file_id, dest):
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, 'wb') as fh:
            fh.write(self.messages[message_id])

    def delete_message(self, *, bot_id, chat_id_value, message_id):
        self.messages.pop(message_id, None)


class TgTestCase(TestCase):
    def setUp(self):
        self.media = tempfile.mkdtemp()
        self.spool = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.media, True)
        self.addCleanup(shutil.rmtree, self.spool, True)
        overrides = override_settings(MEDIA_ROOT=self.media, TG_STORAGE_SPOOL_DIR=self.spool, **TG)
        overrides.enable()
        self.addCleanup(overrides.disable)
        self.channel = FakeChannel()
        for fn in ('send_document', 'download_to', 'delete_message'):
            patcher = mock.patch.object(client, fn, getattr(self.channel, fn))
            patcher.start()
            self.addCleanup(patcher.stop)
        self.storage = TelegramBackedStorage(location=self.media, base_url='/media/')

    def save(self, name, data=b'%PDF-1.4 sinov'):
        with self.captureOnCommitCallbacks(execute=True):
            return self.storage.save(name, ContentFile(data))


class MediaStorageTests(TgTestCase):
    def test_saved_file_is_sent_to_channel(self):
        name = self.save('articles/pdfs/a.pdf')
        rec = TelegramStoredFile.objects.get(name=name)
        self.assertEqual(rec.kind, 'media')
        self.assertEqual(rec.size, len(b'%PDF-1.4 sinov'))
        self.assertEqual(self.channel.messages[rec.message_id], b'%PDF-1.4 sinov')

    def test_evicted_file_is_restored_on_open(self):
        name = self.save('receipts/r.pdf', b'chek')
        os.remove(os.path.join(self.media, name))
        self.assertTrue(self.storage.exists(name))
        self.assertEqual(self.storage.size(name), 4)
        with self.storage.open(name) as fh:
            self.assertEqual(fh.read(), b'chek')
        self.assertTrue(os.path.isfile(os.path.join(self.media, name)))

    def test_new_file_does_not_take_name_of_evicted_one(self):
        name = self.save('avatars/x.png', b'1')
        os.remove(os.path.join(self.media, name))
        other = self.save('avatars/x.png', b'2')
        self.assertNotEqual(name, other)

    def test_delete_marks_record_deleted_and_purge_removes_message(self):
        name = self.save('articles/pdfs/d.pdf')
        rec = TelegramStoredFile.objects.get(name=name)
        self.storage.delete(name)
        rec.refresh_from_db()
        self.assertIsNotNone(rec.deleted_at)
        self.assertFalse(self.storage.exists(name))
        with override_settings(TG_STORAGE_PURGE_DAYS=0):
            self.assertEqual(services.purge_deleted(), 1)
        self.assertNotIn(rec.message_id, self.channel.messages)

    def test_evict_removes_only_old_uploaded_files(self):
        old = self.save('articles/pdfs/old.pdf')
        fresh = self.save('articles/pdfs/new.pdf')
        not_uploaded = os.path.join(self.media, 'articles/pdfs/local.pdf')
        with open(not_uploaded, 'wb') as fh:
            fh.write(b'x')
        past = time.time() - 40 * 86400
        for p in (os.path.join(self.media, old), not_uploaded):
            os.utime(p, (past, past))
        stats = services.evict(30)
        self.assertEqual(stats['evicted'], 1)
        self.assertFalse(os.path.exists(os.path.join(self.media, old)))
        self.assertTrue(os.path.exists(os.path.join(self.media, fresh)))
        self.assertTrue(os.path.exists(not_uploaded))  # Telegram'da nusxasi yo'q — o'chirilmaydi

    def test_sync_uploads_files_saved_before_telegram(self):
        os.makedirs(os.path.join(self.media, 'journals'))
        with open(os.path.join(self.media, 'journals/logo.png'), 'wb') as fh:
            fh.write(b'png')
        with open(os.path.join(self.media, 'journals/logo.png.tg-1-2'), 'wb') as fh:
            fh.write(b'tmp')
        stats = services.sync()
        self.assertEqual(stats['uploaded'], 1)
        self.assertTrue(TelegramStoredFile.objects.filter(name='journals/logo.png').exists())
        self.assertEqual(services.sync()['uploaded'], 0)

    def test_protected_media_view_restores_file(self):
        name = self.save('journals/cover.png', b'rasm')
        os.remove(os.path.join(self.media, name))
        resp = self.client.get(f'/media/{name}')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(b''.join(resp.streaming_content), b'rasm')

    def test_unsigned_request_does_not_trigger_restore(self):
        name = self.save('receipts/secret.pdf', b'maxfiy')
        os.remove(os.path.join(self.media, name))
        resp = self.client.get(f'/media/{name}')
        self.assertEqual(resp.status_code, 403)
        self.assertFalse(os.path.exists(os.path.join(self.media, name)))

    @override_settings(TG_STORAGE_BOT_TOKENS=[], TG_STORAGE_CHAT_ID='')
    def test_without_telegram_behaves_like_disk_storage(self):
        name = self.save('articles/pdfs/plain.pdf')
        self.assertFalse(TelegramStoredFile.objects.exists())
        os.remove(os.path.join(self.media, name))
        self.assertFalse(self.storage.exists(name))


class BackupTests(TgTestCase):
    def make_dump(self, size):
        path = os.path.join(self.spool, 'phoenix_20261026_023000.dump')
        with open(path, 'wb') as fh:
            fh.write(os.urandom(size))
        return path

    def test_backup_is_encrypted_split_and_restorable(self):
        dump = self.make_dump(300_000)
        with override_settings(TG_STORAGE_PART_MB=0.1):  # ~100 KB bo'laklar
            records = backup.upload_backup(dump, label='daily')
        self.assertEqual(len(records), 3)
        self.assertTrue(all(r.parts_total == 3 for r in TelegramStoredFile.objects.filter(kind='backup')))
        raw = open(dump, 'rb').read()
        sent = b''.join(self.channel.messages[r.message_id] for r in records)
        self.assertNotIn(raw[:64], sent)  # kanalga shifrlanmagan ma'lumot ketmagan
        self.assertEqual(os.listdir(self.spool), [os.path.basename(dump)])  # bo'laklar o'chirilgan

        out = os.path.join(self.spool, 'restored.dump')
        backup.download_backup(records[0].name, out)
        self.assertEqual(open(out, 'rb').read(), raw)

    def test_wrong_passphrase_fails(self):
        dump = self.make_dump(1000)
        name = backup.upload_backup(dump)[0].name
        with override_settings(TG_BACKUP_PASSPHRASE='boshqa'):
            with self.assertRaises(backup.BackupError):
                backup.download_backup(name, os.path.join(self.spool, 'x.dump'))
        self.assertFalse(os.path.exists(os.path.join(self.spool, 'x.dump')))

    def test_upload_requires_passphrase(self):
        dump = self.make_dump(100)
        with override_settings(TG_BACKUP_PASSPHRASE=''):
            with self.assertRaises(backup.BackupError):
                backup.upload_backup(dump)
        self.assertFalse(TelegramStoredFile.objects.exists())

    def test_prune_removes_old_daily_backups(self):
        dump = self.make_dump(100)
        rec = backup.upload_backup(dump)[0]
        TelegramStoredFile.objects.filter(pk=rec.pk).update(created_at=rec.created_at.replace(year=2020))
        self.assertEqual(backup.prune_backups(), 1)
        self.assertFalse(TelegramStoredFile.objects.exists())
        self.assertEqual(self.channel.messages, {})

    def test_command_list(self):
        dump = self.make_dump(100)
        call_command('tgstorage', 'backup-upload', dump, '--label', 'weekly')
        from io import StringIO
        out = StringIO()
        call_command('tgstorage', 'backup-list', stdout=out)
        self.assertIn('weekly/phoenix_20261026_023000.dump.enc', out.getvalue())


class ClientTests(TestCase):
    def _resp(self, status, payload):
        r = mock.Mock(status_code=status)
        r.json.return_value = payload
        return r

    @override_settings(**TG, TG_BOT_API_LOCAL=True)
    def test_local_mode_sends_file_path_and_retries_on_429(self):
        msg = {'message_id': 7, 'chat': {'id': -1001}, 'document': {'file_id': 'F', 'file_unique_id': 'U'}}
        with tempfile.NamedTemporaryFile() as fh, \
                mock.patch.object(client.requests, 'post', side_effect=[
                    self._resp(429, {'ok': False, 'parameters': {'retry_after': 0}}),
                    self._resp(200, {'ok': True, 'result': msg}),
                ]) as post, mock.patch.object(client.time, 'sleep'):
            info = client.send_document(fh.name, caption='media: a', bot=client.Bot('111:aaa'))
        self.assertEqual(info, {'bot_id': '111', 'chat_id': -1001, 'message_id': 7, 'file_id': 'F',
                                'file_unique_id': 'U'})
        self.assertEqual(post.call_count, 2)
        self.assertEqual(post.call_args.kwargs['data']['document'], f'file://{fh.name}')
        self.assertIsNone(post.call_args.kwargs['files'])

    @override_settings(**TG, TG_BOT_API_DATA_DIR='/srv/tgdata')
    def test_container_path_is_mapped_to_host(self):
        self.assertEqual(client._host_path('/var/lib/telegram-bot-api/111:aaa/documents/file_1.pdf'),
                         '/srv/tgdata/111:aaa/documents/file_1.pdf')
        self.assertEqual(client._host_path('/other/x'), '/other/x')
