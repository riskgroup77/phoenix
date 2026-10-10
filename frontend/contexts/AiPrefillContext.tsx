import { createContext, useContext } from 'react';

/**
 * AI ish maydoni → xizmat sahifasi: yordamchi tayyorlagan maydonlar va biriktirilgan fayl.
 * Sahifa (UdkOlish, PlagiarismCheck, ...) `useAiPrefill('<intent>')` bilan oladi va o'z state'iga yozadi —
 * to'lov, narx va yuborish mantig'i sahifaning o'zida qoladi (muallif tasdiqlaydi).
 * `nonce` har yangi taklifda o'zgaradi: sahifa effektini shu bo'yicha qayta ishga tushiring.
 */
export type AiPrefill = {
  intent: string;
  fields: Record<string, unknown>;
  file: File | null;
  nonce: number;
};

export const AiPrefillContext = createContext<AiPrefill | null>(null);

export function useAiPrefill(intent: string): AiPrefill | null {
  const p = useContext(AiPrefillContext);
  return p && p.intent === intent ? p : null;
}

/** Sahifa AI ish maydoni ichida (o'ng panelda) ochilganmi */
export const AiEmbeddedContext = createContext(false);
export const useAiEmbedded = () => useContext(AiEmbeddedContext);

export const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
export const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
