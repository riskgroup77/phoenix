import { describe, expect, it } from 'vitest';
import { paginate } from './ReportFlow';
import { chunkParagraphs } from './PlagiarismFullReport';

describe('antiplagiat hisobot sahifalash', () => {
  it("bloklar sahifaga sig'adiganicha joylanadi, hech biri tushib qolmaydi", () => {
    const pages = paginate([{ head: 300, contHead: 50, note: 20, blocks: Array(30).fill(40) }], 800);
    expect(pages.flatMap((p) => p.blocks)).toEqual([...Array(30).keys()]);
    expect(pages[0].blocks.length).toBe(12); // (800-300)/40
    expect(pages[1].first).toBe(false);
    expect(pages[1].blocks.length).toBe(18); // (800-50)/40 → qolganlari
  });

  it("maxPages: ortiqcha bloklar o'rniga izoh uchun joy qoldiriladi va yashirinlar soni hisoblanadi", () => {
    const pages = paginate([{ head: 0, contHead: 0, note: 40, blocks: Array(50).fill(100) }], 800, 2);
    expect(pages).toHaveLength(2);
    const shown = pages.flatMap((p) => p.blocks).length;
    expect(shown).toBe(15);
    expect(pages[1].hidden).toBe(35);
  });

  it("uzun xatbosh gaplar bo'yicha bo'linadi, manba belgilari saqlanadi", () => {
    const seg = { text: 'a'.repeat(400) + '.', source: 3 };
    const chunks = chunkParagraphs([{ text: '', sourceRefs: [3], segments: [seg, seg, seg] }], 900);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].segments.every((s) => s.source === 3)).toBe(true);
    expect(chunks[0].refs).toEqual([]);
  });
});
