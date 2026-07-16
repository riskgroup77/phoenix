import React, { useState, useEffect, useMemo } from 'react';
import Card from '../components/ui/Card';
import { useAuth } from '../contexts/AuthContext';
import { TranslationStatus } from '../types';
import { Languages, Download, Clock, CheckCircle, RefreshCw, XCircle, FileText, Loader2 } from 'lucide-react';
// FIX: Import the Button component to resolve 'Cannot find name' error.
import Button from '../components/ui/Button';
import { apiService } from '../services/apiService';
import { paymentService } from '../services/paymentService';
import { toast } from 'react-toastify';

// Type for the API response which has different field names
interface TranslationRequestApiResponse {
    id: string;
    author: string;
    reviewer?: string;
    title: string;
    source_language: string;
    target_language: string;
    source_file_path: string;
    translated_file_path?: string;
    status: TranslationStatus;
    word_count: number;
    cost: number;
    submission_date: string;
    completion_date?: string;
    author_name?: string;
    reviewer_name?: string;
    payment_completed?: boolean;
    payment_pending?: boolean;
    payment_status_label?: string;
}

const getStatusDisplayData = (status: TranslationStatus) => {
    switch (status) {
        case TranslationStatus.Yangi:
            return { text: 'Yangi', color: 'text-blue-800', icon: Clock };
        case TranslationStatus.Jarayonda:
            return { text: 'Jarayonda', color: 'text-yellow-800', icon: RefreshCw };
        case TranslationStatus.Bajarildi:
            return { text: 'Bajarildi', color: 'text-emerald-800', icon: CheckCircle };
        case TranslationStatus.BekorQilindi:
            return { text: 'Bekor Qilindi', color: 'text-red-700', icon: XCircle };
        default:
            return { text: status, color: 'text-slate-500', icon: FileText };
    }
};

const MyTranslations: React.FC = () => {
    const { user } = useAuth();
    const [requests, setRequests] = useState<TranslationRequestApiResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [payingRequestId, setPayingRequestId] = useState<string | null>(null);

    // Fetch translation requests
    useEffect(() => {
        const fetchRequests = async () => {
            if (!user) return;
            
            try {
                setLoading(true);
                setError(null);
                const response = await apiService.translations.list();
                
                // Ensure we're working with arrays
                const requestsArray = Array.isArray(response) 
                    ? response 
                    : (response?.data && Array.isArray(response.data) 
                        ? response.data 
                        : (response?.results && Array.isArray(response.results) 
                            ? response.results 
                            : []));
                
                setRequests(requestsArray);
            } catch (err: any) {
                console.error('Failed to fetch translation requests:', err);
                setError('Tarjima so\'rovlari ma\'lumotlarini yuklashda xatolik yuz berdi.');
            } finally {
                setLoading(false);
            }
        };

        fetchRequests();
    }, [user]);

    const myRequests = useMemo(() => {
        if (!user) return [];
        return requests
            .filter(req => String(req.author) === String(user.id))
            .sort((a, b) => new Date(b.submission_date).getTime() - new Date(a.submission_date).getTime());
    }, [user, requests]);

    const handlePayTranslation = async (req: TranslationRequestApiResponse) => {
        const amount = Number(req.cost ?? 0);
        if (amount <= 0) {
            toast.info("Ushbu tarjima uchun to'lov talab qilinmaydi.");
            return;
        }
        setPayingRequestId(req.id);
        try {
            const result = await paymentService.createTransactionAndPay(
                amount,
                'UZS',
                'translation',
                undefined,
                req.id,
                'click'
            );
            if (result?.transaction_id) {
                toast.info("To'lov sahifasiga yo'naltirilmoqda...");
                paymentService.redirectToPaymentPage(result.transaction_id);
                return;
            }
            toast.error(result?.error || result?.error_note || "To'lovni boshlashda xatolik");
        } catch (err: any) {
            toast.error(err?.message || "To'lovni boshlashda xatolik");
        } finally {
            setPayingRequestId(null);
        }
    };

    if (!user) {
        return <Card title="Xatolik"><p>Foydalanuvchi topilmadi.</p></Card>;
    }
    
    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }
    
    if (error) {
        return (
            <Card title="Xatolik">
                <p className="text-red-700">{error}</p>
                <Button onClick={() => window.location.reload()} className="mt-4">Qayta urinish</Button>
            </Card>
        );
    }

    return (
        <Card title="Mening Tarjimalarim">
            <p className="text-slate-600 mb-6 -mt-4">Bu yerda siz buyurtma qilgan tarjimalaringiz holatini kuzatib borishingiz mumkin.</p>
            <div className="space-y-4">
                {myRequests.length > 0 ? (
                    myRequests.map(req => {
                        const statusInfo = getStatusDisplayData(req.status);
                        const StatusIcon = statusInfo.icon;

                        return (
                            <div key={req.id} className="p-5 bg-slate-100/70 rounded-xl border border-slate-200/90">
                                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-3">
                                            <Languages className="text-indigo-400"/>
                                            {req.title}
                                        </h3>
                                        <p className="text-sm text-slate-500 mt-2">
                                            {req.source_language.toUpperCase()} → {req.target_language.toUpperCase()}
                                        </p>
                                        <div className="text-xs text-slate-500 mt-2">
                                            <span>Yuborilgan sana: {new Date(req.submission_date).toLocaleDateString()}</span>
                                            {req.status === TranslationStatus.Jarayonda && req.reviewer_name && (
                                                <span className="ml-2 pl-2 border-l border-slate-200">
                                                    Tarjimon: {req.reviewer_name}
                                                </span>
                                            )}
                                        </div>
                                        {(req.payment_status_label || Number(req.cost ?? 0) > 0) && (
                                            <p
                                                className={`mt-2 text-xs font-medium rounded-lg px-2 py-1.5 inline-block max-w-full ${
                                                    Number(req.cost ?? 0) <= 0 || req.payment_completed
                                                        ? 'bg-emerald-500/15 text-emerald-950'
                                                        : 'bg-amber-400/20 text-amber-950'
                                                }`}
                                            >
                                                To&apos;lov:{' '}
                                                {req.payment_status_label ||
                                                    (Number(req.cost ?? 0) <= 0
                                                        ? 'talab qilinmaydi'
                                                        : req.payment_completed
                                                          ? 'tasdiqlangan'
                                                          : 'kutilmoqda — «Xizmatlar»dan to‘lovni yakunlang')}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto">
                                        <div className={`flex items-center gap-2 font-semibold ${statusInfo.color}`}>
                                            <StatusIcon className={`w-5 h-5 ${req.status === TranslationStatus.Jarayonda ? 'animate-spin' : ''}`} />
                                            <span>{statusInfo.text}</span>
                                        </div>
                                        {Number(req.cost ?? 0) > 0 && !req.payment_completed && (
                                            <Button
                                                onClick={() => handlePayTranslation(req)}
                                                disabled={payingRequestId === req.id}
                                                className="w-full sm:w-auto"
                                            >
                                                {payingRequestId === req.id ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Yo&apos;naltirilmoqda...
                                                    </>
                                                ) : (
                                                    "To'lov qilish"
                                                )}
                                            </Button>
                                        )}
                                        {req.status === TranslationStatus.Bajarildi && req.translated_file_path && (
                                            <a href={apiService.getMediaUrl(req.translated_file_path)} download>
                                                <Button variant="secondary" className="w-full">
                                                    <Download className="mr-2 h-4 w-4"/> Tarjimani Yuklash
                                                </Button>
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-12">
                        <Languages className="mx-auto h-16 w-16 text-slate-500" />
                        <h3 className="mt-4 text-xl font-semibold text-slate-900">Sizda Hozircha Tarjima Buyurtmalari Yo'q</h3>
                        <p className="mt-2 text-sm text-slate-500">"Xizmatlar" bo'limi orqali yangi tarjima buyurtma qilishingiz mumkin.</p>
                    </div>
                )}
            </div>
        </Card>
    );
};

export default MyTranslations;