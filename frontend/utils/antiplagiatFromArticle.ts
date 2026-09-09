import { DEFAULT_ENABLED_MODULE_IDS, ANTIPLAGIAT_MODULES } from '../constants/antiplagiatModules';
import type { AntiplagiatCertificateData } from '../components/AntiplagiatCertificate';
import type {
  AnnotatedParagraph,
  PlagiarismFragmentDetail,
  PlagiarismFullReportData,
  PlagiarismSource,
} from '../components/PlagiarismFullReport';

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

type ApiSource = {
  source?: string;
  snippet?: string;
  similarity?: number;
  search_module?: string;
  title?: string;
  document_fragment?: string;
  source_fragment?: string;
  source_index?: number;
};

function mapSources(apiSources: unknown) {
  if (!Array.isArray(apiSources)) return [];
  return apiSources
    .map((s: ApiSource) => ({
      source: (s.source || '').trim(),
      snippet: (s.snippet || '').trim(),
      title: (s.title || '').trim(),
      similarity: typeof s.similarity === 'number' ? s.similarity : 0,
      search_module: s.search_module,
      document_fragment: (s.document_fragment || s.snippet || '').trim(),
      source_fragment: (s.source_fragment || '').trim(),
      source_index: typeof s.source_index === 'number' ? s.source_index : undefined,
    }))
    .filter((s) => s.source || s.snippet || s.title);
}

function mapFragmentDetails(report: Record<string, unknown>, sources: ReturnType<typeof mapSources>): PlagiarismFragmentDetail[] {
  const raw = report.fragment_details;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((f: Record<string, unknown>, idx: number) => ({
      sourceIndex: Number(f.source_index ?? idx + 1),
      title: String(f.title || '').slice(0, 200),
      sourceUrl: String(f.source || '').startsWith('http') ? String(f.source) : undefined,
      documentFragment: String(f.document_fragment || f.snippet || ''),
      sourceFragment: String(f.source_fragment || ''),
      percentage: `${Number(f.similarity || 0).toFixed(2)}%`,
      searchModule: String(f.search_module || '').includes('qidiruv moduli')
        ? String(f.search_module)
        : `${f.search_module || 'Search module INTERNET PLUS'} qidiruv moduli`,
    }));
  }
  return sources
    .filter((s) => s.similarity > 0 && (s.document_fragment || s.source_fragment))
    .slice(0, 40)
    .map((s, idx) => ({
      sourceIndex: s.source_index ?? idx + 1,
      title: s.title || s.snippet || s.source,
      sourceUrl: s.source.startsWith('http') ? s.source : undefined,
      documentFragment: s.document_fragment || s.snippet,
      sourceFragment: s.source_fragment || '',
      percentage: `${s.similarity.toFixed(2)}%`,
      searchModule: s.search_module?.includes('qidiruv moduli')
        ? (s.search_module as string)
        : `${s.search_module || 'Search module INTERNET PLUS'} qidiruv moduli`,
    }));
}

function mapAnnotatedDocument(report: Record<string, unknown>): AnnotatedParagraph[] {
  const raw = report.annotated_document;
  if (!Array.isArray(raw)) return [];
  return raw.map((p: Record<string, unknown>) => ({
    text: String(p.text || ''),
    sourceRefs: Array.isArray(p.source_refs)
      ? p.source_refs.map((r) => Number(r)).filter((n) => !Number.isNaN(n))
      : [],
  }));
}

function toReportSource(
  s: {
    source: string;
    snippet: string;
    similarity: number;
    search_module?: string;
    title?: string;
    document_fragment?: string;
    source_fragment?: string;
    source_index?: number;
  },
  idx: number,
): PlagiarismSource {
  const rawUrl = s.source.startsWith('http') ? s.source : '';
  const title = s.title || s.snippet || (rawUrl ? s.source.replace(/^https?:\/\//, '').slice(0, 120) : s.source);
  const mod = s.search_module || 'Search module INTERNET PLUS';
  const modLabel = mod.includes('qidiruv moduli') ? mod : `${mod} qidiruv moduli`;
  return {
    id: s.source_index ?? idx + 1,
    percentage: `${Number(s.similarity).toFixed(2)}%`,
    sourceName: title.slice(0, 200),
    sourceUrl: rawUrl || undefined,
    searchModule: modLabel,
    documentFragment: s.document_fragment || s.snippet,
    sourceFragment: s.source_fragment,
  };
}

export function buildAntiplagiatViewFromArticle(article: AntiplagiatArticlePayload): AntiplagiatViewState | null {
  if (!article?.plagiarism_checked_at) {
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
    fragmentDetails: mapFragmentDetails(report, sources),
    annotatedDocument: mapAnnotatedDocument(report),
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
