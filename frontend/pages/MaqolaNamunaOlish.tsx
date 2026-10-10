import React, { useState, useEffect } from 'react';
import { useAiPrefill, str, num } from '../contexts/AiPrefillContext';
import Card from '../components/ui/Card';
import EditorialPageHeader from '../components/EditorialPageHeader';
import Button from '../components/ui/Button';
import { Send, AlertCircle, FileText } from 'lucide-react';
import apiService from '../services/apiService';
import { paymentService } from '../services/paymentService';
import { useT } from '../i18n/LanguageContext';

const QUALITY_OPTIONS = [
  { value: 'quyi', label: 'Quyi sifatli', priceKey: 'quyi' as const },
  { value: 'orta', label: "O'rta sifatli", priceKey: 'orta' as const },
  { value: 'yuqori', label: 'Yuqori sifatli', priceKey: 'yuqori' as const },
] as const;

const STRUCTURE_OPTIONS = [
  { value: '', label: "Tuzilishni tanlang" },
  { value: 'Kirish, Asosiy qism, Xulosa, Adabiyotlar', label: 'Standart (Kirish, Asosiy qism, Xulosa, Adabiyotlar)' },
  { value: 'Kirish, Adabiyot sharhi, Tadqiqot usuli, Natijalar, Muhokama, Xulosa, Adabiyotlar', label: 'Ilmiy to\'liq (Kirish, Adabiyot sharhi, Usul, Natijalar, Muhokama, Xulosa, Adabiyotlar)' },
  { value: 'Kirish, Muammo, Usul, Natijalar, Xulosa, Adabiyotlar', label: 'Texnika (Kirish, Muammo, Usul, Natijalar, Xulosa, Adabiyotlar)' },
  { value: 'Kirish, Material va usullar, Natijalar, Muhokama, Xulosa, Adabiyotlar', label: 'Tibbiyot (Kirish, Material va usullar, Natijalar, Muhokama, Xulosa, Adabiyotlar)' },
] as const;

const OTHER_REQUIREMENT_OPTIONS = [
  { value: '', label: "Qo'shimcha talab yo'q" },
  { value: 'Jadvallar va rasmlar', label: 'Jadvallar va rasmlar' },
  { value: 'Ilova hujjatlari', label: 'Ilova hujjatlari' },
  { value: 'Boshqa', label: 'Boshqa (pastda yozing)' },
] as const;

const ARTICLE_TYPE_OPTIONS = [
  { value: '', label: "Maqola turini tanlang" },
  { value: 'Maqola', label: 'Maqola' },
  { value: 'Tezis', label: 'Tezis' },
] as const;

interface PriceMap {
  quyi: number;
  orta: number;
  yuqori: number;
  currency: string;
}

/** Talablar matnga birlashtiramiz. Format izohi (Word, 14 pt, Times New Roman, A4 albomiy) avtomatik qo'shiladi. */
const buildRequirements = (p: Record<string, string>) => {
  const parts: string[] = [];
  parts.push('Format: Word, 14 pt, Times New Roman, A4 albomiy (muallif uchun ma\'lumot)');
  if (p.requirementLanguage?.trim()) parts.push(`Til: ${p.requirementLanguage.trim()}`);
  if (p.requirementStructure?.trim()) parts.push(`Tuzilish: ${p.requirementStructure.trim()}`);
  if (p.requirementArticleType?.trim()) parts.push(`Maqola turi: ${p.requirementArticleType.trim()}`);
  const other = p.requirementOther === 'Boshqa' ? (p.requirementOtherText || '').trim() : (p.requirementOther || '').trim();
  if (other) parts.push(`Qo'shimcha: ${other}`);
  return parts.join('\n');
};

const MaqolaNamunaOlish: React.FC = () => {
  const { t } = useT();
  const [prices, setPrices] = useState<PriceMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [requirementLanguage, setRequirementLanguage] = useState('');
  const [requirementStructure, setRequirementStructure] = useState('');
  const [requirementArticleType, setRequirementArticleType] = useState('');
  const [requirementOther, setRequirementOther] = useState('');
  const [requirementOtherText, setRequirementOtherText] = useState('');
  const [pages, setPages] = useState(1);
  const [topic, setTopic] = useState('');
  const [qualityLevel, setQualityLevel] = useState<'quyi' | 'orta' | 'yuqori'>('orta');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const aiPrefill = useAiPrefill('article_sample');
  useEffect(() => {
    if (!aiPrefill) return;
    const f = aiPrefill.fields;
    if (str(f.language)) setRequirementLanguage(str(f.language));
    if (str(f.structure)) setRequirementStructure(str(f.structure));
    if (str(f.articleType)) setRequirementArticleType(str(f.articleType));
    if (str(f.topic)) setTopic(str(f.topic));
    if (num(f.pages)) setPages(num(f.pages) as number);
    const level = str(f.qualityLevel);
    if (level === 'quyi' || level === 'orta' || level === 'yuqori') setQualityLevel(level);
    if (str(f.firstName)) setFirstName(str(f.firstName));
    if (str(f.lastName)) setLastName(str(f.lastName));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiPrefill?.nonce]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiService.articles.getArticleSamplePrice();
        if (!cancelled && data) setPrices(data as PriceMap);
      } catch (e) {
        if (!cancelled) setError(t('Narxlarni yuklashda xatolik'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const pricePerPage = prices
    ? prices[qualityLevel] ?? prices.orta
    : 0;
  const totalAmount = Math.max(1, Math.min(500, pages)) * pricePerPage;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const requirements = buildRequirements({
      requirementLanguage,
      requirementStructure,
      requirementArticleType,
      requirementOther,
      requirementOtherText,
    });
    if (!requirementLanguage.trim()) {
      setError(t('Tilni tanlang.'));
      return;
    }
    if (!requirementStructure.trim()) {
      setError(t('Tuzilishni tanlang.'));
      return;
    }
    if (!requirementArticleType.trim()) {
      setError(t('Maqola turini tanlang (Maqola yoki Tezis).'));
      return;
    }
    if (!requirements.trim()) {
      setError(t("Talablar to'ldirilmadi."));
      return;
    }
    if (!topic.trim()) {
      setError(t('Maqola mavzusini kiriting.'));
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setError(t('Ism va familyani kiriting.'));
      return;
    }
    const safePages = Math.max(1, Math.min(500, pages));
    setSubmitting(true);
    try {
      const result = await apiService.articles.createArticleSampleRequest({
        requirements,
        pages: safePages,
        topic: topic.trim(),
        quality_level: qualityLevel,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      }) as { transaction_id?: string; amount?: number };
      const txId = result?.transaction_id;
      if (txId) {
        paymentService.redirectToPaymentPage(txId);
        return;
      }
      setError(t("Tranzaksiya yaratilmadi. Qayta urinib ko'ring."));
    } catch (err: any) {
      setError(err?.message || t("So'rov yuborishda xatolik."));
    } finally {
      setSubmitting(false);
    }
  };

  /* Ko‘k tugma (To‘lov qilish va yuborish) bilan bir xil fokus / chegara palitrasi; brauzer :invalid qizilini bosish */
  const inputClass =
    'w-full px-3 py-2 rounded-lg bg-white/[0.92] dark:bg-slate-800/90 border border-slate-300/80 dark:border-slate-600/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 ' +
    'outline-none transition-all duration-150 hover:border-blue-400/40 dark:hover:border-blue-400/50 ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500/70 ' +
    'invalid:border-blue-500/45 invalid:ring-1 invalid:ring-blue-500/25 invalid:shadow-none';
  const labelClass = 'block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300';

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-slate-900 dark:text-slate-100">{t('Narxlar yuklanmoqda…')}</p>
      </div>
    );
  }

  const selectOpt = (opts: readonly { value: string; label: string }[]) =>
    opts.map((opt) => (
      <option key={opt.value || 'empty'} value={opt.value} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
        {opt.label}
      </option>
    ));

  return (
    <div className="w-full min-h-screen px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-[1600px] mx-auto">
        <EditorialPageHeader
          title={t('Maqola namuna olish')}
          subtitle={t("Talablar va maqola ma'lumotlarini kiriting. To'lovdan so'ng so'rov taqrizchiga yuboriladi.")}
        />

        <form onSubmit={handleSubmit} className="space-y-8">
          {error && (
            <div className="flex items-center gap-2 p-4 bg-red-500/20 dark:bg-red-950/40 border border-red-400/50 dark:border-red-500/40 text-red-800 dark:text-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Narxlar va izoh (muallif uchun ma'lumot) */}
          {prices && (
            <Card className="p-6 border border-blue-500/20 dark:border-blue-400/25 bg-blue-50/80 dark:bg-slate-800/60">
              <h2 className="text-lg font-semibold mb-3 text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span className="text-blue-800 dark:text-blue-300">{t('Narxlar')}</span>
                <span className="text-sm font-normal text-slate-500 dark:text-slate-400">{t('(1 bet)')}</span>
              </h2>
              <ul className="space-y-2 text-slate-700 dark:text-slate-300 mb-4">
                <li>
                  {t('Quyi sifatli —')} <span className="font-semibold text-blue-900 dark:text-blue-300">{prices.quyi?.toLocaleString('uz-UZ')} {t("so'm")}</span>
                </li>
                <li>
                  {t("O'rta sifatli —")} <span className="font-semibold text-blue-900 dark:text-blue-300">{prices.orta?.toLocaleString('uz-UZ')} {t("so'm")}</span>
                </li>
                <li>
                  {t('Yuqori sifatli —')} <span className="font-semibold text-blue-900 dark:text-blue-300">{prices.yuqori?.toLocaleString('uz-UZ')} {t("so'm")}</span>
                </li>
              </ul>
              <p className="text-sm text-slate-500 dark:text-slate-400 border-t border-blue-500/15 dark:border-slate-600/50 pt-4">
                {t("Muallif uchun ma'lumot: hujjat formati — Word; shrift — 14 pt, Times New Roman; bet formati — A4 albomiy.")}
              </p>
            </Card>
          )}

          {/* Bitta kartada barcha talablar va ma'lumotlar */}
          <Card className="p-6 sm:p-8 border border-slate-200/90 dark:border-slate-700/80 dark:bg-slate-900/40">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className={labelClass}>{t('Til talabi *')}</label>
                <select value={requirementLanguage} onChange={(e) => setRequirementLanguage(e.target.value)} className={inputClass}>
                  <option value="" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">{t('Tilni tanlang')}</option>
                  <option value="O'zbek" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">{t("O'zbek")}</option>
                  <option value="Rus" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">{t('Rus')}</option>
                  <option value="Ingliz" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">{t('Ingliz')}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{t("Tuzilish / bo'limlar *")}</label>
                <select value={requirementStructure} onChange={(e) => setRequirementStructure(e.target.value)} className={inputClass}>
                  {selectOpt(STRUCTURE_OPTIONS)}
                </select>
              </div>
              <div>
                <label className={labelClass}>{t('Maqola turi *')}</label>
                <select value={requirementArticleType} onChange={(e) => setRequirementArticleType(e.target.value)} className={inputClass}>
                  {selectOpt(ARTICLE_TYPE_OPTIONS)}
                </select>
              </div>
              <div>
                <label className={labelClass}>{t('Maqola mavzusi *')}</label>
                <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t('Maqola mavzusi')} className={inputClass} required />
              </div>
              <div>
                <label className={labelClass}>{t('Sahifalar soni *')}</label>
                <input type="number" min={1} max={500} value={pages} onChange={(e) => setPages(Number(e.target.value) || 1)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('Daraja *')}</label>
                <select value={qualityLevel} onChange={(e) => setQualityLevel(e.target.value as 'quyi' | 'orta' | 'yuqori')} className={inputClass}>
                  {QUALITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                      {opt.label} — {prices ? (prices[opt.priceKey]?.toLocaleString('uz-UZ') ?? '') : ''} {t("so'm / bet")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>{t("Qo'shimcha talablar (ixtiyoriy)")}</label>
                <select value={requirementOther} onChange={(e) => setRequirementOther(e.target.value)} className={inputClass}>
                  {selectOpt(OTHER_REQUIREMENT_OPTIONS)}
                </select>
              </div>
              {requirementOther === 'Boshqa' && (
                <div className="sm:col-span-2">
                  <label className={labelClass}>{t("Qo'shimcha talablarni yozing")}</label>
                  <input
                    type="text"
                    value={requirementOtherText}
                    onChange={(e) => setRequirementOtherText(e.target.value)}
                    placeholder={t('Boshqa talablar')}
                    className={inputClass}
                  />
                </div>
              )}
              <div>
                <label className={labelClass}>{t('Ism *')}</label>
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={t('Ism')} className={inputClass} required />
              </div>
              <div>
                <label className={labelClass}>{t('Familya *')}</label>
                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={t('Familya')} className={inputClass} required />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-8 pt-6 px-4 py-5 -mx-1 sm:mx-0 rounded-xl border border-blue-500/30 dark:border-blue-400/25 bg-gradient-to-br from-blue-50 to-blue-100/80 dark:from-slate-800 dark:to-slate-900/90 shadow-md dark:shadow-black/20">
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {t('Jami:')}{' '}
                <span className="text-blue-800 dark:text-blue-300 font-bold tabular-nums">{totalAmount.toLocaleString('uz-UZ')} {t("so'm")}</span>
                <span className="text-sm font-normal text-slate-600 dark:text-slate-400 ml-2 block sm:inline sm:ml-2">
                  ({pages} {t('bet ×')} {pricePerPage.toLocaleString('uz-UZ')} {t("so'm)")}
                </span>
              </p>
              <Button
                type="submit"
                variant="primary"
                disabled={submitting}
                className="w-full sm:w-auto sm:min-w-[220px] shadow-md shadow-blue-600/25 border border-blue-400/40"
              >
                <Send className="w-4 h-4 mr-2" />
                {submitting ? t('Yuborilmoqda…') : t("To'lov qilish va yuborish")}
              </Button>
            </div>
          </Card>
        </form>
      </div>
    </div>
  );
};

export default MaqolaNamunaOlish;
