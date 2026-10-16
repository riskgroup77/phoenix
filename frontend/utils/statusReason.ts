/**
 * Rad etish / tahrirga qaytarish sababini so'rash (server ham majburiy qiladi — apps/articles/views_publication.py).
 * Natija: sabab matni; `null` — foydalanuvchi bekor qildi yoki juda qisqa yozdi; `undefined` — bu holat uchun sabab kerak emas.
 */
import { toast } from 'react-toastify';

export const REASON_MIN_LENGTH = 5;

const PROMPTS: Record<string, string> = {
  Rejected: 'Rad etish sababi (muallifga yuboriladi):',
  Revision: "Tahrirga qaytarish sababi — muallif nimani tuzatishi kerak (muallifga yuboriladi):",
};

export const statusNeedsReason = (status: string): boolean => status in PROMPTS;

export function askStatusReason(status: string): string | null | undefined {
  const prompt = PROMPTS[status];
  if (!prompt) return undefined;
  const input = window.prompt(prompt);
  if (input === null) return null;
  const reason = input.trim();
  if (reason.length < REASON_MIN_LENGTH) {
    toast.error(`Sababni yozing (kamida ${REASON_MIN_LENGTH} ta belgi).`);
    return null;
  }
  return reason;
}
