import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { CreditCard, Loader, CheckCircle, XCircle, QrCode } from 'lucide-react';
import { apiService } from '../services/apiService';
import { toast } from 'react-toastify';
import { shouldAutoOpenClickPayment } from '../utils/device';

const POLL_INTERVAL_MS = 3000;
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
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const transactionId = searchParams.get('transaction_id');
    const noAutoRedirect =
        searchParams.get('no_auto') === '1' || searchParams.get('no_auto') === 'true';

    const [isLoading, setIsLoading] = useState(false);
    const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [transaction, setTransaction] = useState<PaymentTransaction | null>(null);
    const [isPolling, setIsPolling] = useState(false);

    const confirmedToastShown = useRef(false);
    const pollStartedAt = useRef<number | null>(null);
    const archiveRedirectScheduled = useRef(false);

    const isMobilePaymentUi = shouldAutoOpenClickPayment();
    const useMobileAutoFlow = isMobilePaymentUi && !noAutoRedirect;

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
                toast.success("To'lov muvaffaqiyatli tasdiqlandi!");
            }
            if ((tx?.status === 'failed' || tx?.status === 'cancelled') && !silent) {
                toast.error(tx.error_note || "To'lov yakunlanmadi.");
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
                setError(response.error || response.error_note || "To'lov URL olinmadi");
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
            setError('Transaction ID topilmadi');
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
                setError(tx.error_note || "To'lov yakunlanmadi yoki bekor qilindi.");
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
        if (!transactionId || !paymentUrl || status !== 'success') return;
        if (!useMobileAutoFlow || isPaymentCompleted) return;
        const storageKey = `click_auto_redirect_${transactionId}`;
        if (sessionStorage.getItem(storageKey)) return;
        sessionStorage.setItem(storageKey, '1');
        toast.info("Click to'lov sahifasiga yo'naltirilmoqdasiz...", { autoClose: 2000 });
        window.setTimeout(() => {
            window.location.assign(paymentUrl);
        }, 450);
    }, [transactionId, paymentUrl, status, useMobileAutoFlow, isPaymentCompleted]);

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

    useEffect(() => {
        if (!isPaymentCompleted || transaction?.service_type !== 'publication_fee') return;
        if (archiveRedirectScheduled.current) return;
        archiveRedirectScheduled.current = true;
        sessionStorage.removeItem('phonix_submit_article_pending');
        const timer = window.setTimeout(() => navigate('/arxiv'), 3500);
        return () => window.clearTimeout(timer);
    }, [isPaymentCompleted, transaction?.service_type, navigate]);

    const handlePayment = () => {
        if (!paymentUrl) return;
        if (isMobilePaymentUi) {
            window.location.assign(paymentUrl);
        } else {
            window.open(paymentUrl, '_blank', 'noopener,noreferrer');
        }
    };

    const serviceLabel =
        (transaction?.service_type && SERVICE_TYPE_LABELS[transaction.service_type]) ||
        transaction?.service_type ||
        'Xizmat';

    const showPaymentMethods = status === 'success' && paymentUrl && isPaymentPending;
    const showPendingSummary = isPaymentPending && transaction && !isLoading;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-4">
            <Card className="max-w-md w-full">
                <div className="text-center mb-6">
                    <CreditCard className="h-16 w-16 mx-auto mb-4 text-blue-800" />
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Click To&apos;lov</h2>
                    <p className="text-slate-500">
                        {isPaymentCompleted
                            ? "To'lov tasdiqlandi"
                            : "To'lovni amalga oshirish uchun QR yoki tugmadan foydalaning"}
                    </p>
                </div>

                {isLoading && !isPaymentCompleted && (
                    <div className="text-center py-8">
                        <Loader className="h-12 w-12 mx-auto animate-spin text-blue-800 mb-4" />
                        <p className="text-slate-500">To&apos;lov sahifasi tayyorlanmoqda...</p>
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
                                    <p className="font-bold text-lg">To&apos;lov tasdiqlandi</p>
                                    <p className="text-sm text-emerald-800/90">
                                        Click orqali to&apos;lov muvaffaqiyatli qabul qilindi
                                    </p>
                                </div>
                            </div>
                            <dl className="space-y-2 text-sm text-slate-700">
                                <div className="flex justify-between gap-2 border-b border-emerald-500/20 pb-2">
                                    <dt className="text-slate-500">Xizmat</dt>
                                    <dd className="font-medium text-right">{serviceLabel}</dd>
                                </div>
                                <div className="flex justify-between gap-2 border-b border-emerald-500/20 pb-2">
                                    <dt className="text-slate-500">Summa</dt>
                                    <dd className="font-semibold text-right">
                                        {formatAmount(transaction.amount, transaction.currency)}
                                    </dd>
                                </div>
                                <div className="flex justify-between gap-2 border-b border-emerald-500/20 pb-2">
                                    <dt className="text-slate-500">Tranzaksiya ID</dt>
                                    <dd className="font-mono text-xs text-right break-all">{transaction.id}</dd>
                                </div>
                                {transaction.click_paydoc_id && (
                                    <div className="flex justify-between gap-2 border-b border-emerald-500/20 pb-2">
                                        <dt className="text-slate-500">Click hujjat ID</dt>
                                        <dd className="font-mono text-xs text-right">{transaction.click_paydoc_id}</dd>
                                    </div>
                                )}
                                <div className="flex justify-between gap-2">
                                    <dt className="text-slate-500">Tasdiqlangan vaqt</dt>
                                    <dd className="font-medium text-right">
                                        {formatDateTime(transaction.completed_at || transaction.created_at)}
                                    </dd>
                                </div>
                            </dl>
                        </div>

                        {transaction.udk_certificate_url && (
                            <div className="p-4 bg-green-500/20 border border-green-500/30 rounded-lg">
                                <p className="font-semibold text-emerald-900 mb-2">
                                    UDK tasdiqlangan ma&apos;lumotnoma tayyor
                                </p>
                                <a
                                    href={transaction.udk_certificate_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-sm text-emerald-800 hover:underline font-medium"
                                >
                                    Ma&apos;lumotnomani yuklab olish
                                </a>
                            </div>
                        )}

                        <div className="flex flex-col gap-2">
                            {transaction.service_type === 'publication_fee' && (
                                <>
                                    <Button onClick={() => navigate('/arxiv')} className="w-full">
                                        Arxiv hujjatlarga o&apos;tish
                                    </Button>
                                    <Button onClick={() => navigate('/articles?tab=journal')} variant="secondary" className="w-full">
                                        Maqolalarimga o&apos;tish
                                    </Button>
                                </>
                            )}
                            <Button
                                onClick={() => navigate('/dashboard')}
                                variant={transaction.service_type === 'publication_fee' ? 'secondary' : undefined}
                                className="w-full"
                            >
                                Bosh sahifaga qaytish
                            </Button>
                        </div>
                    </div>
                )}

                {showPendingSummary && (
                    <div className="mb-4 p-4 bg-slate-100/80 border border-slate-200/90 rounded-xl text-sm">
                        <p className="font-semibold text-slate-800 mb-2">To&apos;lov ma&apos;lumotlari</p>
                        <dl className="space-y-1.5 text-slate-700">
                            <div className="flex justify-between gap-2">
                                <dt className="text-slate-500">Xizmat</dt>
                                <dd className="font-medium text-right">{serviceLabel}</dd>
                            </div>
                            <div className="flex justify-between gap-2">
                                <dt className="text-slate-500">Summa</dt>
                                <dd className="font-semibold text-right">
                                    {formatAmount(transaction.amount, transaction.currency)}
                                </dd>
                            </div>
                            <div className="flex justify-between gap-2">
                                <dt className="text-slate-500">Holat</dt>
                                <dd className="font-medium text-right text-amber-800">Kutilmoqda</dd>
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
                                    ? "To'lov avtomatik tekshirilmoqda — tasdiqlangach quyida ko'rsatiladi"
                                    : "To'lovni amalga oshirgach, tasdiq bu sahifada avtomatik chiqadi"}
                            </span>
                        </div>

                        <div className="p-4 bg-green-500/20 border border-green-500/30 rounded-lg">
                            <div className="flex items-center gap-2 text-emerald-900 mb-2">
                                <CheckCircle className="h-5 w-5" />
                                <p className="font-semibold">Click to&apos;lov sahifasi tayyor</p>
                            </div>
                            <p className="text-sm text-slate-500">
                                {useMobileAutoFlow
                                    ? "Telefonda to'lov uchun avtomatik Click sahifasi ochiladi. Kompyuterdan kirgan bo'lsangiz, QR ni boshqa telefon bilan skanerlang."
                                    : "QR kodni telefon bilan skanerlang yoki tugma orqali Click rasmiy to'lov sahifasiga o'ting (my.click.uz)."}
                            </p>
                        </div>

                        {useMobileAutoFlow ? (
                            <div className="flex flex-col items-center justify-center p-8 bg-slate-100/70 rounded-xl border border-slate-200/90 min-h-[140px]">
                                <Loader className="h-10 w-10 animate-spin text-cyan-800 mb-3" />
                                <p className="text-slate-700 text-sm text-center font-medium">
                                    Click to&apos;lov sahifasiga yo&apos;naltirilmoqdasiz...
                                </p>
                                <p className="text-slate-500 text-xs mt-2 text-center">
                                    Ochilmasa, pastdagi tugmani bosing.
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center p-4 bg-white rounded-xl shadow-sm">
                                <p className="text-gray-700 text-sm font-medium mb-3 flex items-center gap-2">
                                    <QrCode className="h-4 w-4" />
                                    QR kod — telefonda to&apos;lash
                                </p>
                                <QRCodeSVG
                                    value={paymentUrl}
                                    size={240}
                                    level="M"
                                    bgColor="#ffffff"
                                    fgColor="#0f172a"
                                    includeMargin
                                    className="rounded-lg"
                                />
                                <p className="text-gray-700 text-xs mt-3 text-center max-w-[280px] font-medium">
                                    Telefonda: <strong>Click ilovasi</strong> → «QR orqali to&apos;lash» yoki kamerani
                                    shu QR ga qarating.
                                </p>
                            </div>
                        )}

                        <div className="border-t border-slate-200/90 pt-4">
                            <p className="text-sm text-slate-500 text-center mb-3">
                                {useMobileAutoFlow
                                    ? "Click ochilmagan bo'lsa:"
                                    : 'Yoki kompyuterdan — Click sahifasini ochish:'}
                            </p>
                            <Button
                                onClick={handlePayment}
                                className="w-full flex items-center justify-center gap-2"
                            >
                                <CreditCard className="h-5 w-5" />
                                {isMobilePaymentUi
                                    ? "Click orqali to'lash"
                                    : "Click orqali to'lash (sahifa yangi tabda ochiladi)"}
                            </Button>
                        </div>

                        <div className="flex justify-center">
                            <button
                                type="button"
                                onClick={() => void refreshTransaction(false)}
                                disabled={isLoading}
                                className="text-sm text-slate-500 hover:text-slate-900 underline-offset-2 hover:underline disabled:opacity-50"
                            >
                                Hozir tekshirish
                            </button>
                        </div>

                        <div className="text-center">
                            <button
                                type="button"
                                onClick={() => navigate('/dashboard')}
                                className="text-sm text-slate-500 hover:text-slate-900"
                            >
                                Orqaga qaytish
                            </button>
                        </div>
                    </div>
                )}

                {status === 'error' && !isPaymentCompleted && (
                    <div className="space-y-4">
                        <Button onClick={loadPaymentUrl} className="w-full">
                            Qayta urinib ko&apos;rish
                        </Button>
                        <div className="text-center">
                            <button
                                type="button"
                                onClick={() => navigate('/dashboard')}
                                className="text-sm text-slate-500 hover:text-slate-900"
                            >
                                Orqaga qaytish
                            </button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default ClickPayment;