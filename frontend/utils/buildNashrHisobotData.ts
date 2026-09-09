import type { NashrHisobotData, PublishedArticle } from '../components/NashrHisobotCertificate';
import { ArticleStatus } from '../types';

export interface PlatformArticleForReport {
  id: string;
  title: string;
  status?: string;
  submission_date?: string;
  journal?: { name?: string } | string;
  journal_name?: string;
  doi?: string;
  file_url?: string;
}

export interface ExternalPublicationForReport {
  id: string;
  title: string;
  publication_type?: string;
  publication_type_display?: string;
  publication_date?: string;
  doi?: string;
  pages?: string;
  co_authors?: string;
  file_url?: string;
  journal?: { name?: string };
  conference?: { title?: string; date?: string };
}

function parseCoAuthors(raw?: string): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function journalLabel(article: PlatformArticleForReport): string {
  if (typeof article.journal === 'object' && article.journal?.name) return article.journal.name;
  if (typeof article.journal === 'string' && article.journal) return article.journal;
  return article.journal_name || "Noma'lum jurnal";
}

function formatPlatformPublishName(article: PlatformArticleForReport): string {
  const journal = journalLabel(article);
  const date = article.submission_date
    ? new Date(article.submission_date).toLocaleDateString('uz-UZ')
    : '';
  return date ? `Jurnal: «${journal}» / ${date}` : `Jurnal: «${journal}»`;
}

function formatExternalPublishName(pub: ExternalPublicationForReport): string {
  const date = pub.publication_date
    ? new Date(pub.publication_date).toLocaleDateString('uz-UZ')
    : '';
  if (pub.journal?.name) {
    const parts = [`Jurnal: «${pub.journal.name}»`];
    if (pub.pages) parts.push(pub.pages);
    if (date) parts.push(date);
    return parts.join(' / ');
  }
  if (pub.conference?.title) {
    return `Xalqaro konferensiya: «${pub.conference.title}»${date ? ` / ${date}` : ''}`;
  }
  const typeLabel = pub.publication_type_display || pub.publication_type || 'Nashr';
  return date ? `${typeLabel} / ${date}` : typeLabel;
}

function platformArticleLink(article: PlatformArticleForReport): string {
  if (article.doi?.trim()) {
    const d = article.doi.trim();
    return d.startsWith('http') ? d : `https://doi.org/${d.replace(/^https?:\/\/doi.org\//i, '')}`;
  }
  if (article.file_url?.startsWith('http')) return article.file_url;
  return `https://ilmiyfaoliyat.uz/#/public/article/${article.id}`;
}

function externalPublicationLink(pub: ExternalPublicationForReport): string {
  if (pub.doi?.trim()) {
    const d = pub.doi.trim();
    return d.startsWith('http') ? d : `https://doi.org/${d.replace(/^https?:\/\/doi.org\//i, '')}`;
  }
  if (pub.file_url?.startsWith('http')) return pub.file_url;
  return '-';
}

export function buildNashrHisobotRows(
  platformArticles: PlatformArticleForReport[],
  externalPublications: ExternalPublicationForReport[],
): PublishedArticle[] {
  const publishedPlatform = platformArticles.filter((a) => a.status === ArticleStatus.Published);
  const rows: PublishedArticle[] = [];

  publishedPlatform.forEach((article, index) => {
    rows.push({
      id: index + 1,
      title: article.title,
      publishName: formatPlatformPublishName(article),
      publishDate: article.submission_date
        ? new Date(article.submission_date).toLocaleDateString('uz-UZ')
        : undefined,
      internetLink: platformArticleLink(article),
      coAuthors: [],
    });
  });

  externalPublications.forEach((pub) => {
    const link = externalPublicationLink(pub);
    rows.push({
      id: rows.length + 1,
      title: pub.title,
      publishName: formatExternalPublishName(pub),
      publishDate: pub.publication_date
        ? new Date(pub.publication_date).toLocaleDateString('uz-UZ')
        : undefined,
      internetLink: link,
      coAuthors: parseCoAuthors(pub.co_authors),
    });
  });

  return rows.map((row, idx) => ({ ...row, id: idx + 1 }));
}

export function buildNashrHisobotData(params: {
  user: {
    firstName?: string;
    lastName?: string;
    email?: string;
    affiliation?: string;
    degree?: string;
    position?: string;
  };
  platformArticles: PlatformArticleForReport[];
  externalPublications: ExternalPublicationForReport[];
}): NashrHisobotData {
  const { user, platformArticles, externalPublications } = params;
  return {
    documentNumber: `HSB-${Date.now().toString(36).toUpperCase()}`,
    documentDate: new Date().toLocaleDateString('uz-UZ'),
    authorFullName: `${user.lastName || ''} ${user.firstName || ''}`.trim() || user.email || 'Muallif',
    authorWorkplace: user.affiliation || "Ko'rsatilmagan",
    authorPosition: user.degree || user.position || 'Muallif',
    articles: buildNashrHisobotRows(platformArticles, externalPublications),
  };
}
