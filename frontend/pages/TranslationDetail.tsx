import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, useNotifications } from '../contexts/AuthContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Download, UploadCloud, Send, Languages, ArrowRight, User, Calendar, FileText, Check, Loader2 } from 'lucide-react';
import { apiService } from '../services/apiService';
import { TranslationStatus, Role } from '../types';

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

const TranslationDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { addNotification } = useNotifications();

    const [request, setRequest] = useState<TranslationRequestApiResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [translatedFile, setTranslatedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    const userRole = typeof user?.role === 'string' ? user.role.toLowerCase() : user?.role;
    const isReviewer = useMemo(
        () => userRole === 'reviewer' || user?.role === Role.Reviewer,
        [user?.role, userRole]
    );
    const isSuperAdmin = useMemo(
        () => userRole === 'super_admin' || user?.role === Role.SuperAdmin,
        [user?.role, userRole]
    );

    useEffect(() => {
        const fetchRequest = async () => {
            if (!id || !user) return;

            try {
                setLoading(true);
                setError(null);
                const response = await apiService.translations.get(id);
                const requestData = (response as { data?: TranslationRequestApiResponse }).data || response;
                setRequest(requestData as TranslationRequestApiResponse);
            } catch (err: unknown) {
                console.error('Failed to fetch translation request:', err);
                setError("Tarjima so'rovi ma'lumotlarini yuklashda xatolik yuz berdi.");
            } finally {
                setLoading(false);
            }
        };

        fetchRequest();
    }, [id, user]);

    if (!user) {
        return (
            <Card title="Kirish kerak">
                <p>Ushbu sahifani ko&apos;rish uchun tizimga kiring.</p>
            </Card>
        );
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
            </div>
        );
    }

    if (error) {
        return (
            <Card title="Xatolik">
                <p className="text-red-700">{error}</p>
                <Button onClick={() => window.location.reload()} className="mt-4">
                    Qayta urinish
                </Button>
            </Card>
        );
    }

    if (!request) {
        return (
            <Card title="Xatolik">
                <p>Tarjima so&apos;rovi topilmadi.</p>
            </Card>
        );
    }

    const isAuthor = String(request.author) === String(user.id);
    const canView = isReviewer || isSuperAdmin || isAuthor;
    /** Taqrizchi yoki super admin: qabul qilish va tayyor fayl yuborish */
    const canManage = isReviewer || isSuperAdmin;

    if (!canView) {
        return (
            <Card title="Ruxsat rad etildi">
                <p>Ushbu sahifani ko&apos;rish huquqingiz yo&apos;q.</p>
            </Card>
        );
    }

    const handleAcceptRequest = async () => {
        if (!canManage || !id) return;
        try {
            const response = await apiService.translations.update(id, {
                status: TranslationStatus.Jarayonda,
                reviewer: user.id,
            });
            const updatedRequest =
                (response as { data?: TranslationRequestApiResponse }).data || response;
            setRequest(updatedRequest as TranslationRequestApiResponse);
            addNotification({
                message: `"${request.title}" tarjima so'rovi sizga biriktirildi.`,
                link: '/articles',
            });
        } catch (err: unknown) {
            console.error('Failed to accept translation request:', err);
            alert("Tarjima so'rovini qabul qilishda xatolik yuz berdi.");
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setTranslatedFile(e.target.files[0]);
        }
    };

    const handleComplete = async () => {
        if (!canManage || !id) return;
        if (!translatedFile) {
            alert('Iltimos, avval tarjima qilingan faylni yuklang.');
            return;
        }

        try {
            setUploading(true);
            const response = await apiService.translations.update(id, {
                status: TranslationStatus.Bajarildi,
                completion_date: new Date().toISOString(),
                file: translatedFile,
            });
            const updatedRequest =
                (response as { data?: TranslationRequestApiResponse }).data || response;
            setRequest(updatedRequest as TranslationRequestApiResponse);

            addNotification({
                message: `Tarjima yakunlandi: "${request.title}".`,
                link: '/articles',
            });

            alert("Tarjima muvaffaqiyatli yuborildi. Muallif tayyor faylni ko'ra oladi.");
            navigate('/articles');
        } catch (err: unknown) {
            console.error('Failed to complete translation:', err);
            alert('Tarjimani yakunlashda xatolik yuz berdi.');
        } finally {
            setUploading(false);
        }
    };

    const showReviewerActions = canManage;
    const costNum = Number(request.cost ?? 0);
    /** Aniq `false` — tizim to'lov topilmadi deb biladi (taqrizchi bloklanadi) */
    const translationNeedsPay = costNum > 0 && request.payment_completed === false;
    /** Muallif: to'lov hali tasdiqlanmagan (yoki API eski) */
    const showAuthorPayReminder = isAuthor && costNum > 0 && request.payment_completed !== true;

    const canAccept =
        showReviewerActions &&
        request.status === TranslationStatus.Yangi &&
        (!request.reviewer || String(request.reviewer) === String(user.id)) &&
        !translationNeedsPay;
    const canUpload =
        showReviewerActions &&
        request.status === TranslationStatus.Jarayonda &&
        (!request.reviewer || String(request.reviewer) === String(user.id)) &&
        !translationNeedsPay;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
                <Card>
                    <div className="flex items-center gap-4 mb-4 pb-4 border-b border-slate-200/90">
                        <Languages className="w-10 h-10 text-indigo-400" />
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900">{request.title}</h2>
                            <p className="text-lg font-semibold text-indigo-300">
                                {request.source_language?.toUpperCase() || "Noma'lum"}{' '}
                                <ArrowRight size={16} className="inline-block mx-2" />{' '}
                                {request.target_language?.toUpperCase() || "Noma'lum"}
                            </p>
                        </div>
                    </div>

                    {(request.payment_status_label || costNum > 0) && (
                        <div
                            className={`mb-4 rounded-xl border px-4 py-3 text-sm font-medium ${
                                costNum <= 0 || request.payment_completed
                                    ? 'border-emerald-300/80 bg-emerald-500/10 text-emerald-950'
                                    : 'border-amber-400/70 bg-amber-400/15 text-amber-950'
                            }`}
                        >
                            <p className="font-semibold text-slate-900">
                                To&apos;lov holati
                            </p>
                            <p className="mt-1 text-slate-800">
                                {request.payment_status_label ||
                                    (costNum <= 0
                                        ? 'To\'lov talab qilinmaydi.'
                                        : request.payment_completed
                                          ? 'To\'lov tasdiqlangan.'
                                          : 'To\'lov holati tekshirilmoqda — «Xizmatlar → Tarjima»dan to\'lovni yakunlang.')}
                            </p>
                            {showAuthorPayReminder && (
                                <p className="mt-2 text-xs text-slate-700">
                                    Click yoki Payme orqali to&apos;lov tugagach, bu yerda &quot;To&apos;lov tasdiqlangan&quot;
                                    deb chiqadi. To&apos;lov kutayotgan bo&apos;lsa, biroz kutib sahifani yangilang.
                                </p>
                            )}
                            {canManage && translationNeedsPay && (
                                <p className="mt-2 text-xs text-amber-950">
                                    Muallif to&apos;lovni yakunlaguncha buyurtmani ishga qabul qilish mumkin emas.
                                </p>
                            )}
                        </div>
                    )}

                    {isAuthor && !canManage && (
                        <p className="text-sm text-slate-500 mb-4 p-3 rounded-lg bg-slate-100/70 border border-slate-200/90">
                            Bu sizning tarjima buyurtmangiz. Holat yangilanishi va tayyor fayl paydo bo&apos;lishi
                            taqrizchi tomonidan bajariladi.
                        </p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mt-6">
                        <div className="flex items-center gap-3 p-3 bg-slate-100/70 rounded-md">
                            <User className="w-5 h-5 text-slate-500" />
                            <div>
                                <p className="text-xs text-slate-500">Muallif</p>
                                <p className="font-semibold text-slate-900">{request.author_name || "Noma'lum"}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-slate-100/70 rounded-md">
                            <Calendar className="w-5 h-5 text-slate-500" />
                            <div>
                                <p className="text-xs text-slate-500">Sana</p>
                                <p className="font-semibold text-slate-900">
                                    {request.submission_date
                                        ? new Date(request.submission_date).toLocaleDateString()
                                        : "Noma'lum"}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-slate-100/70 rounded-md">
                            <FileText className="w-5 h-5 text-slate-500" />
                            <div>
                                <p className="text-xs text-slate-500">So&apos;zlar soni</p>
                                <p className="font-semibold text-slate-900">
                                    {request.word_count?.toLocaleString() || 0} ta
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-slate-100/70 rounded-md">
                            <FileText className="w-5 h-5 text-slate-500" />
                            <div>
                                <p className="text-xs text-slate-500">Narxi</p>
                                <p className="font-semibold text-slate-900">
                                    {request.cost != null ? Number(request.cost).toLocaleString() : 0} so&apos;m
                                </p>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
            <div className="lg:col-span-1 space-y-6">
                <Card title="Asosiy hujjat">
                    {request.source_file_path ? (
                        <a href={apiService.getMediaUrl(request.source_file_path)} download>
                            <Button variant="secondary" className="w-full">
                                <Download className="mr-2 h-4 w-4" /> Manba faylni yuklab olish
                            </Button>
                        </a>
                    ) : (
                        <p className="text-slate-500 text-center py-4">Hujjat mavjud emas</p>
                    )}
                </Card>

                {canAccept && (
                    <Card title="Harakatlar">
                        <p className="text-xs text-slate-500 mb-3">
                            Avval manba faylni yuklab oling, tarjima qiling, keyin tayyor faylni yuklash uchun
                            &quot;Jarayonda&quot; holatiga o&apos;ting.
                        </p>
                        <Button onClick={handleAcceptRequest} className="w-full">
                            <Check className="mr-2 h-4 w-4" /> Ishga qabul qilish
                        </Button>
                    </Card>
                )}

                {canUpload && (
                    <Card title="Tayyor tarjimani yuklash">
                        <p className="text-xs text-slate-500 mb-3">
                            Tarjima yoki tayyor matnni (DOCX/PDF) yuklang. Yakunlaganingizdan keyin muallifga
                            ko&apos;rinadi.
                        </p>
                        <label htmlFor="file-upload" className="cursor-pointer">
                            <div className="p-8 border-2 border-dashed rounded-lg border-slate-200 text-center bg-slate-100/70 hover:bg-white/10 transition-colors">
                                <UploadCloud className="mx-auto h-12 w-12 text-slate-500" />
                                <p className="mt-2 text-sm text-slate-500">
                                    {translatedFile ? `Tanlandi: ${translatedFile.name}` : 'Tayyor faylni tanlang'}
                                </p>
                            </div>
                            <input id="file-upload" type="file" className="sr-only" onChange={handleFileChange} />
                        </label>
                        <Button
                            onClick={handleComplete}
                            disabled={!translatedFile || uploading}
                            className="w-full mt-4"
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Yuklanmoqda...
                                </>
                            ) : (
                                <>
                                    <Send className="mr-2 h-4 w-4" /> Yakunlash va muallifga yuborish
                                </>
                            )}
                        </Button>
                    </Card>
                )}

                {request.status === TranslationStatus.Bajarildi && request.translated_file_path && (
                    <Card title="Tayyor tarjima">
                        <a href={apiService.getMediaUrl(request.translated_file_path)} download>
                            <Button variant="primary" className="w-full">
                                <Download className="mr-2 h-4 w-4" /> Tayyor faylni yuklab olish
                            </Button>
                        </a>
                    </Card>
                )}
            </div>
        </div>
    );
};

export default TranslationDetail;
