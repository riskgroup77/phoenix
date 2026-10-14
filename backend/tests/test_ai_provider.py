"""
Claude (Anthropic) AI provayderi: ANTHROPIC_API_KEY bo'lsa barcha AI chaqiruvlari Claude orqali o'tadi.
Haqiqiy API chaqirilmaydi — mijoz soxta obyekt bilan almashtiriladi.
"""
from io import StringIO
from types import SimpleNamespace
from unittest import mock

import anthropic
import httpx2
from django.core.management import call_command
from django.test import SimpleTestCase, override_settings

from apps.assistant.llm import llm_enabled
from apps.services import CLAUDE_FALLBACK_BETA, GeminiService, ai_provider

CLAUDE = {'ANTHROPIC_API_KEY': 'sk-ant-test', 'GEMINI_API_KEY': '', 'AI_PROVIDER': 'auto'}


def _response(*texts, stop_reason='end_turn', stop_details=None):
    return SimpleNamespace(
        content=[SimpleNamespace(type='thinking', thinking='')] + [SimpleNamespace(type='text', text=t) for t in texts],
        stop_reason=stop_reason,
        stop_details=stop_details,
        _request_id='req_test',
    )


def _service_with(create):
    service = GeminiService()
    service._claude = SimpleNamespace(beta=SimpleNamespace(messages=SimpleNamespace(create=create)))
    return service


class ProviderSelectionTests(SimpleTestCase):
    def test_auto_prefers_claude_then_gemini(self):
        with override_settings(ANTHROPIC_API_KEY='a', GEMINI_API_KEY='g', AI_PROVIDER='auto'):
            self.assertEqual(ai_provider(), 'anthropic')
        with override_settings(ANTHROPIC_API_KEY='', GEMINI_API_KEY='g', AI_PROVIDER='auto'):
            self.assertEqual(ai_provider(), 'gemini')
        with override_settings(ANTHROPIC_API_KEY='', GEMINI_API_KEY='', AI_PROVIDER='auto'):
            self.assertIsNone(ai_provider())

    def test_forced_provider_needs_its_own_key(self):
        with override_settings(ANTHROPIC_API_KEY='a', GEMINI_API_KEY='g', AI_PROVIDER='gemini'):
            self.assertEqual(ai_provider(), 'gemini')
        with override_settings(ANTHROPIC_API_KEY='', GEMINI_API_KEY='g', AI_PROVIDER='anthropic'):
            self.assertIsNone(ai_provider())

    def test_assistant_llm_enabled_with_claude_key(self):
        with override_settings(**CLAUDE, ASSISTANT_LLM_ENABLED=True):
            self.assertTrue(llm_enabled())
        with override_settings(**CLAUDE, ASSISTANT_LLM_ENABLED=False):
            self.assertFalse(llm_enabled())


@override_settings(**CLAUDE, ANTHROPIC_MODEL='claude-opus-5-5', ANTHROPIC_EFFORT='low', ANTHROPIC_MAX_TOKENS=16000)
class ClaudeCallTests(SimpleTestCase):
    def test_request_shape_and_text(self):
        create = mock.Mock(return_value=_response('Salom', '!'))
        service = _service_with(create)
        self.assertEqual(service.provider, 'anthropic')
        self.assertEqual(service.active_model, 'claude-opus-5-5')
        self.assertEqual(service._generate_text('salom de'), 'Salom!')
        kwargs = create.call_args.kwargs
        self.assertEqual(kwargs['model'], 'claude-opus-5-5')
        self.assertEqual(kwargs['fallbacks'], 'default')
        self.assertEqual(kwargs['betas'], [CLAUDE_FALLBACK_BETA])
        self.assertEqual(kwargs['output_config'], {'effort': 'low'})
        self.assertEqual(kwargs['messages'], [{'role': 'user', 'content': 'salom de'}])
        self.assertNotIn('temperature', kwargs)  # Opus 5.5 da sampling parametrlari 400 beradi

    @override_settings(ANTHROPIC_EFFORT='juda-baland')
    def test_invalid_effort_falls_back_to_low(self):
        create = mock.Mock(return_value=_response('ok'))
        _service_with(create)._generate_text('x')
        self.assertEqual(create.call_args.kwargs['output_config'], {'effort': 'low'})

    def test_refusal_returns_none(self):
        create = mock.Mock(return_value=_response(stop_reason='refusal', stop_details=SimpleNamespace(category='cyber')))
        self.assertIsNone(_service_with(create)._generate_text('x'))

    def test_api_errors_return_none(self):
        request = httpx2.Request('POST', 'https://api.anthropic.com/v1/messages')
        errors = [
            anthropic.AuthenticationError('bad key', response=httpx2.Response(401, request=request), body=None),
            anthropic.RateLimitError('slow down', response=httpx2.Response(429, request=request), body=None),
            anthropic.InternalServerError('boom', response=httpx2.Response(500, request=request), body=None),
            anthropic.APIConnectionError(request=request),
        ]
        for error in errors:
            with self.subTest(error=type(error).__name__):
                self.assertIsNone(_service_with(mock.Mock(side_effect=error))._generate_text('x'))

    def test_assistant_uses_claude(self):
        from apps.assistant import llm

        reply = '{"intents": ["udk"], "fields": {"udk": {"title": "Sun\'iy intellekt"}}, "reply": ""}'
        create = mock.Mock(return_value=_response(reply))
        user = SimpleNamespace(pk='u1')
        with mock.patch('apps.services.get_gemini_service', return_value=_service_with(create)):
            out = llm.interpret(user, 'menga UDK kerak', state={}, file_info=None, lang='uz')
        self.assertEqual(out['intents'], ['udk'])
        self.assertEqual(out['fields']['udk']['title'], "Sun'iy intellekt")


class CheckAiCommandTests(SimpleTestCase):
    @override_settings(ANTHROPIC_API_KEY='', GEMINI_API_KEY='', AI_PROVIDER='auto')
    def test_reports_missing_key(self):
        out = StringIO()
        call_command('check_ai', stdout=out)
        self.assertIn("ANTHROPIC_API_KEY .env da: yo'q", out.getvalue())
        self.assertIn("Faol AI provayderi yo'q", out.getvalue())

    @override_settings(**CLAUDE)
    def test_live_call_success_never_prints_key(self):
        out = StringIO()
        with mock.patch.object(GeminiService, '_claude_text', return_value='Salom'):
            call_command('check_ai', stdout=out)
        self.assertIn("Javob keldi", out.getvalue())
        self.assertNotIn('sk-ant-test', out.getvalue())
