import React from 'react';
import { useT, type TFunction } from '../i18n/LanguageContext';
import AntiplagiatReportTitleCover from './AntiplagiatReportTitleCover';
import AntiplagReportInnerPage, { ReportSheet } from './AntiplagReportInnerPage';
import FlowPages, { type FlowSection } from './ReportFlow';
import './antiplagReport.css';

export interface PlagiarismSource {
    id: number;
    percentage: string;
    sourceName: string;
    sourceUrl?: string;
    searchModule: string;
    documentFragment?: string;
    sourceFragment?: string;
    /** Shu manbadan topilgan parchalar soni (takrorlar birlashtirilgandan keyin) */
    fragmentCount?: number;
}

export interface PlagiarismFragmentDetail {
    sourceIndex: number;
    title: string;
    sourceUrl?: string;
    documentFragment: string;
    sourceFragment: string;
    percentage: string;
    searchModule: string;
}

export interface AnnotatedParagraph {
    text: string;
    sourceRefs: number[];
    /** Gaplar va har biriga mos manba (yangi hisobotlarda) */
    segments?: { text: string; source: number | null }[];
}

export interface PlagiarismFullReportData {
    checkerName: string;
    checkerId: string;
    checkerOrganization?: string;
    authorPosition?: string;
    documentNumber: string;
    uploadDate: string;
    originalFileName: string;
    documentName: string;
    documentType: string;
    characterCount: number;
    sentenceCount: number;
    fileSize: string;
    plagiarismPercent: number;
    selfCitationPercent: number;
    citationPercent: number;
    originalityPercent: number;
    searchModules: string[];
    sources: PlagiarismSource[];
    fragmentDetails?: PlagiarismFragmentDetail[];
    annotatedDocument?: AnnotatedParagraph[];
}

/** "X qidiruv moduli" → joriy tilda ("Модуль поиска X" / "X search module"); modul nomining o'zi tarjima qilinmaydi */
export function translateSearchModule(t: TFunction, value: string): string {
    const m = /^(.*?)\s*qidiruv moduli$/.exec((value || '').trim());
    return m ? t('{module} qidiruv moduli', { module: m[1] }) : value;
}

/** Hujjat ma'lumotlaridagi standart (o'zbekcha) qiymatlar: hujjat turi, "Muallif"/"Hujjat" o'rinbosarlari */
function translateDefault(t: TFunction, value: string, defaults: string[]): string {
    return defaults.includes(value) ? t(value) : value;
}

/** Matn kalitlari o'zbekcha (lotin) — ko'rsatishda t() bilan tarjima qilinadi */
export const ANTIPLAG_REPORT_LEGEND = [
    {
        title: "O'zlashtirib olish",
        color: '#c81e1e',
        text: "topilgan barcha matnli kesishmalar ulushi, tizim hujjatning umumiy hajmiga nisbatan iqtibos keltirishga kiritganlaridan tashqari.",
    },
    {
        title: "O'z-o'zidan iqtibos keltirishlar",
        color: '#a16207',
        text: "tekshirilayotgan hujjatdagi muallifi yoki hammuallifi tekshirilayotgan hujjatning muallifi bo'lgan manba matni fragmenti bilan mos tushuvchi yoki deyarli mos tushuvchi matn fragmentlarining hujjatning umumiy hajmiga nisbatan ulushi.",
    },
    {
        title: 'Iqtibos keltirish',
        color: '#1d4ed8',
        text: "muallifniki bo'lmagan, biroq tizim ulardan foydalanishni to'g'ri deb hisoblagan matnli kesishmalarning hujjatning umumiy hajmiga nisbatan ulushi.",
    },
    {
        title: 'Originallik',
        color: '#15803d',
        text: "tekshirilayotgan hujjat matnidagi tekshiruv borgan birorta ham manbada topilmagan fragmentlarning hujjatning umumiy hajmiga nisbatan ulushi.",
    },
];

const pad2 = (n: number) => String(n).padStart(2, '0');

function pctColor(pct: number): string {
    if (pct > 5) return '#c81e1e';
    if (pct > 0) return '#a16207';
    return '#5b6475';
}

function clip(text: string, max: number): string {
    const s = (text || '').replace(/\s+/g, ' ').trim();
    return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/* ------------------------------------------------------------------ */
/* Bloklar                                                             */
/* ------------------------------------------------------------------ */

export const MetricBox: React.FC<{ value: number; label: string; color: string; bg: string }> = ({ value, label, color, bg }) => (
    <div className="ap-metric" style={{ backgroundColor: bg, borderColor: `${color}55` }}>
        <div className="ap-metric-value" style={{ color }}>{value.toFixed(2)}%</div>
        <div className="ap-metric-label">{label}</div>
    </div>
);

const MetricsRow: React.FC<{ data: PlagiarismFullReportData }> = ({ data }) => {
    const { t } = useT();
    return (
        <div className="ap-metrics">
            <MetricBox value={data.plagiarismPercent} label={t("O'zlashtirib olishlar")} color="#c81e1e" bg="#fef2f2" />
            <MetricBox value={data.selfCitationPercent} label={t("O'z-o'zidan iqtibos")} color="#a16207" bg="#fefce8" />
            <MetricBox value={data.citationPercent} label={t('Iqtibos keltirishlar')} color="#1d4ed8" bg="#eff6ff" />
            <MetricBox value={data.originalityPercent} label={t('Originallik')} color="#15803d" bg="#f0fdf4" />
        </div>
    );
};

const Issuer: React.FC<{ data: PlagiarismFullReportData }> = ({ data }) => {
    const { t } = useT();
    return (
        <div className="ap-issuer">
            <strong>{t('Hisobot "Phoenix Antiplagiat" servisi tomonidan taqdim etilgan')}</strong>
            <span className="ap-issuer-right">
                {t('Tekshiruvchi:')} <b>{translateDefault(t, data.checkerName, ['Muallif'])}</b>{' '}
                <span className="ap-nowrap">(ID: {data.checkerId})</span>
            </span>
        </div>
    );
};

const InfoList: React.FC<{ rows: [string, React.ReactNode][] }> = ({ rows }) => (
    <dl className="ap-info">
        {rows.map(([label, value]) => (
            <React.Fragment key={label}>
                <dt>{label}:</dt>
                <dd>{value}</dd>
            </React.Fragment>
        ))}
    </dl>
);

const SummaryHead: React.FC<{ data: PlagiarismFullReportData; title: string }> = ({ data, title }) => {
    const { t, locale } = useT();
    const fileName = translateDefault(t, data.originalFileName, ['Hujjat']);
    const docName = translateDefault(t, data.documentName, ['Hujjat']);
    const docRows: [string, React.ReactNode][] = [
        [t('Hujjat raqami'), data.documentNumber],
        [t('Yuklangan vaqti'), data.uploadDate],
        [t('Hujjat nomi'), docName],
    ];
    if (fileName && fileName !== docName) docRows.push([t('Dastlabki fayl nomi'), fileName]);
    docRows.push([t('Hujjat turi'), data.documentType ? t(data.documentType) : '—']);
    docRows.push([t('Matndagi belgilar'), data.characterCount.toLocaleString(locale)]);
    docRows.push([t('Gaplar soni'), data.sentenceCount.toLocaleString(locale)]);
    if (data.fileSize && data.fileSize !== '—') docRows.push([t("Matn o'lchami"), data.fileSize]);

    const authorRows: [string, React.ReactNode][] = [
        [t('Muallif'), translateDefault(t, data.checkerName, ['Muallif'])],
    ];
    if (data.checkerOrganization?.trim()) authorRows.push([t('Tashkilot'), data.checkerOrganization.trim()]);
    if (data.authorPosition?.trim()) authorRows.push([t('Lavozimi'), data.authorPosition.trim()]);
    authorRows.push([t('Manbalar soni'), data.sources.length.toLocaleString(locale)]);

    return (
        <div>
            <Issuer data={data} />
            <h1 className="ap-h1">{t(title)}</h1>
            <MetricsRow data={data} />
            <div className="ap-info-grid">
                <div className="ap-card">
                    <h3 className="ap-card-title">{t("Hujjat to'g'risidagi ma'lumotlar")}</h3>
                    <InfoList rows={docRows} />
                </div>
                <div className="ap-card">
                    <h3 className="ap-card-title">{t("Hisobot to'g'risidagi ma'lumotlar")}</h3>
                    <InfoList rows={authorRows} />
                    <p className="ap-modules">
                        <b>{t('Qidiruv modullari')}:</b>{' '}
                        {data.searchModules.length
                            ? data.searchModules.map((m) => translateSearchModule(t, m)).join(', ')
                            : t("Modullar ko'rsatilmagan")}
                    </p>
                </div>
            </div>
            <div className="ap-legend">
                {ANTIPLAG_REPORT_LEGEND.map((item) => (
                    <p key={item.title}>
                        <strong style={{ color: item.color }}>{t(item.title)}</strong> — {t(item.text)}
                    </p>
                ))}
            </div>
        </div>
    );
};

const SourcesHeaderRow: React.FC = () => {
    const { t } = useT();
    return (
        <div className="ap-trow ap-thead" role="row">
            <div role="columnheader">№</div>
            <div role="columnheader">{t('Ulushi')}</div>
            <div role="columnheader">{t('Manba')}</div>
            <div role="columnheader">{t('Qidirish moduli')}</div>
        </div>
    );
};

export const SourceRow: React.FC<{ source: PlagiarismSource }> = ({ source }) => {
    const { t } = useT();
    const pct = parseFloat(source.percentage) || 0;
    const url = source.sourceUrl || (source.sourceName.startsWith('http') ? source.sourceName : '');
    const showTitle = !(url && source.sourceName === url);
    return (
        <div className="ap-trow" role="row">
            <div className="ap-num">[{pad2(source.id)}]</div>
            <div className="ap-pct" style={{ color: pctColor(pct) }}>{source.percentage}</div>
            <div>
                {showTitle && <div className="ap-src-title">{source.sourceName}</div>}
                {url && (
                    <a className="ap-link" href={url} target="_blank" rel="noopener noreferrer">
                        {url}
                    </a>
                )}
            </div>
            <div className="ap-module">
                {translateSearchModule(t, source.searchModule)}
                {(source.fragmentCount ?? 1) > 1 && (
                    <div className="ap-src-count">{t('{count} ta parcha', { count: source.fragmentCount as number })}</div>
                )}
            </div>
        </div>
    );
};

const EmptySources: React.FC = () => {
    const { t } = useT();
    return <div className="ap-empty">{t('Manbalar topilmadi')}</div>;
};

const SectionHead: React.FC<{ title: string; cont?: boolean; sub?: React.ReactNode; children?: React.ReactNode }> = ({
    title,
    cont,
    sub,
    children,
}) => {
    const { t } = useT();
    return (
        <div className="ap-section-head">
            <h2 className="ap-h2">
                {t(title)}
                {cont && <span className="ap-cont"> {t('(davomi)')}</span>}
            </h2>
            {sub && <p className="ap-sub">{sub}</p>}
            {children}
        </div>
    );
};

const FragmentCard: React.FC<{ fragment: PlagiarismFragmentDetail }> = ({ fragment }) => {
    const { t } = useT();
    const pct = parseFloat(fragment.percentage) || 0;
    return (
        <div className="ap-frag">
            <div className="ap-frag-head">
                <span className="ap-src-title">
                    <span style={{ color: '#2c6a7c' }}>[{pad2(fragment.sourceIndex)}]</span> {fragment.title}
                </span>
                <span style={{ color: pctColor(pct), fontWeight: 800, whiteSpace: 'nowrap' }}>{fragment.percentage}</span>
            </div>
            {fragment.sourceUrl && (
                <a className="ap-link" href={fragment.sourceUrl} target="_blank" rel="noopener noreferrer">
                    {fragment.sourceUrl}
                </a>
            )}
            <div className="ap-frag-cols">
                <div className="ap-frag-col ap-frag-col--doc">
                    <span className="ap-frag-label" style={{ color: '#b91c1c' }}>{t('Tekshirilayotgan hujjat matni')}</span>
                    {clip(fragment.documentFragment, 700) || '—'}
                </div>
                <div className="ap-frag-col ap-frag-col--src">
                    <span className="ap-frag-label" style={{ color: '#1d4ed8' }}>{t('Manba matni')}</span>
                    {clip(fragment.sourceFragment, 700) || '—'}
                </div>
            </div>
        </div>
    );
};

type DocChunk = { segments: { text: string; source: number | null }[]; refs: number[] };

/** Uzun xatboshilarni gaplar bo'yicha bo'laklarga ajratadi — har bo'lak sahifaga sig'adi. */
export function chunkParagraphs(paragraphs: AnnotatedParagraph[], maxChars = 900): DocChunk[] {
    const out: DocChunk[] = [];
    for (const p of paragraphs) {
        const segs = p.segments && p.segments.length ? p.segments : [{ text: p.text, source: null }];
        const useBadges = !(p.segments && p.segments.length);
        let cur: DocChunk = { segments: [], refs: [] };
        let len = 0;
        for (const s of segs) {
            const text = (s.text || '').trim();
            if (!text) continue;
            if (len > 0 && len + text.length > maxChars) {
                out.push(cur);
                cur = { segments: [], refs: [] };
                len = 0;
            }
            cur.segments.push({ text, source: s.source });
            len += text.length + 1;
        }
        if (useBadges) cur.refs = p.sourceRefs || [];
        if (cur.segments.length) out.push(cur);
    }
    return out;
}

const DocParagraph: React.FC<{ chunk: DocChunk }> = ({ chunk }) => (
    <p className="ap-doc-p">
        {chunk.segments.map((s, i) => (
            <React.Fragment key={i}>
                {i > 0 ? ' ' : null}
                {s.source != null ? (
                    <>
                        <mark className="ap-hl" style={{ color: 'inherit' }}>{s.text}</mark>
                        <span className="ap-ref">{pad2(s.source)}</span>
                    </>
                ) : (
                    s.text
                )}
            </React.Fragment>
        ))}
        {chunk.refs.map((r) => (
            <span key={r} className="ap-ref">{pad2(r)}</span>
        ))}
    </p>
);

/* ------------------------------------------------------------------ */
/* Bo'limlar                                                           */
/* ------------------------------------------------------------------ */

export function buildSourcesSection(
    data: PlagiarismFullReportData,
    title: string,
    sources: PlagiarismSource[],
    overflowNote?: FlowSection['overflowNote'],
): FlowSection {
    return {
        key: 'sources',
        head: (
            <>
                <SummaryHead data={data} title={title} />
                <TableTitle />
                <SourcesHeaderRow />
            </>
        ),
        contHead: (
            <>
                <SectionHead title="Manbalar ro'yxati" cont sub={`№ ${data.documentNumber} · ${data.uploadDate}`} />
                <SourcesHeaderRow />
            </>
        ),
        blocks: sources.length
            ? sources.map((s, i) => ({ key: `s-${s.id}-${i}`, node: <SourceRow source={s} /> }))
            : [{ key: 'empty', node: <EmptySources /> }],
        overflowNote,
    };
}

const TableTitle: React.FC = () => {
    const { t } = useT();
    return <h3 className="ap-table-title">{t("Manbalar ro'yxati")}</h3>;
};

export function reportFragments(data: PlagiarismFullReportData): PlagiarismFragmentDetail[] {
    if (data.fragmentDetails && data.fragmentDetails.length > 0) return data.fragmentDetails;
    return data.sources
        .filter((s) => parseFloat(s.percentage) > 0 && (s.documentFragment || s.sourceFragment))
        .map((s) => ({
            sourceIndex: s.id,
            title: s.sourceName,
            sourceUrl: s.sourceUrl,
            documentFragment: s.documentFragment || '',
            sourceFragment: s.sourceFragment || '',
            percentage: s.percentage,
            searchModule: s.searchModule,
        }));
}

const DocLegend: React.FC = () => {
    const { t } = useT();
    return (
        <p className="ap-sub" style={{ marginTop: 4 }}>
            <span className="ap-swatch" style={{ background: '#fde2e2', boxShadow: 'inset 0 -1px 0 #f87171' }} />
            {t("Belgilangan matn manbalarda topilgan; raqam — manbalar ro'yxatidagi tartib raqami.")}
        </p>
    );
};

/** Sahifa ramkasi: hisobot2.jpg + pastki qatorda hujjat raqami va sahifa raqami (muqova — 1-sahifa). */
export function useInnerPageRenderer(documentNumber: string) {
    const { t } = useT();
    return (content: React.ReactNode, index: number, total: number) => (
        <AntiplagReportInnerPage
            footerLeft={`Phoenix Antiplagiat · № ${documentNumber}`}
            footerRight={t('Sahifa {pageNum}', { pageNum: `${index + 2} / ${total + 1}` })}
        >
            {content}
        </AntiplagReportInnerPage>
    );
}

export const ReportCoverSheet: React.FC<{ data: PlagiarismFullReportData }> = ({ data }) => (
    <ReportSheet>
        <div className="ap-cover">
            <AntiplagiatReportTitleCover data={data} />
        </div>
    </ReportSheet>
);

const PlagiarismFullReport: React.FC<{ data: PlagiarismFullReportData; id?: string }> = ({
    data,
    id = 'plagiarism-full-report',
}) => {
    const { t, lang } = useT();
    const renderPage = useInnerPageRenderer(data.documentNumber);
    const fragments = reportFragments(data);
    const chunks = chunkParagraphs(data.annotatedDocument || []);
    const docName = translateDefault(t, data.documentName, ['Hujjat']);

    const sections: FlowSection[] = [buildSourcesSection(data, 'Hujjat tekshirish natijalari', data.sources)];
    if (fragments.length) {
        sections.push({
            key: 'fragments',
            head: (
                <SectionHead
                    title="Matnli kesishmalar"
                    sub={t("Hujjatdagi matn va manbadagi mos fragment yonma-yon ko'rsatilgan.")}
                />
            ),
            contHead: <SectionHead title="Matnli kesishmalar" cont />,
            blocks: fragments.map((f, i) => ({ key: `f-${f.sourceIndex}-${i}`, node: <FragmentCard fragment={f} /> })),
        });
    }
    if (chunks.length) {
        sections.push({
            key: 'document',
            head: (
                <SectionHead title="Tekshirilayotgan hujjat matni" sub={docName}>
                    <DocLegend />
                </SectionHead>
            ),
            contHead: <SectionHead title="Tekshirilayotgan hujjat matni" cont />,
            blocks: chunks.map((c, i) => ({ key: `d-${i}`, node: <DocParagraph chunk={c} /> })),
        });
    }

    return (
        <div className="ap-report ap-report-pages" id={id} data-paper>
            <ReportCoverSheet data={data} />
            <FlowPages sections={sections} renderPage={renderPage} layoutKey={lang} />
        </div>
    );
};

export default PlagiarismFullReport;
