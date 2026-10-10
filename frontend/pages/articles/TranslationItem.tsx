/** Maqolalar ro'yxatidagi tarjima so'rovi kartasi */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Languages, ArrowRight } from 'lucide-react';
import { TranslationRequestApiResponse } from './types';
import { getStatusDisplayData } from './helpers';
import { useT } from '../../i18n/LanguageContext';

const TranslationItem: React.FC<{ request: TranslationRequestApiResponse }> = ({ request }) => {
    const { t } = useT();
    const navigate = useNavigate();
    const statusData = getStatusDisplayData(request.status);
    const costNum = Number(request.cost ?? 0);
    const paid = costNum <= 0 || request.payment_completed === true;
    const unpaidKnown = costNum > 0 && request.payment_completed === false;
    const paymentHint =
        request.payment_status_label ||
        (paid
            ? costNum <= 0
                ? 'To\'lov talab qilinmaydi (0 so\'m)'
                : 'To\'lov tasdiqlangan'
            : unpaidKnown
              ? 'To\'lov qilinmagan yoki kutilmoqda'
              : 'To\'lov holati — batafsil uchun oching');

    return (
        <div 
            className="editorial-card cursor-pointer hover:border-[var(--editorial-primary)]/35 transition-colors"
            onClick={() => navigate(`/translations/${request.id}`)}
        >
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-4">
                <h4 className="text-base sm:text-lg font-semibold text-[var(--editorial-text)] flex items-center gap-2 min-w-0"><Languages size={18} className="shrink-0 text-[var(--editorial-primary)]"/> <span className="truncate">{request.title}</span></h4>
                <span className={`text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap ${statusData.color}`}>
                    {t(statusData.text)}
                </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        paid
                            ? 'bg-emerald-500/15 text-emerald-900'
                            : unpaidKnown
                              ? 'bg-amber-500/25 text-amber-950'
                              : 'bg-slate-200/90 text-slate-800'
                    }`}
                    title={paymentHint}
                >
                    {paid ? t("To'lov: OK") : unpaidKnown ? t("To'lov: yo'q") : t("To'lov: ?")}
                </span>
                <span className="text-xs text-slate-600 truncate max-w-full">{paymentHint}</span>
            </div>
            <div className="flex justify-between items-end mt-4">
                <div>
                     <p className="text-sm text-slate-500 mt-2">
                        {request.source_language?.toUpperCase() || t("Noma'lum")} <ArrowRight size={14} className="inline-block mx-1"/> {request.target_language?.toUpperCase() || t("Noma'lum")}
                    </p>
                    <div className="text-xs text-slate-500 mt-2">
                        <span>{t('Muallif:')} {request.author_name || t("Noma'lum")}</span>
                        <span className="mx-2">|</span>
                        <span>{t('Sana: {value}', { value: new Date(request.submission_date).toLocaleDateString() })}</span>
                    </div>
                </div>
                 <span className="text-sm font-semibold text-emerald-800">{t("{value} so'm", { value: request.cost?.toLocaleString() || 0 })}</span>
            </div>
        </div>
    );
};


export default TranslationItem;
