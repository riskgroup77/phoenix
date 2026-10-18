/** "Ma'lumotnoma" tugmasi: hujjat holati haqidagi PDF ni yangi oynada ochadi (bloklansa — yuklab oladi). */
import { toast } from 'react-toastify';
import { apiService, saveBlob } from '../services/apiService';

export type ReferenceKind = 'article' | 'udk_request' | 'udk_certificate' | 'doi';

export async function openReferencePdf(kind: ReferenceKind, id: string | number, errorText: string): Promise<void> {
  // Brauzer popup blokerini chetlab o'tish: oyna bosish paytida (sinxron) ochiladi, PDF tayyor bo'lgach yuklanadi
  const win = window.open('', '_blank');
  try {
    const blob = await apiService.articles.referencePdf(kind, id);
    const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
    if (win && !win.closed) {
      win.location.href = url;
    } else {
      saveBlob(blob, `Malumotnoma_${id}.pdf`);
    }
    window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    win?.close();
    toast.error((e as Error)?.message || errorText);
  }
}

/** Arxiv elementi (ServiceDoc) → ma'lumotnoma turi va ID */
export function referenceTarget(doc: { type: string; id: string }): { kind: ReferenceKind; id: string } | null {
  const tail = (prefix: string) => doc.id.startsWith(prefix) ? doc.id.slice(prefix.length) : null;
  if (doc.type === 'udk_standalone') {
    const id = tail('udk-');
    return id ? { kind: 'udk_certificate', id } : null;
  }
  if (doc.type === 'udk_request_order') {
    const id = tail('udkreq-');
    return id ? { kind: 'udk_request', id } : null;
  }
  if (doc.type === 'doi_link') {
    const id = tail('doi-');
    return id ? { kind: 'doi', id } : null;
  }
  return null;
}
