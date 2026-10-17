import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ListSkeleton, PageSkeleton } from '../components/ui/Skeleton';
import TelegramSettingsCard from '../components/TelegramSettingsCard';
import PhoneVerifyCard from '../components/PhoneVerifyCard';
import PrivacyDataCard from '../components/PrivacyDataCard';
import { LANGUAGES, useT } from '../i18n/LanguageContext';
import { normalizeOrcid, orcidUrl } from '../utils/orcid';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, useNotifications } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import Card from '../components/ui/Card';
import EditorialTabs from '../components/EditorialTabs';
import Button from '../components/ui/Button';
import { User, Mail, Phone, Building, Award, Hash, Edit, CreditCard, Archive, Bell, Settings, Camera, Loader2 } from 'lucide-react';
import { apiService } from '../services/apiService';
import { paymentService } from '../services/paymentService';
import { showPaymentTestTools } from '../config/env';
import { toast } from 'react-toastify';
import { txAmount } from '../utils/amount';
import { asApiList } from '../utils/apiList';
import type { Notification } from '../types';
import { isPlaceholderEmail } from '../utils/placeholderEmail';

import { personFullName } from '../utils/personName';
type ProfileTab = 'profile' | 'payments' | 'notifications' | 'settings';

const PROFILE_TABS: { id: ProfileTab; label: string; icon: typeof User }[] = [
    { id: 'profile', label: 'Profil', icon: User },
    { id: 'payments', label: "To'lovlar", icon: CreditCard },
    { id: 'notifications', label: 'Bildirishnomalar', icon: Bell },
    { id: 'settings', label: 'Sozlamalar', icon: Settings },
];

const SERVICE_LABELS: Record<string, string> = {
    'fast-track': 'Tezkor nashr',
    publication_fee: 'Nashr to\'lovi',
    language_editing: 'Til tahriri / antiplagiat',
    top_up: 'Balans to\'ldirish',
    book_publication: 'Kitob nashri',
    translation: 'Tarjima',
    doi: 'DOI',
    udk: 'UDK',
    doi_request: 'DOI raqami',
    udk_request: 'UDK buyurtmasi',
    article_sample: 'Maqola namunasi',
};

const STATUS_LABELS: Record<string, string> = {
    completed: 'Muvaffaqiyatli',
    pending: 'Kutilmoqda',
    failed: 'Muvaffaqiyatsiz',
    cancelled: 'Bekor qilingan',
};

const Profile: React.FC = () => {
    const { user, logout, setAvatarUrl } = useAuth();
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
    const { theme, setTheme } = useTheme();
    const { lang, setLang, t } = useT();
    const navigate = useNavigate();
    const [orcidError, setOrcidError] = useState('');
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as ProfileTab) || 'profile';
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<any>({});
    const [processingPayment, setProcessingPayment] = useState(false);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loadingPayments, setLoadingPayments] = useState(false);

    const setTab = (tab: ProfileTab) => {
        setSearchParams({ tab }, { replace: true });
    };

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (!tab) {
            setSearchParams({ tab: 'profile' }, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    useEffect(() => {
        if (activeTab !== 'payments' || !user) return;
        let cancelled = false;
        (async () => {
            try {
                setLoadingPayments(true);
                const raw = await apiService.payments.getTransactions();
                if (!cancelled) {
                    setTransactions(asApiList(raw));
                }
            } catch (err) {
                console.error('Transactions fetch failed', err);
                if (!cancelled) setTransactions([]);
            } finally {
                if (!cancelled) setLoadingPayments(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [activeTab, user]);

    const sortedTransactions = useMemo(
        () =>
            [...transactions].sort(
                (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
            ),
        [transactions],
    );

    const handleNotificationOpen = (notification: Notification) => {
        markAsRead(notification.id);
        if (notification.link) {
            navigate(notification.link);
        }
    };

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user) return;
            
            try {
                setLoading(true);
                setError(null);
                
                const profileData = await apiService.auth.getProfile();
                const userData = profileData.data || profileData;
                setProfile(userData);
                setFormData({
                    first_name: userData.first_name,
                    last_name: userData.last_name,
                    patronymic: userData.patronymic || '',
                    email: isPlaceholderEmail(userData.email) ? '' : userData.email,
                    phone: userData.phone,
                    affiliation: userData.affiliation,
                    orcid_id: userData.orcid_id || '',
                    telegram_username: userData.telegram_username || '',
                });
            } catch (err: any) {
                console.error('Failed to fetch profile:', err);
                setError('Profil ma\'lumotlarini yuklashda xatolik yuz berdi.');
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [user]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            toast.error(t('Faqat JPG, PNG yoki WEBP rasm yuklang.'));
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error(t("Rasm hajmi 5 MB dan oshmasligi kerak."));
            return;
        }
        setAvatarUploading(true);
        try {
            const updated = await apiService.auth.uploadAvatar(file);
            setProfile((prev: any) => (prev ? { ...prev, avatar_url: updated.avatar_url } : prev));
            setAvatarUrl(updated.avatar_url || '');
            toast.success(t('Profil rasmi yangilandi'));
        } catch (err: any) {
            toast.error(err?.message || 'Rasmni yuklashda xatolik');
        } finally {
            setAvatarUploading(false);
        }
    };

    const handleAvatarDelete = async () => {
        setAvatarUploading(true);
        try {
            await apiService.auth.deleteAvatar();
            setProfile((prev: any) => (prev ? { ...prev, avatar_url: null } : prev));
            setAvatarUrl('');
            toast.success(t("Profil rasmi o'chirildi"));
        } catch (err: any) {
            toast.error(err?.message || "Rasmni o'chirishda xatolik");
        } finally {
            setAvatarUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const orcid = normalizeOrcid(formData.orcid_id || '');
        if (orcid === null) {
            setOrcidError("ORCID iD noto'g'ri. Format: 0000-0000-0000-0000 (orcid.org profilingizdan nusxalang).");
            return;
        }
        setOrcidError('');
        try {
            // Email bo'sh qoldirilsa yuborilmaydi — bazadagi vaqtinchalik email saqlanadi (maydon majburiy/unikal)
            const { email, ...rest } = formData;
            const payload = email.trim() ? { ...rest, email: email.trim(), orcid_id: orcid } : { ...rest, orcid_id: orcid };
            const updatedProfile = await apiService.auth.updateProfile(payload);
            const userData = updatedProfile.data || updatedProfile;
            setProfile(userData);
            setIsEditing(false);
            toast.success(t('Profil muvaffaqiyatli yangilandi'));
        } catch (err: any) {
            console.error('Failed to update profile:', err);
            toast.error(err?.message || 'Profilni yangilashda xatolik yuz berdi');
        }
    };

    const handleTestPayment = async () => {
        if (processingPayment) return;

        setProcessingPayment(true);
        setError(null);
        
        try {
            toast.info(t('To\'lov tayyorlanmoqda...'), { autoClose: 2000 });
            
            console.log('Starting test payment...');
            
            // Create transaction and process payment with 1000 UZS
            const result = await paymentService.createTransactionAndPay(
                1000, // 1000 so'm test to'lov
                'UZS',
                'top_up'
            );

            console.log('Payment result:', result);

            // Check if payment was successful — QR kodli to'lov sahifasiga yo'naltirish
            if (result && result.success === true && result.transaction_id) {
                toast.success(t('To\'lov sahifasiga yo\'naltirilmoqdasiz. QR kodni skanerlang yoki tugmani bosing.'), { autoClose: 2000 });
                paymentService.redirectToPaymentPage(result.transaction_id);
            } else if (result && result.success === true && (result.payment_url || result.transaction_id)) {
                toast.success(t('To\'lov sahifasiga yo\'naltirilmoqdasiz. QR kodni skanerlang.'), { autoClose: 2000 });
                if (result.transaction_id) {
                    paymentService.redirectToPaymentPage(result.transaction_id);
                } else if (result.payment_url) {
                    setTimeout(() => paymentService.redirectToPayment(result.payment_url), 1500);
                }
            } else {
                // Payment failed - show error message
                let errorMsg = 'To\'lovni amalga oshirishda xatolik yuz berdi';
                
                if (result) {
                    // Check for user-friendly message first
                    if (result.user_message) {
                        errorMsg = result.user_message;
                    } else if (result.error_note) {
                        errorMsg = result.error_note;
                    } else if (result.error) {
                        errorMsg = result.error;
                    } else if (result.details) {
                        // Check details for error message
                        if (result.details.user_message) {
                            errorMsg = result.details.user_message;
                        } else if (result.details.error_note) {
                            errorMsg = result.details.error_note;
                        } else if (result.details.error) {
                            errorMsg = result.details.error;
                        }
                    }
                    
                    // If no payment_url, provide specific guidance
                    if (!result.payment_url) {
                        if (result.error_code === -514 || result.details?.error_code === -514) {
                            errorMsg = 'Sizning telefon raqamingiz Click tizimida ro\'yxatdan o\'tmagan. Iltimos, telefon raqamingizni Click tizimida ro\'yxatdan o\'tkazing va qayta urinib ko\'ring.';
                        } else if (result.error_code === -1 || !result.error_code) {
                            errorMsg = 'To\'lov URL yaratib bo\'lmadi. Iltimos, qayta urinib ko\'ring yoki texnik yordamga murojaat qiling.';
                        } else {
                            errorMsg = 'To\'lovni amalga oshirishda xatolik yuz berdi. Iltimos, qayta urinib ko\'ring.';
                        }
                    }
                }
                
                console.error('Payment failed:', result);
                toast.error(errorMsg, { autoClose: 8000 });
                setError(errorMsg);
            }
        } catch (err: any) {
            console.error('Test payment error:', err);
            
            // Extract error message
            let errorMsg = 'To\'lovni amalga oshirishda xatolik yuz berdi';
            
            if (err.response) {
                // API error response
                const errorData = err.response.data || err.response;
                errorMsg = errorData.error_note || errorData.error || errorData.detail || errorMsg;
            } else if (err.message) {
                errorMsg = err.message;
            } else if (typeof err === 'string') {
                errorMsg = err;
            }
            
            toast.error(errorMsg, { autoClose: 5000 });
            setError(errorMsg);
        } finally {
            setProcessingPayment(false);
        }
    };

    const roleNames: Record<string, string> = {
        'author': 'Muallif',
        'reviewer': 'Taqrizchi',
        'journal_admin': 'Jurnal administratori',
        'super_admin': 'Bosh administrator',
        'accountant': 'Moliyachi',
    };

    if (loading) {
        return <PageSkeleton />;
    }

    if (error) {
        return (
            <Card title={t('Error')}>
                <p className="text-red-700">{error}</p>
                <Button onClick={() => window.location.reload()} className="mt-4">{t('Retry')}</Button>
            </Card>
        );
    }

    if (!profile) {
        return <Card title={t('Xatolik')}><p>{t('Profil ma\'lumotlari topilmadi.')}</p></Card>;
    }

    return (
        <div className="space-y-6">
            <EditorialTabs
                tabs={PROFILE_TABS.map((tab) => ({
                    id: tab.id,
                    label: t(tab.label),
                    count: tab.id === 'notifications' && unreadCount > 0 ? unreadCount : undefined,
                }))}
                activeId={activeTab}
                onChange={(id) => setTab(id as ProfileTab)}
            />

            {activeTab === 'payments' && (
                <Card title={t('To\'lovlar tarixi')}>
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-3 rounded-[10px] bg-[var(--editorial-bg-alt)]">
                        <p className="m-0 text-sm text-[var(--editorial-body)]">{t('Cheklar (PDF) va to\'liq ro\'yxat alohida sahifada.')}</p>
                        <Button type="button" variant="secondary" onClick={() => navigate('/payments')}>{t('To\'lovlarim sahifasi')}</Button>
                    </div>
                    {loadingPayments ? (
                        <ListSkeleton rows={4} />
                    ) : sortedTransactions.length === 0 ? (
                        <p className="text-slate-500 text-sm py-6 text-center">
                            {t('Hozircha to\'lovlar tarixi yo\'q.')}
                        </p>
                    ) : (
                        <div className="overflow-x-auto rtable-wrap">
                            <table className="w-full text-left text-sm rtable">
                                <thead>
                                    <tr className="border-b border-slate-200">
                                        <th className="pb-2 font-medium text-slate-500">{t('Xizmat')}</th>
                                        <th className="pb-2 font-medium text-slate-500">{t('Summa')}</th>
                                        <th className="pb-2 font-medium text-slate-500">{t('Holat')}</th>
                                        <th className="pb-2 font-medium text-slate-500 hidden sm:table-cell">{t('Sana')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedTransactions.map((tx) => (
                                        <tr key={tx.id} className="border-b border-slate-100">
                                            <td className="py-3 pr-3 text-slate-900">
                                                {t(SERVICE_LABELS[tx.service_type] || tx.service_type || '—')}
                                            </td>
                                            <td className="py-3 pr-3 font-medium text-slate-900 whitespace-nowrap">
                                                {Math.abs(txAmount(tx.amount)).toLocaleString('uz-UZ')} {tx.currency || 'UZS'}
                                            </td>
                                            <td className="py-3 pr-3">
                                                <span
                                                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                                                        tx.status === 'completed'
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : tx.status === 'pending'
                                                              ? 'bg-amber-100 text-amber-800'
                                                              : 'bg-red-100 text-red-800'
                                                    }`}
                                                >
                                                    {t(STATUS_LABELS[tx.status] || tx.status)}
                                                </span>
                                            </td>
                                            <td className="py-3 text-slate-500 hidden sm:table-cell whitespace-nowrap">
                                                {tx.created_at
                                                    ? new Date(tx.created_at).toLocaleString('uz-UZ')
                                                    : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            )}

            {activeTab === 'notifications' && (
                <Card title={t('Bildirishnomalar')}>
                    <div className="flex justify-between items-center mb-4">
                        <p className="text-sm text-slate-500">
                            {unreadCount > 0 ? t("{n} ta o'qilmagan", { n: unreadCount }) : t('Barcha bildirishnomalar o\'qilgan')}
                        </p>
                        {notifications.length > 0 && (
                            <Button type="button" variant="secondary" onClick={() => markAllAsRead()}>
                                {t('Hammasini o\'qilgan deb belgilash')}
                            </Button>
                        )}
                    </div>
                    {notifications.length === 0 ? (
                        <p className="text-slate-500 text-sm py-8 text-center">{t('Yangi bildirishnomalar yo\'q.')}</p>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {notifications.map((n) => (
                                <li
                                    key={n.id}
                                    className={`py-3 px-2 rounded-lg cursor-pointer hover:bg-slate-50 ${
                                        !n.read ? 'bg-blue-50/60' : ''
                                    }`}
                                    onClick={() => handleNotificationOpen(n)}
                                >
                                    <p className="text-sm text-slate-800 leading-relaxed">{n.message}</p>
                                    {!n.read && (
                                        <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide text-blue-600">
                                            {t('Yangi')}
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            )}

            {activeTab === 'settings' && (
                <>
                    <TelegramSettingsCard
                        connected={!!profile.telegram_connected}
                        enabled={profile.telegram_notifications !== false}
                        botUsername={profile.telegram_bot_username}
                        onChange={(enabled) => setProfile((p: any) => ({ ...p, telegram_notifications: enabled }))}
                    />
                    <Card title={t('Til / Язык / Language')}>
                        <p className="text-sm text-slate-500 mb-3">{t('Interfeys tilini tanlang.')}</p>
                        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('Til')}>
                            {LANGUAGES.map((l) => (
                                <Button
                                    key={l.code}
                                    type="button"
                                    role="radio"
                                    aria-checked={lang === l.code}
                                    variant={lang === l.code ? 'primary' : 'secondary'}
                                    onClick={() => setLang(l.code)}
                                >
                                    <span lang={l.htmlLang}>{l.label}</span>
                                </Button>
                            ))}
                        </div>
                    </Card>
                    {profile.role === 'author' && (
                        <Card title={t('Arxiv hujjatlar')}>
                            <p className="text-slate-500 text-sm mb-3">
                                {t('Nashr sertifikatlari, UDK, taqriz natijalari, DOI va antiplagiat tekshiruvlari.')}
                            </p>
                            <Button variant="secondary" onClick={() => navigate('/arxiv')}>
                                <Archive className="mr-2 h-4 w-4" /> {t('Arxiv hujjatlar sahifasiga o\'tish')}
                            </Button>
                        </Card>
                    )}
                    <Card title={t('Ko\'rinish')}>
                        <p className="text-sm text-slate-500 mb-3">{t('Interfeys mavzusini tanlang.')}</p>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant={theme === 'light' ? 'primary' : 'secondary'}
                                onClick={() => setTheme('light')}
                            >
                                {t('Yorug\'')}
                            </Button>
                            <Button
                                type="button"
                                variant={theme === 'dark' ? 'primary' : 'secondary'}
                                onClick={() => setTheme('dark')}
                            >
                                {t('Qorong\'u')}
                            </Button>
                        </div>
                    </Card>
                    <PrivacyDataCard />
                    <Card title={t('Hisobni boshqarish')}>
                        <div className="space-y-4">
                            {showPaymentTestTools && (
                                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                                    <h3 className="text-sm font-medium text-blue-900 mb-2">{t('Test To\'lov (faqat dev)')}</h3>
                                    <p className="text-xs text-slate-500 mb-3">
                                        {t('Click to\'lov tizimini sinab ko\'rish uchun 1000 so\'m miqdorida test to\'lovini amalga oshirish mumkin.')}
                                    </p>
                                    {error && (
                                        <div className="mb-3 p-2 bg-red-500/20 border border-red-500/30 rounded text-xs text-red-800">
                                            {error}
                                        </div>
                                    )}
                                    <Button
                                        onClick={handleTestPayment}
                                        disabled={processingPayment}
                                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                                    >
                                        <CreditCard className="mr-2 h-4 w-4" />
                                        {processingPayment ? t('Jarayonda...') : t('1000 so\'m test to\'lov')}
                                    </Button>
                                </div>
                            )}
                            <div className="flex flex-col sm:flex-row gap-4 pt-2 border-t border-slate-200/90">
                                <Button variant="danger" onClick={logout}>
                                    {t('Chiqish')}
                                </Button>
                            </div>
                        </div>
                    </Card>
                </>
            )}

            {activeTab === 'profile' && (
            <Card title={t('Profilim')}>
                <div className="flex flex-col md:flex-row gap-8">
                    <div className="flex flex-col items-center">
                        <div className="relative">
                            {profile.avatar_url ? (
                                <img 
                                    src={profile.avatar_url} 
                                    alt="Avatar" 
                                    className="h-32 w-32 rounded-full object-cover border-4 border-slate-200/90"
                                />
                            ) : (
                                <div className="h-32 w-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center border-4 border-slate-200/90">
                                    <User className="h-16 w-16 text-slate-900" />
                                </div>
                            )}
                            {/* Avval onClick yo'q edi — tugma hech narsa qilmasdi */}
                            <button
                                type="button"
                                onClick={() => avatarInputRef.current?.click()}
                                disabled={avatarUploading}
                                title={t('Rasmni o\'zgartirish')}
                                aria-label={t('Rasmni o\'zgartirish')}
                                className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[var(--editorial-primary)] text-white shadow-md transition hover:brightness-110 disabled:opacity-70"
                            >
                                {avatarUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                            </button>
                            <input
                                ref={avatarInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                onChange={handleAvatarChange}
                            />
                        </div>
                        <div className="mt-4 text-center">
                            <h2 className="text-xl font-bold text-slate-900">
                                {personFullName(profile)}
                            </h2>
                            <p className="text-slate-500">{t(roleNames[profile.role] || profile.role)}</p>
                            {profile.avatar_url && (
                                <button type="button" onClick={handleAvatarDelete} disabled={avatarUploading} className="mt-2 text-xs text-red-700 hover:underline disabled:opacity-60">
                                    {t('Rasmni o\'chirish')}
                                </button>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex-1">
                        {isEditing ? (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-2">{t('Ism')}</label>
                                        <input
                                            type="text"
                                            name="first_name"
                                            value={formData.first_name}
                                            onChange={handleInputChange}
                                            className="w-full"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-2">{t('Familiya')}</label>
                                        <input
                                            type="text"
                                            name="last_name"
                                            value={formData.last_name}
                                            onChange={handleInputChange}
                                            className="w-full"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-2">{t('Otasining ismi')}</label>
                                        <input
                                            type="text"
                                            name="patronymic"
                                            value={formData.patronymic}
                                            onChange={handleInputChange}
                                            className="w-full"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-2">{t('Telefon')}</label>
                                        <div className="flex">
                                            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-slate-200/90 bg-slate-100/70 text-slate-600">
                                                +998
                                            </span>
                                            <input
                                                type="tel"
                                                name="phone"
                                                // Bazada 998XXXXXXXXX — "+998" prefiksi yonida qayta ko'rinmasin (server raqamni o'zi normallashtiradi)
                                                value={formData.phone?.replace(/^\+?998(?=\d{9}$)/, '')}
                                                onChange={handleInputChange}
                                                className="flex-1 min-w-0 block w-full rounded-none rounded-r-md"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-600 mb-2">{t('Email')}</label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleInputChange}
                                            className="w-full"
                                            placeholder={t('email@misol.uz (ixtiyoriy)')}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-600 mb-2">{t('Ish yoki o\'qish joyi')}</label>
                                        <input
                                            type="text"
                                            name="affiliation"
                                            value={formData.affiliation}
                                            onChange={handleInputChange}
                                            className="w-full"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="profile-orcid" className="block text-sm font-medium text-slate-600 mb-2">{t('ORCID iD')}</label>
                                        <input
                                            id="profile-orcid"
                                            type="text"
                                            name="orcid_id"
                                            value={formData.orcid_id}
                                            onChange={(e) => {
                                                handleInputChange(e);
                                                if (orcidError) setOrcidError('');
                                            }}
                                            placeholder="0000-0002-1825-0097"
                                            aria-invalid={!!orcidError}
                                            aria-describedby="profile-orcid-hint"
                                            className="w-full"
                                        />
                                        <p id="profile-orcid-hint" className={`mt-1.5 text-xs ${orcidError ? 'text-red-700 dark:text-red-300' : 'text-[var(--editorial-muted)]'}`}>
                                            {orcidError || "orcid.org dagi 16 belgili raqam. Crossref DOI yozuvida va maqola sahifasida ko'rsatiladi."}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-2">{t('Telegram')}</label>
                                        <div className="flex">
                                            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-slate-200/90 bg-slate-100/70 text-slate-600">
                                                @
                                            </span>
                                            <input
                                                type="text"
                                                name="telegram_username"
                                                value={formData.telegram_username?.replace('@', '')}
                                                onChange={handleInputChange}
                                                className="flex-1 min-w-0 block w-full rounded-none rounded-r-md"
                                            />
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex gap-3 pt-4">
                                    <Button type="submit">{t('Saqlash')}</Button>
                                    <Button 
                                        type="button" 
                                        variant="secondary" 
                                        onClick={() => setIsEditing(false)}
                                    >
                                        {t('Bekor qilish')}
                                    </Button>
                                </div>
                            </form>
                        ) : (
                            <div className="space-y-4">
                                <PhoneVerifyCard />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex items-center p-3 bg-slate-100/70 rounded-lg min-w-0">
                                        <User className="h-5 w-5 text-blue-800 mr-3 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-sm text-slate-500">{t('To\'liq ism')}</p>
                                            <p className="text-slate-900 break-words [overflow-wrap:anywhere]">{personFullName(profile)}</p>
                                        </div>
                                    </div>
                                    
                                    {/* Ro'yxatdan o'tishda email kiritilmasa server vaqtinchalik ...@temp.phoenix.uz yaratadi — uni ko'rsatmaymiz */}
                                    {!isPlaceholderEmail(profile.email) && (
                                    <div className="flex items-center p-3 bg-slate-100/70 rounded-lg min-w-0">
                                        <Mail className="h-5 w-5 text-emerald-800 mr-3 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-sm text-slate-500">{t('Email')}</p>
                                            <p className="text-slate-900 break-words [overflow-wrap:anywhere]">{profile.email}</p>
                                        </div>
                                    </div>
                                    )}
                                    
                                    <div className="flex items-center p-3 bg-slate-100/70 rounded-lg min-w-0">
                                        <Phone className="h-5 w-5 text-purple-400 mr-3 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-sm text-slate-500">{t('Telefon')}</p>
                                            <p className="text-slate-900 break-words [overflow-wrap:anywhere]">{profile.phone}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center p-3 bg-slate-100/70 rounded-lg min-w-0">
                                        <Building className="h-5 w-5 text-yellow-800 mr-3 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-sm text-slate-500">{t('Tashkilot')}</p>
                                            <p className="text-slate-900 break-words [overflow-wrap:anywhere]">{profile.affiliation}</p>
                                        </div>
                                    </div>
                                    
                                    {profile.orcid_id && (
                                        <div className="flex items-center p-3 bg-slate-100/70 rounded-lg min-w-0">
                                            <Hash className="h-5 w-5 text-red-700 mr-3 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-sm text-slate-500">{t('ORCID iD')}</p>
                                                <a
                                                    href={orcidUrl(profile.orcid_id)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="editorial-link font-semibold break-all"
                                                >
                                                    {profile.orcid_id}
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {profile.telegram_username && (
                                        <div className="flex items-center p-3 bg-slate-100/70 rounded-lg min-w-0">
                                            <span className="text-lg mr-3 shrink-0">@</span>
                                            <div className="min-w-0">
                                                <p className="text-sm text-slate-500">{t('Telegram')}</p>
                                                <p className="text-slate-900 break-words [overflow-wrap:anywhere]">{profile.telegram_username}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="pt-4">
                                    <Button onClick={() => setIsEditing(true)}>
                                        <Edit className="mr-2 h-4 w-4" /> {t('Tahrirlash')}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Card>
            )}

            {activeTab === 'profile' && profile.gamification_profile && (
                <Card title={t('Gamifikatsiya')}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="text-center p-6 bg-slate-100/70 rounded-lg">
                            <div className="inline-flex items-center justify-center p-3 rounded-full bg-blue-500/20 mb-4">
                                <Award className="h-8 w-8 text-blue-800" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900">{profile.gamification_profile.level}</h3>
                            <p className="text-slate-500">{t('Daraja')}</p>
                        </div>
                        
                        <div className="text-center p-6 bg-slate-100/70 rounded-lg">
                            <div className="inline-flex items-center justify-center p-3 rounded-full bg-yellow-500/20 mb-4">
                                <Award className="h-8 w-8 text-yellow-800" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900">{profile.gamification_profile.points}</h3>
                            <p className="text-slate-500">{t('Ballar')}</p>
                        </div>
                        
                        <div className="text-center p-6 bg-slate-100/70 rounded-lg">
                            <div className="inline-flex items-center justify-center p-3 rounded-full bg-purple-500/20 mb-4">
                                <Award className="h-8 w-8 text-purple-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900">{profile.gamification_profile.badges.length}</h3>
                            <p className="text-slate-500">{t('Mukofotlar')}</p>
                        </div>
                    </div>
                    
                    {profile.gamification_profile.badges.length > 0 && (
                        <div className="mt-6">
                            <h4 className="text-md font-semibold text-slate-900 mb-3">{t('Mukofotlar')}</h4>
                            <div className="flex flex-wrap gap-2">
                                {profile.gamification_profile.badges.map((badge: string, index: number) => (
                                    <span key={index} className="px-3 py-1 bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-900 rounded-full text-sm">
                                        {t(badge)}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
};

export default Profile;