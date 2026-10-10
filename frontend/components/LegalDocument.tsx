import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { LEGAL, LEGAL_VERSION, legalDetailsMissing } from '../config/legal';

export type LegalSection = { title: string; body: React.ReactNode };

type Props = {
  title: string;
  subtitle?: string;
  sections: LegalSection[];
};

/** Ommaviy oferta / maxfiylik siyosati — ochiq sahifa (login shart emas), chop etishga mos. */
const LegalDocument: React.FC<Props> = ({ title, subtitle, sections }) => {
  useEffect(() => {
    const prev = document.title;
    document.title = `${title} — Phoenix`;
    return () => {
      document.title = prev;
    };
  }, [title]);

  return (
    <div className="min-h-screen bg-[var(--editorial-bg)] text-[var(--editorial-text)]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex items-center justify-between gap-3 mb-6 no-print">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-[var(--editorial-primary)] hover:underline">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Bosh sahifa
          </Link>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 text-sm text-[var(--editorial-muted)] hover:text-[var(--editorial-text)]">
            <Printer className="h-4 w-4" aria-hidden /> Chop etish
          </button>
        </div>

        <article className="editorial-card p-5 sm:p-8">
          <header className="mb-6 border-b border-[var(--editorial-border)] pb-4">
            <h1 className="text-2xl sm:text-3xl font-extrabold">{title}</h1>
            {subtitle && <p className="mt-2 text-[var(--editorial-muted)]">{subtitle}</p>}
            <p className="mt-2 text-xs text-[var(--editorial-muted)]">Tahrir: {LEGAL_VERSION}</p>
            {legalDetailsMissing() && (
              <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 no-print">
                Diqqat: tashkilot rekvizitlari hali kiritilmagan ([...] bilan belgilangan joylar).
              </p>
            )}
          </header>

          <div className="space-y-6 leading-relaxed text-[15px]">
            {sections.map((s, i) => (
              <section key={s.title} aria-labelledby={`legal-s${i}`}>
                <h2 id={`legal-s${i}`} className="text-lg font-bold mb-2">
                  {i + 1}. {s.title}
                </h2>
                <div className="space-y-2 text-[var(--editorial-body)] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">{s.body}</div>
              </section>
            ))}
          </div>

          <footer className="mt-8 border-t border-[var(--editorial-border)] pt-4 text-sm text-[var(--editorial-body)] space-y-1">
            <p className="font-semibold">Rekvizitlar</p>
            <p>{LEGAL.name}, STIR {LEGAL.inn}</p>
            <p>Manzil: {LEGAL.address}</p>
            <p>Bank: {LEGAL.bank}, h/r {LEGAL.account}, MFO {LEGAL.mfo}</p>
            <p>Rahbar: {LEGAL.director}</p>
            <p>Aloqa: {LEGAL.phone}, <a className="editorial-link" href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a></p>
          </footer>
        </article>

        <nav className="mt-6 flex flex-wrap gap-4 text-sm no-print" aria-label="Huquqiy hujjatlar">
          <Link className="editorial-link" to="/oferta">Ommaviy oferta</Link>
          <Link className="editorial-link" to="/maxfiylik">Maxfiylik siyosati</Link>
        </nav>
      </div>
    </div>
  );
};

export default LegalDocument;
