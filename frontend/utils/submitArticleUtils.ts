/** Rough page estimate from Word file size (bytes). User can override in the form. */
export function estimatePageCountFromFile(file: File | null): number {
  if (!file) return 1;
  const name = file.name.toLowerCase();
  if (!name.endsWith('.docx') && !name.endsWith('.doc')) return 1;
  // ~2–3 KB per page typical for uncompressed docx XML
  const estimated = Math.ceil(file.size / 2800);
  return Math.max(1, Math.min(500, estimated));
}

export function parsePageCount(value: number | string | undefined): number {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(500, Math.floor(n));
}

export type SubmitArticleFormSlice = {
  title: string;
  authorName: string;
  journalId: string;
  abstract: string;
  keywords: string;
  references: string;
  pageCount: number;
  coAuthors: { name: string; identifier: string }[];
};

export function buildArticlePayload(
  form: SubmitArticleFormSlice,
  options?: {
    awaitingPublicationPayment?: boolean;
    paymentTransactionId?: string | null;
  }
): Record<string, unknown> {
  const keywordsList = form.keywords.trim()
    ? form.keywords.split(/\s*,\s*/).map((k) => k.trim()).filter(Boolean)
    : [];

  const payload: Record<string, unknown> = {
    title: form.title.trim(),
    journal: form.journalId,
    abstract: form.abstract.trim() || '',
    keywords: keywordsList,
    page_count: parsePageCount(form.pageCount),
    fast_track: false,
  };

  const authorName = form.authorName.trim();
  if (authorName) {
    payload.submitted_author_name = authorName;
  }

  const bibliography = form.references.trim();
  if (bibliography) {
    payload.bibliography = bibliography;
  }

  const coAuthorContacts = form.coAuthors
    .map((coAuthor) => ({
      name: coAuthor.name.trim(),
      identifier: coAuthor.identifier.trim(),
    }))
    .filter((coAuthor) => coAuthor.identifier);

  if (coAuthorContacts.length > 0) {
    payload.co_author_contacts = coAuthorContacts;
  }

  if (options?.awaitingPublicationPayment) {
    payload.awaiting_publication_payment = true;
  }

  if (options?.paymentTransactionId) {
    payload.payment_transaction_id = options.paymentTransactionId;
  }

  return payload;
}

export function computePublicationPaymentAmount(
  journal: {
    publication_fee?: number;
    price_per_page?: number;
    pricing_type?: string;
  } | undefined,
  pageCount: number
): number {
  if (!journal) return 0;
  const pubFee = journal.publication_fee != null ? Number(journal.publication_fee) : 0;
  const perPage = journal.price_per_page != null ? Number(journal.price_per_page) : 0;
  const pages = parsePageCount(pageCount);
  const isPerPage = journal.pricing_type === 'per_page';

  if (isPerPage && perPage > 0) return perPage * pages;
  if (pubFee > 0) return pubFee;
  if (perPage > 0) return perPage * pages;
  return 0;
}
