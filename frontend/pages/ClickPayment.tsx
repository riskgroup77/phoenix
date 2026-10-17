import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { CreditCard, Loader, CheckCircle, XCircle } from 'lucide-react';
import { apiService } from '../services/apiService';
import { paymentService } from '../services/paymentService';
import { toast } from 'react-toastify';
import { useT } from '../i18n/LanguageContext';
import { PAYMENT_POLL_INTERVAL_MS, paymentDestination } from '../utils/paymentReturn';

// Holatni tekshirish oralig'i: 3000 ms → 1500 ms (utils/paymentReturn.ts)
const POLL_INTERVAL_MS = PAYMENT_POLL_INTERVAL_MS;
const POLL_MAX_MS = 15 * 60 * 1000;

const SERVICE_TYPE_LABELS: Record<string, string> = {
    'fast-track': 'Tezkor nashr',
    publication_fee: 'Nashr to\'lovi',
    language_editing: 'Til tahriri',
    top_up: 'Hisobni to\'ldirish',
    book_publication: 'Kitob nashri',
    translation: 'Tarjima',
    udk_request: 'UDK so\'rov',
    article_sample: 'Maqola namuna',
    doi_request: 'DOI olish',
};

interface PaymentTransaction {
    id: string;
    amount: number | string;
    currency?: string;
    service_type?: string;
    status: 'pending' | 'completed' | 'failed' | 'cancelled';
    completed_at?: string | null;
    created_at?: string;
    click_paydoc_id?: string;
    click_trans_id?: string;
    udk_certificate_url?: string | null;
    error_note?: string;
}

function formatAmount(amount: number | string, currency = 'UZS'): string {
    const n = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (Number.isNaN(n)) return String(amount);
    return `${new Intl.NumberFormat('uz-UZ').format(n)} ${currency === 'UZS' ? "so'm" : currency}`;
}

function formatDateTime(iso?: string | null): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString('uz-UZ', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return iso;
    }
}

const ClickPayment: React.FC = () => {
    const { t } = useT();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const transactionId = searchParams.get('transaction_id');

    const [isLoading, setIsLoading] = useState(false);
    const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [transaction, setTransaction] = useState<PaymentTransaction | null>(null);
    const [isPolling, setIsPolling] = useState(false);

    const confirmedToastShown = useRef(false);
    const pollStartedAt = useRef<number | null>(null);
    const returnScheduled = useRef(false);


    const txStatus = transaction?.status;
    const isPaymentCompleted = txStatus === 'completed';
    const isPaymentFailed = txStatus === 'failed' || txStatus === 'cancelled';
    const isPaymentPending = !txStatus || txStatus === 'pending';

    const refreshTransaction = useCallback(async (silent = false): Promise<PaymentTransaction | null> => {
        if (!transactionId) return null;
        try {
            let tx: PaymentTransaction | null = null;

            try {
                const syncResult = await apiService.payments.checkStatus(transactionId);
                if (syncResult?.transaction) {
                    tx = syncResult.transaction as PaymentTransaction;
                }
            } catch {
                // Click sinxronlash ishlamasa, oddiy GET
            }

            if (!tx) {
                tx = (await apiService.payments.getTransaction(transactionId)) as PaymentTransaction;
            }

            setTransaction(tx);
            if (tx?.status === 'completed' && !confirmedToastShown.current) {
                confirmedToastShown.current = true;
                toast.success(t("To'lov muvaffaqiyatli tasdiqlandi!"));
            }
            if ((tx?.status === 'failed' || tx?.status === 'cancelled') && !silent) {
                toast.error(tx.error_note || t("To'lov yakunlanmadi."));
            }
            return tx;
        } catch {
            return null;
        }
    }, [transactionId]);

    const loadPaymentUrl = useCallback(async () => {
        if (!transactionId) return;

        setIsLoading(true);
        setError('');

        try {
            const response = await apiService.payments.processPayment(transactionId, 'click');
            const url = response.payment_url;
            if (url && typeof url === 'string') {
                setPaymentUrl(url);
                setStatus('success');
            } else {
                setError(response.error || response.error_note || t("To'lov URL olinmadi"));
                setStatus('error');
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "To'lov URL yuklashda xatolik";
            setError(message);
            setStatus('error');
        } finally {
            setIsLoading(false);
        }
    }, [transactionId]);

    useEffect(() => {
        if (!transactionId) {
            setError(t('Transaction ID topilmadi'));
            return;
        }

        let cancelled = false;

        (async () => {
            setIsLoading(true);
            const tx = await refreshTransaction(true);
            if (cancelled) return;

            if (tx?.status === 'completed') {
                setStatus('success');
                setIsLoading(false);
                return;
            }

            if (tx?.status === 'failed' || tx?.status === 'cancelled') {
                setStatus('error');
                setError(tx.error_note || t("To'lov yakunlanmadi yoki bekor qilindi."));
                setIsLoading(false);
                return;
            }

            await loadPaymentUrl();
        })();

        return () => {
            cancelled = true;
        };
    }, [transactionId, refreshTransaction, loadPaymentUrl]);

    useEffect(() => {
        if (!transactionId || isPaymentCompleted || isPaymentFailed || status !== 'success') {
            setIsPolling(false);
            return;
        }

        if (pollStartedAt.current === null) {
            pollStartedAt.current = Date.now();
        }

        setIsPolling(true);

        const poll = () => {
            if (pollStartedAt.current && Date.now() - pollStartedAt.current > POLL_MAX_MS) {
                setIsPolling(false);
                return;
            }
            void refreshTransaction(true);
        };

        poll();
        const intervalId = window.setInterval(poll, POLL_INTERVAL_MS);

        const onVisible = () => {
            if (document.visibilityState === 'visible') poll();
        };
        document.addEventListener('visibilitychange', onVisible);

        return () => {
            window.clearInterval(intervalId);
            document.removeEventListener('visibilitychange', onVisible);
            setIsPolling(false);
        };
    }, [transactionId, isPaymentCompleted, isPaymentFailed, status, refreshTransaction]);

    // To'lov tasdiqlangach — kutmasdan xizmat sahifasiga (avval 3,5 s / 1,5 s kutilardi); natija toast'da
    useEffect(() => {
        if (!isPaymentCompleted || !transaction || returnScheduled.current) return;
        returnScheduled.current = true;
        sessionStorage.removeItem('phonix_submit_article_pending');
        navigate(paymentDestination(transaction), { replace: true });
    }, [isPaymentCompleted, transaction, navigate]);

    const handlePayment = () => {
        if (!paymentUrl) return;
        paymentService.openPaymentUrl(paymentUrl);
    };

    const serviceLabel =
        (transaction?.service_type && SERVICE_TYPE_LABELS[transaction.service_type]) ||
        transaction?.service_type ||
        'Xizmat';

    const showPaymentMethods = status === 'success' && paymentUrl && isPaymentPending;
    const showPendingSummary = isPaymentPending && transaction && !isLoading;

    return (
        <div className="min-h-screen bg-[var(--editorial-bg,#fdfbf7)] flex items-center justify-center p-4">
            <Card className="max-w-md w-full shadow-lg border border-[var(--editorial-border,#e2ddd4)]">
                <div className="text-center mb-6">
                    <CreditCard className="h-16 w-16 mx-auto mb-4 text-[var(--editorial-primary,#1f3f8f)]" />
                    <h2 className="font-serif text-2xl font-bold text-[var(--editorial-text,#1a1a1a)] mb-2">{t("Click To'lov")}</h2>
                    <p className="text-[var(--editorial-muted,#64748b)]">
                        {isPaymentCompleted
                            ? t("To'lov tasdiqlandi")
                            : t("Click sahifasida to'lovni yakunlang — tasdiq shu yerda ko'rinadi")}
                    </p>
                </div>

                {isLoading && !isPaymentCompleted && (
                    <div className="text-center py-8">
                        <Loader className="h-12 w-12 mx-auto animate-spin text-[var(--editorial-primary,#1f3f8f)] mb-4" />
                        <p className="text-slate-500">{t("To'lov sahifasi tayyorlanmoqda...")}</p>
                    </div>
                )}

                {error && !isPaymentCompleted && (
                    <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-lg mb-4">
                        <div className="flex items-center gap-2 text-red-800">
                            <XCircle className="h-5 w-5 shrink-0" />
                            <p>{error}</p>
                        </div>
                    </div>
                )}

                {isPaymentCompleted && transaction && (
                    <div className="space-y-4">
                        <div className="p-5 bg-emerald-500/25 border-2 border-emerald-500/50 rounded-xl">
                            <div className="flex items-center gap-3 text-emerald-900 mb-3">
                                <CheckCircle className="h-8 w-8 shrink-0" />
                                <div className="text-left">
                                    <p className="font-bold text-lg">{t("To'lov tasdiqlandi")}</p>
                                    <p className="text-sm text-emerald-800/90">
                                        {t("Click orqali to'lov muvaffaqiyatli qabul qilindi")}
                                    </p>
                                </div>
                            </div>
                            <dl className="space-y-2 text-sm text-slate-700">
                                <div className="flex justify-between gap-2 border-b border-emerald-500/20 pb-2">
                                    <dt className="text-slate-500">{t('Xizmat')}</dt>
                                    <dd className="font-medium text-right">{serviceLabel}</dd>
                                </div>
                                <div className="flex justify-between gap-2 border-b border-emerald-500/20 pb-2">
                                    <dt className="text-slate-500">{t('Summa')}</dt>
                                    <dd className="font-semibold text-right">
                                        {formatAmount(transaction.amount, transaction.currency)}
                                    </dd>
                                </div>
                                <div className="flex justify-between gap-2 border-b border-emerald-500/20 pb-2">
                                    <dt className="text-slate-500">{t('Tranzaksiya ID')}</dt>
                                    <dd className="font-mono text-xs text-right break-all">{transaction.id}</dd>
                                </div>
                                {transaction.click_paydoc_id && (
                                    <div className="flex justify-between gap-2 border-b border-emerald-500/20 pb-2">
                                        <dt className="text-slate-500">{t('Click hujjat ID')}</dt>
                                        <dd className="font-mono text-xs text-right">{transaction.click_paydoc_id}</dd>
                                    </div>
                                )}
                                <div className="flex justify-between gap-2">
                                    <dt className="text-slate-500">{t('Tasdiqlangan vaqt')}</dt>
                                    <dd className="font-medium text-right">
                                        {formatDateTime(transaction.completed_at || transaction.created_at)}
                                    </dd>
                                </div>
                            </dl>
                        </div>

                        {transaction.udk_certificate_url && (
                            <div className="p-4 bg-green-500/20 border border-green-500/30 rounded-lg">
                                <p className="font-semibold text-emerald-900 mb-2">
                                    {t("UDK tasdiqlangan ma'lumotnoma tayyor")}
                                </p>
                                <a
                                    href={transaction.udk_certificate_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-sm text-emerald-800 hover:underline font-medium"
                                >
                                    {t("Ma'lumotnomani yuklab olish")}
                                </a>
                            </div>
                        )}

                        <div className="flex flex-col gap-2">
                            {transaction.service_type === 'publication_fee' && (
                                <>
                                    <Button onClick={() => navigate('/arxiv')} className="w-full">
                                        {t("Arxiv hujjatlarga o'tish")}
                                    </Button>
                                    <Button onClick={() => navigate('/articles?tab=journal')} variant="secondary" className="w-full">
                                        {t("Ishlarimga o'tish")}
                                    </Button>
                                </>
                            )}
                            {transaction.service_type === 'language_editing' && (
                                <Button
                                    onClick={() => navigate('/plagiarism-check?payment_return=1&transaction_id=' + encodeURIComponent(transaction.id))}
                                    className="w-full"
                                >
                                    {t('Antiplagiat tekshiruviga qaytish')}
                                </Button>
                            )}
                            <Button
                                onClick={() => navigate('/dashboard')}
                                variant={transaction.service_type === 'publication_fee' || transaction.service_type === 'language_editing' ? 'secondary' : undefined}
                                className="w-full"
                            >
                                {t('Bosh sahifaga qaytish')}
                            </Button>
                        </div>
                    </div>
                )}

                {showPendingSummary && (
                    <div className="mb-4 p-4 bg-slate-100/80 border border-slate-200/90 rounded-xl text-sm">
                        <p className="font-semibold text-slate-800 mb-2">{t("To'lov ma'lumotlari")}</p>
                        <dl className="space-y-1.5 text-slate-700">
                            <div className="flex justify-between gap-2">
                                <dt className="text-slate-500">{t('Xizmat')}</dt>
                                <dd className="font-medium text-right">{serviceLabel}</dd>
                            </div>
                            <div className="flex justify-between gap-2">
                                <dt className="text-slate-500">{t('Summa')}</dt>
                                <dd className="font-semibold text-right">
                                    {formatAmount(transaction.amount, transaction.currency)}
                                </dd>
                            </div>
                            <div className="flex justify-between gap-2">
                                <dt className="text-slate-500">{t('Holat')}</dt>
                                <dd className="font-medium text-right text-amber-800">{t('Kutilmoqda')}</dd>
                            </div>
                        </dl>
                    </div>
                )}

                {showPaymentMethods && (
                    <div className="space-y-4">
                        <div
                            className={`flex items-center gap-2 p-3 rounded-lg text-sm border ${
                                isPolling
                                    ? 'bg-blue-500/15 border-blue-500/40 text-slate-800'
                                    : 'bg-slate-100/70 border-slate-200/90 text-slate-600'
                            }`}
                        >
                            {isPolling ? (
                                <Loader className="h-4 w-4 animate-spin text-blue-800 shrink-0" />
                            ) : (
                                <CheckCircle className="h-4 w-4 text-slate-500 shrink-0" />
                            )}
                            <span>
                                {isPolling
                                    ? t("To'lov avtomatik tekshirilmoqda — tasdiqlangach quyida ko'rsatiladi")
                                    : t("To'lovni amalga oshirgach, tasdiq bu sahifada avtomatik chiqadi")}
                            </span>
                        </div>

                        {/* QR kod va avtomatik Click ochilishi olib tashlandi — Click faqat tugma bosilganda yangi tabda */}
                        <div>
                            <Button
                                onClick={handlePayment}
                                className="flex w-full items-center justify-center gap-2"
                            >
                                <CreditCard className="h-5 w-5" />
                                {t("Click orqali to'lash")}
                            </Button>
                        </div>

                        <div className="flex justify-center">
                            <button
                                type="button"
                                onClick={() => void refreshTransaction(false)}
                                disabled={isLoading}
                                className="text-sm text-slate-500 hover:text-slate-900 underline-offset-2 hover:underline disabled:opacity-50"
                            >
                                {t('Hozir tekshirish')}
                            </button>
                        </div>

                        <div className="text-center">
                            <button
                                type="button"
                                onClick={() => navigate('/dashboard')}
                                className="text-sm text-slate-500 hover:text-slate-900"
                            >
                                {t('Orqaga qaytish')}
                            </button>
                        </div>
                    </div>
                )}

                {status === 'error' && !isPaymentCompleted && (
                    <div className="space-y-4">
                        <Button onClick={loadPaymentUrl} className="w-full">
                            {t("Qayta urinib ko'rish")}
                        </Button>
                        <div className="text-center">
                            <button
                                type="button"
                                onClick={() => navigate('/dashboard')}
                                className="text-sm text-slate-500 hover:text-slate-900"
                            >
                                {t('Orqaga qaytish')}
                            </button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default ClickPayment;