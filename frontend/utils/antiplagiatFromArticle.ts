import { DEFAULT_ENABLED_MODULE_IDS, ANTIPLAGIAT_MODULES } from '../constants/antiplagiatModules';
import type { AntiplagiatCertificateData } from '../components/AntiplagiatCertificate';
import type { PlagiarismFullReportData, PlagiarismSource } from '../components/PlagiarismFullReport';

export interface AntiplagiatArticlePayload {
  id?: string;
  title?: string;
  plagiarism_percentage?: number | null;
  ai_content_percentage?: number | null;
  originality_percentage?: number | null;
  plagiarism_checked_at?: string | null;
  plagiarism_report?: Record<string, unknown> | null;
  author_name?: string;
}

export interface AntiplagiatViewState {
  result: {
    plagiarism: number;
    aiContent: number;
    citations: number;
    selfCitation: number;
    sources: { source: string; similarity: number; snippet: string; search_module?: string; title?: string }[];
  };
  certificateData: AntiplagiatCertificateData;
  fullReportData: PlagiarismFullReportData;
}

function mapSources(apiSources: unknown) {
  if (!Array.isArray(apiSources)) return [];
  return apiSources
    .map((s: { source?: string; snippet?: string; similarity?: number; search_module?: string; title?: string }) => ({
      source: (s.source || '').trim(),
      snippet: (s.snippet || '').trim(),
      title: (s.title || '').trim(),
      similarity: typeof s.similarity === 'number' ? s.similarity : 0,
      search_module: s.search_module,
    }))
    .filter((s) => s.source || s.snippet || s.title);
}

function toReportSource(
  s: { source: string; snippet: string; similarity: number; search_module?: string; title?: string },
  idx: number,
): PlagiarismSource {
  const rawUrl = s.source.startsWith('http') ? s.source : '';
  const title = s.title || s.snippet || (rawUrl ? s.source.replace(/^https?:\/\//, '').slice(0, 120) : s.source);
  const mod = s.search_module || 'Search module INTERNET PLUS';
  const modLabel = mod.includes('qidiruv moduli') ? mod : `${mod} qidiruv moduli`;
  return {
    id: idx + 1,
    percentage: `${Number(s.similarity).toFixed(2)}%`,
    sourceName: title.slice(0, 200),
    sourceUrl: rawUrl || undefined,
    searchModule: modLabel,
  };
}

export function buildAntiplagiatViewFromArticle(article: AntiplagiatArticlePayload): AntiplagiatViewState | null {
  if (!article?.plagiarism_checked_at || article.plagiarism_percentage == null) {
    return null;
  }

  const report = (article.plagiarism_report || {}) as Record<string, unknown>;
  const plagiarismPercentage = Number(article.plagiarism_percentage) || 0;
  const aiContentPercentage = Number(article.ai_content_percentage) || 0;
  const originality =
    article.originality_percentage != null
      ? Number(article.originality_percentage)
      : Math.max(0, 100 - plagiarismPercentage);
  const citationPct = Number(report.citation_percent ?? 0);
  const selfCitationPct = Number(report.self_citation_percent ?? 0);
  const sources = mapSources(report.sources);
  const enabledIds = Array.isArray(report.enabled_module_ids)
    ? (report.enabled_module_ids as string[])
    : DEFAULT_ENABLED_MODULE_IDS;
  const enabledCount = enabledIds.length || DEFAULT_ENABLED_MODULE_IDS.length;

  const authorFirst = String(report.author_first_name || '').trim();
  const authorLast = String(report.author_last_name || '').trim();
  const author =
    `${authorLast} ${authorFirst}`.trim() ||
    String(article.author_name || '').trim() ||
    'Muallif';

  const documentName = String(report.document_name || article.title || '').trim() || 'Hujjat';
  const documentType = String(report.document_type || 'Ilmiy ish');
  const certNumber = String(report.certificate_number || article.id?.slice(-8) || Date.now().toString().slice(-6));
  const checkDate = article.plagiarism_checked_at
    ? new Date(article.plagiarism_checked_at).toLocaleDateString('uz-UZ')
    : new Date().toLocaleDateString('uz-UZ');

  const result = {
    plagiarism: plagiarismPercentage,
    aiContent: aiContentPercentage,
    citations: citationPct,
    selfCitation: selfCitationPct,
    sources,
  };

  const certificateData: AntiplagiatCertificateData = {
    certificateNumber: certNumber,
    checkDate,
    author,
    workType: documentType,
    fileName: documentName,
    citations: `${citationPct.toFixed(1)}%`,
    selfCitation: `${selfCitationPct.toFixed(1)}%`,
    plagiarism: `${plagiarismPercentage.toFixed(2)}%`,
    originality: `${originality.toFixed(2)}%`,
    searchModules: `${enabledCount} ta moduldan / ${enabledCount} tasida tekshirilgan`,
  };

  const fullReportData: PlagiarismFullReportData = {
    checkerName: author,
    checkerId: String(article.id || '').slice(-5) || '00000',
    checkerOrganization: '',
    documentNumber: certNumber,
    uploadDate: checkDate,
    originalFileName: documentName,
    documentName,
    documentType,
    characterCount: Number(report.character_count) || 0,
    sentenceCount: Number(report.sentence_count) || 0,
    fileSize: '—',
    plagiarismPercent: plagiarismPercentage,
    selfCitationPercent: selfCitationPct,
    citationPercent: citationPct,
    originalityPercent: originality,
    searchModules: Array.isArray(report.search_modules)
      ? (report.search_modules as string[])
      : enabledIds
          .map((id) => ANTIPLAGIAT_MODULES.find((m) => m.id === id)?.label)
          .filter(Boolean) as string[],
    sources: sources.map((s, idx) => toReportSource(s, idx)),
  };

  return { result, certificateData, fullReportData };
}

export function isStandalonePlagiarismArticle(article: {
  title?: string;
  keywords?: string[] | string;
  abstract?: string;
  plagiarism_report?: Record<string, unknown> | null;
}): boolean {
  const title = (article.title || '').trim().toLowerCase();
  if (title.startsWith('plagiarism check')) return true;

  const keywords = Array.isArray(article.keywords)
    ? article.keywords
    : typeof article.keywords === 'string'
      ? article.keywords.split(',')
      : [];
  if (keywords.some((k) => String(k).trim().toLowerCase() === 'plagiarism')) return true;

  const abstract = (article.abstract || '').toLowerCase();
  if (abstract.includes('tekshiruv uchun yuborilgan') || abstract.includes('hujjat turi:')) return true;

  const report = article.plagiarism_report;
  if (report && typeof report === 'object') {
    if (
      report.pending_enabled_modules ||
      report.archive_ready ||
      report.document_type ||
      report.document_name
    ) {
      return true;
    }
  }

  return false;
}
