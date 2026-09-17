"""Ilmiy Faoliyat ilovasi (sayt) havolalari."""
from bot.api_client import PhonixApiClient


def app_url(client: PhonixApiClient, hash_path: str) -> str:
    path = hash_path if hash_path.startswith('#') else f'#{hash_path.lstrip("/")}'
    return f"{client.frontend_url.rstrip('/')}/{path}"


def dashboard_url(client: PhonixApiClient) -> str:
    return app_url(client, '#/dashboard')


def articles_url(client: PhonixApiClient) -> str:
    return app_url(client, '#/articles?tab=journal')


def article_url(client: PhonixApiClient, article_id: str) -> str:
    return app_url(client, f'#/articles/{article_id}')


def submit_article_url(client: PhonixApiClient) -> str:
    return app_url(client, '#/submit-article')


def archive_url(client: PhonixApiClient) -> str:
    return app_url(client, '#/arxiv')


def profile_url(client: PhonixApiClient, tab: str = 'profile') -> str:
    return app_url(client, f'#/profile?tab={tab}')


def translations_url(client: PhonixApiClient) -> str:
    return app_url(client, '#/my-translations')


def translation_url(client: PhonixApiClient, req_id: str) -> str:
    return app_url(client, f'#/translations/{req_id}')


def publications_url(client: PhonixApiClient) -> str:
    return app_url(client, '#/author-publications')


def collections_url(client: PhonixApiClient) -> str:
    return app_url(client, '#/articles?tab=collections')


def service_url(client: PhonixApiClient, path: str) -> str:
    return app_url(client, path)


def plagiarism_result_url(client: PhonixApiClient, article_id: str) -> str:
    return app_url(client, f'#/plagiarism-check/result/{article_id}')


def plagiarism_check_url(client: PhonixApiClient) -> str:
    return app_url(client, '#/plagiarism-check')


SERVICE_APP_PATHS = {
    'doi': '#/doi-olish',
    'udk': '#/udk-olish',
    'translation': '#/translation-service',
    'plagiarism': '#/plagiarism-check',
    'sample': '#/maqola-namuna',
    'book': '#/submit-book',
}
