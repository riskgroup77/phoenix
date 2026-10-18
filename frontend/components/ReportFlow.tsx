import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import './antiplagReport.css';

/** Hisobot bo'limi: sarlavha (birinchi sahifada), davomi sarlavhasi (keyingi sahifalarda) va bloklar. */
export interface FlowSection {
  key: string;
  head?: React.ReactNode;
  contHead?: React.ReactNode;
  blocks: { key: string; node: React.ReactNode }[];
  /** Sig'magan bloklar o'rniga oxirgi sahifaga qo'yiladigan izoh (n — ko'rsatilmagan bloklar soni) */
  overflowNote?: (hidden: number) => React.ReactNode;
}

export interface FlowPage {
  section: number;
  first: boolean;
  blocks: number[];
  /** Sahifa oxirida ko'rsatilmagan bloklar soni (maxPages chegarasi) */
  hidden?: number;
}

const PX_PER_MM = 96 / 25.4;
/** layout.json → report_inner.content_box.h × A4 balandligi */
export const FLOW_CONTENT_HEIGHT = 0.735 * 297 * PX_PER_MM;
/** .ap-page-footer balandligi */
export const FLOW_FOOTER_HEIGHT = 18;
const SAFETY = 3;

type Measured = { head: number; contHead: number; blocks: number[]; note: number }[];

/** Sof funksiya: o'lchangan balandliklar bo'yicha bloklarni sahifalarga taqsimlaydi. */
export function paginate(measured: Measured, available: number, maxPages?: number): FlowPage[] {
  const pages: FlowPage[] = [];
  measured.forEach((sec, si) => {
    let page: FlowPage = { section: si, first: true, blocks: [] };
    let used = sec.head;
    sec.blocks.forEach((h, bi) => {
      if (page.blocks.length > 0 && used + h > available) {
        pages.push(page);
        page = { section: si, first: false, blocks: [] };
        used = sec.contHead;
      }
      // Bo'sh sahifaga sig'magan yagona blok ham joylanadi (cheksiz siklning oldini olish uchun)
      page.blocks.push(bi);
      used += h;
    });
    pages.push(page);
  });

  if (maxPages != null && pages.length > maxPages) {
    const kept = pages.slice(0, Math.max(1, maxPages));
    const last = kept[kept.length - 1];
    const sec = measured[last.section];
    const shown = new Set(kept.filter((p) => p.section === last.section).flatMap((p) => p.blocks));
    let used = (last.first ? sec.head : sec.contHead) + last.blocks.reduce((s, b) => s + sec.blocks[b], 0);
    while (last.blocks.length > 1 && used + sec.note > available) {
      const b = last.blocks.pop() as number;
      shown.delete(b);
      used -= sec.blocks[b];
    }
    last.hidden = sec.blocks.length - shown.size;
    return kept;
  }
  return pages;
}

/**
 * Bloklarni A4 sahifalarga balandligi bo'yicha taqsimlaydi: avval ko'rinmas konteynerda (sahifa kontent kengligida)
 * o'lchaydi, keyin har sahifaga sig'adiganicha joylaydi. Hech bir blok yashirin `overflow: hidden` ostida yo'qolmaydi.
 */
export const FlowPages: React.FC<{
  sections: FlowSection[];
  /** Sahifa ramkasi (AntiplagReportInnerPage) */
  renderPage: (content: React.ReactNode, index: number, total: number) => React.ReactNode;
  maxPages?: number;
  /** Til/ma'lumot o'zgarganda qayta o'lchash uchun kalit */
  layoutKey?: string;
}> = ({ sections, renderPage, maxPages, layoutKey }) => {
  const measureRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<FlowPage[] | null>(null);
  const [fontsTick, setFontsTick] = useState(0);
  const available = FLOW_CONTENT_HEIGHT - FLOW_FOOTER_HEIGHT - SAFETY;
  const shape = sections.map((s) => `${s.key}:${s.blocks.length}`).join(',');

  useEffect(() => {
    let alive = true;
    const fonts = typeof document !== 'undefined' ? (document as Document & { fonts?: FontFaceSet }).fonts : undefined;
    fonts?.ready.then(() => {
      if (alive) setFontsTick((n) => n + 1);
    });
    return () => {
      alive = false;
    };
  }, [layoutKey]);

  useLayoutEffect(() => {
    const root = measureRef.current;
    if (!root) return;
    const h = (el: Element | null) => (el ? (el as HTMLElement).getBoundingClientRect().height : 0);
    const measured: Measured = sections.map((_, si) => {
      const secEl = root.querySelector(`[data-sec="${si}"]`);
      return {
        head: h(secEl?.querySelector(':scope > [data-head]') ?? null),
        contHead: h(secEl?.querySelector(':scope > [data-cont]') ?? null),
        note: h(secEl?.querySelector(':scope > [data-note]') ?? null),
        blocks: Array.from(secEl?.querySelectorAll(':scope > [data-block]') ?? []).map(h),
      };
    });
    setPages(paginate(measured, available, maxPages));
    // sections har renderda yangi massiv — layoutKey/fontsTick/bloklar soni orqali qayta o'lchanadi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey, fontsTick, available, maxPages, shape]);

  const measureTree = (
      <div ref={measureRef} className="ap-measure ap-report" aria-hidden="true">
        {sections.map((sec, si) => (
          <div key={sec.key} data-sec={si}>
            <div className="ap-block" data-head>{sec.head}</div>
            <div className="ap-block" data-cont>{sec.contHead}</div>
            <div className="ap-block" data-note>{sec.overflowNote ? sec.overflowNote(9999) : null}</div>
            {sec.blocks.map((b) => (
              <div key={b.key} className="ap-block" data-block>{b.node}</div>
            ))}
          </div>
        ))}
      </div>
  );

  const list = pages ?? sections.map((s, si) => ({ section: si, first: true, blocks: s.blocks.map((_, i) => i) }));

  return (
    <>
      {measureTree}
      {list.map((p, pi) => {
        const sec = sections[p.section];
        if (!sec) return null;
        const content = (
          <>
            <div className="ap-block">{p.first ? sec.head : sec.contHead}</div>
            {p.blocks.map((bi) => (
              <div key={sec.blocks[bi].key} className="ap-block">{sec.blocks[bi].node}</div>
            ))}
            {p.hidden && sec.overflowNote ? <div className="ap-block">{sec.overflowNote(p.hidden)}</div> : null}
          </>
        );
        return <React.Fragment key={`${sec.key}-${pi}`}>{renderPage(content, pi, list.length)}</React.Fragment>;
      })}
    </>
  );
};

export default FlowPages;
