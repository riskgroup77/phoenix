import React, { useMemo, useState } from 'react';
import { ExternalLink, Layers } from 'lucide-react';
import { useT } from '../i18n/LanguageContext';

export type HighlightSegment = { text: string; source: number | null };
export type HighlightParagraph = { text: string; sourceRefs: number[]; segments?: HighlightSegment[] };
export type HighlightSource = { id: number; sourceName: string; sourceUrl?: string; percentage: string };

/** Manbalar uchun bir-biridan aniq farqlanadigan ranglar (yorug' va qorong'i rejimda o'qiladi) */
export const SOURCE_COLORS = ['#1f3f8f', '#0b6f74', '#d99a00', '#b91c1c', '#7c3aed', '#0369a1', '#15803d', '#c2410c', '#be185d', '#4d7c0f'];

const colorFor = (sourceId: number, order: Map<number, number>) => SOURCE_COLORS[(order.get(sourceId) ?? sourceId - 1) % SOURCE_COLORS.length];

/**
 * Antiplagiat natijasi matnda: har bir o'xshash gap manbasi rangida belgilanadi, yonida manbalar ro'yxati.
 * Manbani bossangiz — faqat o'sha manbaga mos joylar ajralib turadi.
 */
const AntiplagiatHighlightView: React.FC<{ paragraphs: HighlightParagraph[]; sources: HighlightSource[] }> = ({ paragraphs, sources }) => {
  const { t } = useT();
  const [focus, setFocus] = useState<number | null>(null);
  const [onlyMatches, setOnlyMatches] = useState(false);

  const usedIds = useMemo(() => {
    const ids = new Set<number>();
    paragraphs.forEach((p) => {
      if (p.segments && p.segments.length) p.segments.forEach((s) => s.source != null && ids.add(s.source));
      else p.sourceRefs.forEach((r) => ids.add(r));
    });
    return ids;
  }, [paragraphs]);

  const legend = useMemo(() => sources.filter((s) => usedIds.has(s.id)), [sources, usedIds]);
  const order = useMemo(() => new Map(legend.map((s, i) => [s.id, i])), [legend]);
  const byId = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);

  const totals = useMemo(() => {
    let all = 0;
    let matched = 0;
    paragraphs.forEach((p) => {
      (p.segments && p.segments.length ? p.segments : [{ text: p.text, source: p.sourceRefs[0] ?? null }]).forEach((s) => {
        const len = s.text.length;
        all += len;
        if (s.source != null) matched += len;
      });
    });
    return { all, matched };
  }, [paragraphs]);

  if (paragraphs.length === 0) return null;

  const matchedPct = totals.all > 0 ? Math.round((totals.matched / totals.all) * 1000) / 10 : 0;

  const renderSegment = (seg: HighlightSegment, key: string) => {
    if (seg.source == null) {
      return (
        <span key={key} className={focus != null ? 'opacity-60' : ''}>
          {seg.text}{' '}
        </span>
      );
    }
    const color = colorFor(seg.source, order);
    const src = byId.get(seg.source);
    const dim = focus != null && focus !== seg.source;
    return (
      <mark
        key={key}
        className={`milliy-hl ${dim ? 'milliy-hl--dim' : ''}`}
        style={{ backgroundColor: `${color}2e`, boxShadow: `inset 0 -2px 0 ${color}`, color: 'inherit' }}
        title={src ? `[${seg.source}] ${src.sourceName} — ${src.percentage}` : `[${seg.source}]`}
        onClick={() => setFocus((f) => (f === seg.source ? null : seg.source))}
      >
        {seg.text}
        <sup className="ml-0.5 text-[10px] font-bold" style={{ color }}>
          {seg.source}
        </sup>{' '}
      </mark>
    );
  };

  return (
    <section className="editorial-card flex flex-col gap-4" aria-labelledby="hl-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="hl-title" className="m-0 text-lg font-bold flex items-center gap-2">
            <Layers className="w-5 h-5 text-[var(--milliy-firuza)]" aria-hidden /> {t("Matndagi o'xshash joylar")}
          </h3>
          <p className="m-0 mt-1 text-sm text-[var(--editorial-muted)]">
            {t("Har bir rang — alohida manba. Manbani bossangiz, faqat unga tegishli joylar ajralib turadi.")}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer select-none">
          <input type="checkbox" checked={onlyMatches} onChange={(e) => setOnlyMatches(e.target.checked)} className="w-4 h-4 accent-[#1f3f8f]" />
          {t("Faqat o'xshash xatboshilar")}
        </label>
      </div>

      <div className="flex flex-wrap gap-6 items-start">
        <aside className="flex flex-col gap-2 min-w-0 flex-[1_1_240px] lg:max-w-[300px]" aria-label={t('Manbalar')}>
          <p className="m-0 text-xs font-bold uppercase tracking-wider text-[var(--editorial-muted)]">
            {t('Manbalar')} · {t("matnning {p}% belgilangan", { p: matchedPct })}
          </p>
          {legend.length === 0 ? (
            <p className="m-0 text-sm text-[var(--editorial-muted)]">{t("O'xshash joylar topilmadi.")}</p>
          ) : (
            <>
              {focus != null && (
                <button type="button" onClick={() => setFocus(null)} className="editorial-link text-sm text-left">
                  {t("Barcha manbalarni ko'rsatish")}
                </button>
              )}
              <ul className="m-0 p-0 list-none flex flex-col gap-1.5 max-h-[420px] overflow-y-auto pr-1">
                {legend.map((s) => {
                  const color = colorFor(s.id, order);
                  const active = focus === s.id;
                  return (
                    <li key={s.id}>
                      <div
                        className={`flex items-start gap-2.5 p-2 rounded-[10px] border transition-colors ${
                          active ? 'border-[var(--editorial-primary)] bg-[var(--editorial-bg-alt)]' : 'border-transparent hover:bg-[var(--editorial-bg-alt)]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setFocus((f) => (f === s.id ? null : s.id))}
                          aria-pressed={active}
                          className="flex items-start gap-2.5 text-left min-w-0 flex-1"
                        >
                          <span className="milliy-source-chip" style={{ background: color }}>{s.id}</span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold leading-snug line-clamp-2">{s.sourceName}</span>
                            <span className="block text-xs font-bold mt-0.5" style={{ color }}>{s.percentage}</span>
                          </span>
                        </button>
                        {s.sourceUrl && (
                          <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="editorial-icon-btn shrink-0" aria-label={t('Manbani ochish')}>
                            <ExternalLink className="w-4 h-4" aria-hidden />
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </aside>

        <div className="min-w-0 flex-[3_1_420px] max-h-[640px] overflow-y-auto rounded-[12px] border border-[var(--editorial-border)] bg-[var(--milliy-surface)] p-5 text-[15px] leading-[1.85] text-[var(--editorial-body)]">
          {paragraphs.map((p, pi) => {
            const segments: HighlightSegment[] =
              p.segments && p.segments.length
                ? p.segments
                : [{ text: p.text, source: p.sourceRefs.length ? p.sourceRefs[0] : null }];
            const hasMatch = segments.some((s) => s.source != null);
            if (onlyMatches && !hasMatch) return null;
            if (focus != null && onlyMatches && !segments.some((s) => s.source === focus)) return null;
            return (
              <p key={pi} className="m-0 mb-3.5">
                {segments.map((seg, si) => renderSegment(seg, `${pi}-${si}`))}
              </p>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default AntiplagiatHighlightView;
