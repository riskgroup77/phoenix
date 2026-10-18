import { describe, expect, it } from 'vitest';
import { dedupeReportSources } from './antiplagiatFromArticle';

const src = (id: number, url: string, pct: number) => ({
  id, percentage: `${pct.toFixed(2)}%`, sourceName: `Manba ${url}`, sourceUrl: url, searchModule: 'X qidiruv moduli',
});

describe('dedupeReportSources', () => {
  it('bir URL dagi takror qatorlar bitta manbaga birlashadi va havolalar qayta raqamlanadi', () => {
    const out = dedupeReportSources(
      [src(1, 'https://a.uz/pd-13', 2.71), src(2, 'https://b.uz/x', 5.1), src(3, 'https://a.uz/pd-13/', 2.9)],
      [{ sourceIndex: 3, title: 't', documentFragment: 'd', sourceFragment: 's', percentage: '2.90%', searchModule: 'm' }],
      [{ text: 'p', sourceRefs: [1, 3, 2], segments: [{ text: 'p', source: 3 }] }],
    );
    expect(out.sources.map((s) => [s.id, s.sourceUrl, s.percentage, s.fragmentCount])).toEqual([
      [1, 'https://b.uz/x', '5.10%', 1],
      [2, 'https://a.uz/pd-13', '2.90%', 2],
    ]);
    expect(out.fragmentDetails[0].sourceIndex).toBe(2);
    expect(out.annotatedDocument[0].sourceRefs).toEqual([2, 1]);
    expect(out.annotatedDocument[0].segments?.[0].source).toBe(2);
  });
});
