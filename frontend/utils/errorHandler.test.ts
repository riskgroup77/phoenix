import { describe, expect, it } from 'vitest';
import { getErrorMessage } from './errorHandler';

describe('getErrorMessage', () => {
  it('asosiy "error" xabari qo\'shimcha bayroqlardan ustun', () => {
    // Avval {"error": ..., "reason_required": true} → "reason_required: true" ko'rsatilardi
    expect(getErrorMessage({ response: { error: 'Rad etish sababini yozing.', reason_required: true } })).toBe('Rad etish sababini yozing.');
    expect(getErrorMessage({ response: { error: 'Tekshiruv boshlandi.', plagiarism_check: 'started' } })).toBe('Tekshiruv boshlandi.');
  });

  it('ro\'yxat ko\'rinishidagi detail qavssiz chiqadi', () => {
    expect(getErrorMessage({ response: { detail: ["Bu maqola uchun nashr to'lovi allaqachon qilingan."] } })).toBe(
      "Bu maqola uchun nashr to'lovi allaqachon qilingan.",
    );
  });

  it('maydon xatolari saqlangan', () => {
    expect(getErrorMessage({ response: { email: ["Namuna (demo) hisobda bu maydonni o'zgartirib bo'lmaydi."] } })).toBe(
      "email: Namuna (demo) hisobda bu maydonni o'zgartirib bo'lmaydi.",
    );
  });
});
