import { ArticleStatus } from '../types';

export type OperatorServiceType =
  | 'DOI'
  | 'UDK'
  | 'ArticleSample'
  | 'PlagiarismCheck'
  | 'Translation'
  | 'BookPublication'
  | 'JournalArticle';

export interface OperatorRequestRow {
  id: string;
  articleTitle?: string;
  authorName?: string;
  journalName?: string;
  serviceType: OperatorServiceType;
  status: ArticleStatus | string;
  createdAt: string;
  assignedTo?: string;
  detailPath?: string;
}

function asArray(res: unknown): unknown[] {
  if (Array.isArray(res)) return res;
  if (res && typeof res === 'object') {
    const o = res as Record<string, unknown>;
    if (Array.isArray(o.results)) return o.results;
    if (Array.isArray(o.data)) return o.data;
  }
  return [];
}

function authorFromParts(first?: string, last?: string, middle?: string, short?: string): string {
  const s = (short || '').trim();
  if (s) return s;
  return [last, first, middle].map((x) => (x || '').trim()).filter(Boolean).join(' ');
}

const BOOK_STATUSES = new Set([
  'ContractProcessing',
  'IsbnProcessing',
  'AuthorDataVerified',
  'PaymentCompleted',
  'SentToPrint',
  'Printing',
  'Ready',
  'Packaging',
  'Shipping',
  'Delivered',
  'ProcessPaused',
]);

export function mapUdkRequests(items: unknown[]): OperatorRequestRow[] {
  return items.map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
      id: `udk-${String(r.id)}`,
      articleTitle: String(r.title || 'UDK so\'rovi'),
      authorName: authorFromParts(
        String(r.author_first_name || ''),
        String(r.author_last_name || ''),
        String(r.author_middle_name || ''),
        String(r.author_short || '')
      ),
      journalName: '—',
      serviceType: 'UDK',
      status: String(r.status || 'pending'),
      createdAt: String(r.created_at || new Date().toISOString()),
      detailPath: '/udk-requests',
    };
  });
}

export function mapDoiRequests(items: unknown[]): OperatorRequestRow[] {
  return items.map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
      id: `doi-${String(r.id)}`,
      articleTitle: 'DOI so\'rovi',
      authorName: authorFromParts(
        String(r.author_first_name || ''),
        String(r.author_last_name || ''),
        undefined,
        String(r.author_short || '')
      ),
      journalName: '—',
      serviceType: 'DOI',
      status: String(r.status || 'pending'),
      createdAt: String(r.created_at || new Date().toISOString()),
      detailPath: '/doi-requests',
    };
  });
}

export function mapArticleSampleRequests(items: unknown[]): OperatorRequestRow[] {
  return items.map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
      id: `sample-${String(r.id)}`,
      articleTitle: String(r.topic || 'Maqola namuna'),
      authorName: authorFromParts(
        String(r.author_first_name || ''),
        String(r.author_last_name || ''),
        undefined,
        String(r.author_short || '')
      ),
      journalName: '—',
      serviceType: 'ArticleSample',
      status: String(r.status || 'pending'),
      createdAt: String(r.created_at || new Date().toISOString()),
      detailPath: '/article-sample-requests',
    };
  });
}

export function mapTranslationRequests(items: unknown[]): OperatorRequestRow[] {
  return items.map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
      id: `tr-${String(r.id)}`,
      articleTitle: String(r.title || r.source_language || 'Tarjima so\'rovi'),
      authorName: String(r.author_name || r.requester_name || '—'),
      journalName: '—',
      serviceType: 'Translation',
      status: String(r.status || 'pending'),
      createdAt: String(r.created_at || r.submission_date || new Date().toISOString()),
      detailPath: r.id ? `/translations/${String(r.id)}` : '/my-translations',
    };
  });
}

export function mapStaffArticles(items: unknown[]): OperatorRequestRow[] {
  return items.map((raw) => {
    const r = raw as Record<string, unknown>;
    const title = String(r.title || 'Maqola');
    const isBook = title.startsWith('[KITOB]') || BOOK_STATUSES.has(String(r.status || ''));
    const keywords = Array.isArray(r.keywords) ? r.keywords.map(String) : [];
    const isPlagiarism =
      title.toLowerCase().startsWith('plagiarism check') ||
      keywords.some((k) => k.toLowerCase() === 'plagiarism');

    let serviceType: OperatorServiceType = 'JournalArticle';
    if (isBook) serviceType = 'BookPublication';
    else if (isPlagiarism) serviceType = 'PlagiarismCheck';

    return {
      id: `art-${String(r.id)}`,
      articleTitle: title,
      authorName: String(r.author_name || '—'),
      journalName: String(r.journal_name || '—'),
      serviceType,
      status: String(r.status || ArticleStatus.Yangi),
      createdAt: String(r.submission_date || new Date().toISOString()),
      detailPath: r.id ? `/articles/${String(r.id)}` : '/articles',
    };
  });
}

export function mergeOperatorRequests(parts: OperatorRequestRow[][]): OperatorRequestRow[] {
  return parts
    .flat()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function fetchAllOperatorRequests(api: {
  udc: { requests: { list: () => Promise<unknown> } };
  articles: {
    getDoiRequests: () => Promise<unknown>;
    getArticleSampleRequests: () => Promise<unknown>;
    staff: () => Promise<unknown>;
  };
  translations: { list: () => Promise<unknown> };
}): Promise<OperatorRequestRow[]> {
  const [udkRes, doiRes, samplesRes, transRes, staffRes] = await Promise.all([
    api.udc.requests.list().catch(() => []),
    api.articles.getDoiRequests().catch(() => []),
    api.articles.getArticleSampleRequests().catch(() => []),
    api.translations.list().catch(() => []),
    api.articles.staff().catch(() => []),
  ]);

  return mergeOperatorRequests([
    mapUdkRequests(asArray(udkRes)),
    mapDoiRequests(asArray(doiRes)),
    mapArticleSampleRequests(asArray(samplesRes)),
    mapTranslationRequests(asArray(transRes)),
    mapStaffArticles(asArray(staffRes)),
  ]);
}
