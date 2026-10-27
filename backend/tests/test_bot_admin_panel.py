"""
Bot admin paneli (/admin): statistika, hujjatlar, foydalanuvchi qidiruvi va fayllarni olish.
"""
import asyncio
import os
import shutil
import tempfile
from unittest import mock

from django.core.files.base import ContentFile
from django.test import TestCase, override_settings

from apps.articles.models import Article
from apps.payments.models import Transaction
from apps.translations.models import TranslationRequest
from bot.handlers import admin_data as data
from bot.handlers import admin_panel
from tests.test_p1_integrity import Fixture


def _callbacks(rows):
    return [cb for row in rows for _text, cb in row]


class AdminDataTests(Fixture):
    def setUp(self):
        super().setUp()
        self.media = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.media, True)
        media = override_settings(MEDIA_ROOT=self.media)
        media.enable()
        self.addCleanup(media.disable)
        self.author.first_name, self.author.last_name = 'Vali', 'Aliyev'
        self.author.save()
        self.article = Article.objects.create(title='Iqtisodiy o\'sish', abstract='a', author=self.author,
                                              journal=self.journal, status='WithEditor')
        self.article.final_pdf_path.save('maqola.pdf', ContentFile(b'%PDF maqola'), save=True)
        Article.objects.create(title='[KITOB] Mening kitobim', abstract='a', author=self.author, journal=self.journal)
        Article.objects.create(title='Plagiarism check: hisobot', abstract='a', author=self.other, journal=self.journal)
        Transaction.objects.create(user=self.author, amount=50000, service_type='udk_request', status='completed')

    def test_search_by_phone_name_and_id(self):
        self.assertEqual(data.search_users('910000001'), [self.author])
        self.assertEqual(data.search_users('+998 91 000 00 01'), [self.author])
        self.assertEqual(data.search_users('aliyev vali'), [self.author])
        self.assertEqual(data.search_users(str(self.author.pk)), [self.author])
        self.assertEqual(data.search_users(str(self.author.pk)[:8]), [self.author])
        self.assertEqual(data.search_users('yoq-odam'), [])

    def test_categories_split_articles_books_and_checks(self):
        self.assertEqual(data.CATEGORIES['art'].queryset().count(), 1)
        self.assertEqual(data.CATEGORIES['book'].queryset().count(), 1)
        self.assertEqual(data.CATEGORIES['plag'].queryset().count(), 1)

    def test_stats_text(self):
        text = data.stats_text()
        self.assertIn('Foydalanuvchilar', text)
        self.assertIn('50 000 so\'m', text)
        self.assertIn('📖 Kitoblar: <b>1</b>', text)

    def test_user_detail_lists_documents_and_bulk_button(self):
        text, rows = data.user_detail(str(self.author.pk))
        self.assertIn('Aliyev Vali', text)
        cbs = _callbacks(rows)
        self.assertIn(f'adm:ul:{self.author.pk}:art:0', cbs)
        self.assertIn(f'adm:ua:{self.author.pk}', cbs)
        self.assertEqual(data.user_files(str(self.author.pk)), [('art', str(self.article.pk), 0)])

    def test_document_detail_and_file(self):
        text, rows = data.document_detail('art', str(self.article.pk))
        self.assertIn('Iqtisodiy', text)
        self.assertIn(f'adm:f:art:{self.article.pk}:0', _callbacks(rows))
        info = data.resolve_file('art', str(self.article.pk), 0)
        with open(info['path'], 'rb') as fh:
            self.assertEqual(fh.read(), b'%PDF maqola')
        self.assertIsNone(data.resolve_file('art', str(self.article.pk), 9))

    def test_user_scoped_list_and_paging(self):
        for i in range(10):
            TranslationRequest.objects.create(author=self.author, title=f'T{i}', source_language='uz',
                                              target_language='en', source_file_path='translations/source/x.docx')
        text, rows = data.document_list('tr', 0, user_id=str(self.author.pk))
        self.assertIn('<b>10</b>', text)
        self.assertIn(f'adm:ul:{self.author.pk}:tr:1', _callbacks(rows))
        self.assertTrue(all(len(cb.encode()) <= 64 for cb in _callbacks(rows)))

    def test_other_sections_render(self):
        for fn in (data.storage_text, data.server_text):
            self.assertTrue(fn())
        text, _rows = data.broadcasts_text()
        self.assertIn('Reklama', text)
        text, rows = data.documents_menu()
        self.assertEqual(len(rows), len(data.CATEGORIES))


class AdminAccessTests(TestCase):
    def test_non_admin_callback_is_denied(self):
        query = mock.Mock(data='adm:stats', answer=mock.AsyncMock(), message=None)
        update = mock.Mock(callback_query=query, effective_user=mock.Mock(id=5))
        with mock.patch.object(admin_panel, 'admin_user', mock.AsyncMock(return_value=(False, None))), \
                mock.patch.object(admin_panel.data, 'stats_text') as stats:
            asyncio.run(admin_panel.admin_callback(update, mock.Mock()))
        query.answer.assert_awaited_once_with(admin_panel.DENIED, show_alert=True)
        stats.assert_not_called()

    def test_large_file_is_not_sent(self):
        chat = mock.Mock(send_message=mock.AsyncMock(), id=1)
        update = mock.Mock(effective_chat=chat, effective_user=mock.Mock(id=5))
        context = mock.Mock()
        context.bot.send_document = mock.AsyncMock()
        info = {'path': '/x', 'size': 60 * 1024 * 1024, 'filename': 'big.pdf', 'name': 'a/big.pdf', 'caption': ''}
        with mock.patch.object(admin_panel.data, 'resolve_file', return_value=info):
            ok = asyncio.run(admin_panel._send_file(update, context, 'art', 'x', 0))
        self.assertFalse(ok)
        context.bot.send_document.assert_not_called()
        self.assertIn('50 MB', chat.send_message.call_args.args[0])
