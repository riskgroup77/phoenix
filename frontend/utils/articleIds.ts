/**
 * API ba'zan `journal` (UUID string yoki { id }), ba'zan `journalId` qaytaradi.
 */
export function getArticleJournalIdFromApi(a: {
  journal?: unknown;
  journalId?: string;
} | null | undefined): string {
  if (!a) return '';
  const j = (a as { journal?: unknown }).journal;
  if (typeof j === 'string') return j;
  if (j && typeof j === 'object' && j !== null && 'id' in (j as object)) {
    const id = (j as { id?: string }).id;
    if (typeof id === 'string') return id;
  }
  if (typeof (a as { journalId?: string }).journalId === 'string') {
    return (a as { journalId: string }).journalId;
  }
  return '';
}
