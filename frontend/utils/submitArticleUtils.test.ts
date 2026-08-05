import { describe, expect, it } from 'vitest';
import {
  buildArticlePayload,
  computePublicationPaymentAmount,
  estimatePageCountFromFile,
  parsePageCount,
} from './submitArticleUtils';

describe('parsePageCount', () => {
  it('returns at least 1', () => {
    expect(parsePageCount(0)).toBe(1);
    expect(parsePageCount('abc')).toBe(1);
    expect(parsePageCount(12)).toBe(12);
    expect(parsePageCount(9999)).toBe(500);
  });
});

describe('estimatePageCountFromFile', () => {
  it('estimates from docx size', () => {
    const file = new File(['x'.repeat(5600)], 'paper.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    expect(estimatePageCountFromFile(file)).toBeGreaterThan(1);
  });
});

describe('buildArticlePayload', () => {
  it('includes author name, page count, and bibliography', () => {
    const payload = buildArticlePayload({
      title: 'Test',
      authorName: 'Ali Valiyev',
      journalId: 'journal-uuid',
      abstract: 'Abstract',
      keywords: 'a, b',
      references: 'Ref 1',
      pageCount: 15,
      coAuthors: [],
    });
    expect(payload.submitted_author_name).toBe('Ali Valiyev');
    expect(payload.page_count).toBe(15);
    expect(payload.bibliography).toBe('Ref 1');
    expect(payload.journal).toBe('journal-uuid');
  });
});

describe('computePublicationPaymentAmount', () => {
  it('uses per-page pricing when configured', () => {
    const amount = computePublicationPaymentAmount(
      { pricing_type: 'per_page', price_per_page: 1000, publication_fee: 0 },
      10
    );
    expect(amount).toBe(10000);
  });

  it('uses fixed publication fee', () => {
    const amount = computePublicationPaymentAmount(
      { pricing_type: 'fixed', publication_fee: 50000, price_per_page: 0 },
      1
    );
    expect(amount).toBe(50000);
  });
});
