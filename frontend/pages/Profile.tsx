import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, useNotifications } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { User, Mail, Phone, Building, Award, Hash, Edit, CreditCard, Archive, Bell, Settings } from 'lucide-react';
import { apiService } from '../services/apiService';
import { paymentService } from '../services/paymentService';
import { showPaymentTestTools } from '../config/env';
import { toast } from 'react-toastify';
import { txAmount } from '../utils/amount';
import { asApiList } from '../utils/apiList';
import type { Notification } from '../types';

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
};

const STATUS_LABELS: Record<string, string> = {
    completed: 'Muvaffaqiyatli',
    pending: 'Kutilmoqda',
    failed: 'Muvaffaqiyatsiz',
    cancelled: 'Bekor qilingan',
};

const Profile: React.FC = () => {
    const { user, logout } = useAuth();
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
    const { theme, setTheme } = useTheme();
    const navigate = useNavigate();
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
                    email: userData.email,
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const updatedProfile = await apiService.auth.updateProfile(formData);
            const userData = updatedProfile.data || updatedProfile;
            setProfile(userData);
            setIsEditing(false);
            toast.success('Profil muvaffaqiyatli yangilandi');
        } catch (err: any) {
            console.error('Failed to update profile:', err);
            setError('Profilni yangilashda xatolik yuz berdi.');
            toast.error('Profilni yangilashda xatolik yuz berdi');
        }
    };

    const handleTestPayment = async () => {
        if (processingPayment) return;

        setProcessingPayment(true);
        setError(null);
        
        try {
            toast.info('To\'lov tayyorlanmoqda...', { autoClose: 2000 });
            
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
                toast.success('To\'lov sahifasiga yo\'naltirilmoqdasiz. QR kodni skanerlang yoki tugmani bosing.', { autoClose: 2000 });
                paymentService.redirectToPaymentPage(result.transaction_id);
            } else if (result && result.success === true && (result.payment_url || result.transaction_id)) {
                toast.success('To\'lov sahifasiga yo\'naltirilmoqdasiz. QR kodni skanerlang.', { autoClose: 2000 });
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
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <Card title="Error">
                <p className="text-red-700">{error}</p>
                <Button onClick={() => window.location.reload()} className="mt-4">Retry</Button>
            </Card>
        );
    }

    if (!profile) {
        return <Card title="Xatolik"><p>Profil ma'lumotlari topilmadi.</p></Card>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
                {PROFILE_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setTab(tab.id)}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                isActive
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                        >
                            <Icon className="h-4 w-4" />
                            {tab.label}
                            {tab.id === 'notifications' && unreadCount > 0 && (
                                <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {activeTab === 'payments' && (
                <Card title="To'lovlar tarixi">
                    {loadingPayments ? (
                        <div className="flex justify-center py-10">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
                        </div>
                    ) : sortedTransactions.length === 0 ? (
                        <p className="text-slate-500 text-sm py-6 text-center">
                            Hozircha to&apos;lovlar tarixi yo&apos;q.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200">
                                        <th className="pb-2 font-medium text-slate-500">Xizmat</th>
                                        <th className="pb-2 font-medium text-slate-500">Summa</th>
                                        <th className="pb-2 font-medium text-slate-500">Holat</th>
                                        <th className="pb-2 font-medium text-slate-500 hidden sm:table-cell">Sana</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedTransactions.map((tx) => (
                                        <tr key={tx.id} className="border-b border-slate-100">
                                            <td className="py-3 pr-3 text-slate-900">
                                                {SERVICE_LABELS[tx.service_type] || tx.service_type || '—'}
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
                                                    {STATUS_LABELS[tx.status] || tx.status}
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
                <Card title="Bildirishnomalar">
                    <div className="flex justify-between items-center mb-4">
                        <p className="text-sm text-slate-500">
                            {unreadCount > 0 ? `${unreadCount} ta o'qilmagan` : 'Barcha bildirishnomalar o\'qilgan'}
                        </p>
                        {notifications.length > 0 && (
                            <Button type="button" variant="secondary" onClick={() => markAllAsRead()}>
                                Hammasini o&apos;qilgan deb belgilash
                            </Button>
                        )}
                    </div>
                    {notifications.length === 0 ? (
                        <p className="text-slate-500 text-sm py-8 text-center">Yangi bildirishnomalar yo&apos;q.</p>
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
                                            Yangi
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
                    {profile.role === 'author' && (
                        <Card title="Arxiv hujjatlar">
                            <p className="text-slate-500 text-sm mb-3">
                                Nashr sertifikatlari, UDK, taqriz natijalari, DOI va antiplagiat tekshiruvlari.
                            </p>
                            <Button variant="secondary" onClick={() => navigate('/arxiv')}>
                                <Archive className="mr-2 h-4 w-4" /> Arxiv hujjatlar sahifasiga o&apos;tish
                            </Button>
                        </Card>
                    )}
                    <Card title="Ko&apos;rinish">
                        <p className="text-sm text-slate-500 mb-3">Interfeys mavzusini tanlang.</p>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant={theme === 'light' ? 'primary' : 'secondary'}
                                onClick={() => setTheme('light')}
                            >
                                Yorug&apos;
                            </Button>
                            <Button
                                type="button"
                                variant={theme === 'dark' ? 'primary' : 'secondary'}
                                onClick={() => setTheme('dark')}
                            >
                                Qorong&apos;u
                            </Button>
                        </div>
                    </Card>
                    <Card title="Hisobni boshqarish">
                        <div className="space-y-4">
                            {showPaymentTestTools && (
                                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                                    <h3 className="text-sm font-medium text-blue-900 mb-2">Test To&apos;lov (faqat dev)</h3>
                                    <p className="text-xs text-slate-500 mb-3">
                                        Click to&apos;lov tizimini sinab ko&apos;rish uchun 1000 so&apos;m miqdorida test to&apos;lovini amalga oshirish mumkin.
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
                                        {processingPayment ? 'Jarayonda...' : '1000 so\'m test to\'lov'}
                                    </Button>
                                </div>
                            )}
                            <div className="flex flex-col sm:flex-row gap-4 pt-2 border-t border-slate-200/90">
                                <Button variant="danger" onClick={logout}>
                                    Chiqish
                                </Button>
                            </div>
                        </div>
                    </Card>
                </>
            )}

            {activeTab === 'profile' && (
            <Card title="Profilim">
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
                            <button className="absolute bottom-2 right-2 p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors">
                                <Edit className="h-4 w-4 text-slate-900" />
                            </button>
                        </div>
                        <div className="mt-4 text-center">
                            <h2 className="text-xl font-bold text-slate-900">
                                {profile.first_name} {profile.last_name} {profile.patronymic}
                            </h2>
                            <p className="text-slate-500">{roleNames[profile.role] || profile.role}</p>
                        </div>
                    </div>
                    
                    <div className="flex-1">
                        {isEditing ? (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-2">Ism</label>
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
                                        <label className="block text-sm font-medium text-slate-600 mb-2">Familiya</label>
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
                                        <label className="block text-sm font-medium text-slate-600 mb-2">Otasining ismi</label>
                                        <input
                                            type="text"
                                            name="patronymic"
                                            value={formData.patronymic}
                                            onChange={handleInputChange}
                                            className="w-full"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-2">Telefon</label>
                                        <div className="flex">
                                            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-slate-200/90 bg-slate-100/70 text-slate-600">
                                                +998
                                            </span>
                                            <input
                                                type="tel"
                                                name="phone"
                                                value={formData.phone?.replace('+998', '')}
                                                onChange={handleInputChange}
                                                className="flex-1 min-w-0 block w-full rounded-none rounded-r-md"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-600 mb-2">Email</label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleInputChange}
                                            className="w-full"
                                            required
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-600 mb-2">Ish yoki o'qish joyi</label>
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
                                        <label className="block text-sm font-medium text-slate-600 mb-2">ORCID ID</label>
                                        <input
                                            type="text"
                                            name="orcid_id"
                                            value={formData.orcid_id}
                                            onChange={handleInputChange}
                                            className="w-full"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-2">Telegram</label>
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
                                    <Button type="submit">Saqlash</Button>
                                    <Button 
                                        type="button" 
                                        variant="secondary" 
                                        onClick={() => setIsEditing(false)}
                                    >
                                        Bekor qilish
                                    </Button>
                                </div>
                            </form>
                        ) : (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex items-center p-3 bg-slate-100/70 rounded-lg">
                                        <User className="h-5 w-5 text-blue-800 mr-3" />
                                        <div>
                                            <p className="text-sm text-slate-500">To'liq ism</p>
                                            <p className="text-slate-900">{profile.first_name} {profile.last_name} {profile.patronymic}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center p-3 bg-slate-100/70 rounded-lg">
                                        <Mail className="h-5 w-5 text-emerald-800 mr-3" />
                                        <div>
                                            <p className="text-sm text-slate-500">Email</p>
                                            <p className="text-slate-900">{profile.email}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center p-3 bg-slate-100/70 rounded-lg">
                                        <Phone className="h-5 w-5 text-purple-400 mr-3" />
                                        <div>
                                            <p className="text-sm text-slate-500">Telefon</p>
                                            <p className="text-slate-900">{profile.phone}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center p-3 bg-slate-100/70 rounded-lg">
                                        <Building className="h-5 w-5 text-yellow-800 mr-3" />
                                        <div>
                                            <p className="text-sm text-slate-500">Tashkilot</p>
                                            <p className="text-slate-900">{profile.affiliation}</p>
                                        </div>
                                    </div>
                                    
                                    {profile.orcid_id && (
                                        <div className="flex items-center p-3 bg-slate-100/70 rounded-lg">
                                            <Hash className="h-5 w-5 text-red-700 mr-3" />
                                            <div>
                                                <p className="text-sm text-slate-500">ORCID ID</p>
                                                <p className="text-slate-900">{profile.orcid_id}</p>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {profile.telegram_username && (
                                        <div className="flex items-center p-3 bg-slate-100/70 rounded-lg">
                                            <span className="text-lg mr-3">@</span>
                                            <div>
                                                <p className="text-sm text-slate-500">Telegram</p>
                                                <p className="text-slate-900">{profile.telegram_username}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="pt-4">
                                    <Button onClick={() => setIsEditing(true)}>
                                        <Edit className="mr-2 h-4 w-4" /> Tahrirlash
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Card>
            )}

            {activeTab === 'profile' && profile.gamification_profile && (
                <Card title="Gamifikatsiya">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="text-center p-6 bg-slate-100/70 rounded-lg">
                            <div className="inline-flex items-center justify-center p-3 rounded-full bg-blue-500/20 mb-4">
                                <Award className="h-8 w-8 text-blue-800" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900">{profile.gamification_profile.level}</h3>
                            <p className="text-slate-500">Daraja</p>
                        </div>
                        
                        <div className="text-center p-6 bg-slate-100/70 rounded-lg">
                            <div className="inline-flex items-center justify-center p-3 rounded-full bg-yellow-500/20 mb-4">
                                <Award className="h-8 w-8 text-yellow-800" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900">{profile.gamification_profile.points}</h3>
                            <p className="text-slate-500">Ballar</p>
                        </div>
                        
                        <div className="text-center p-6 bg-slate-100/70 rounded-lg">
                            <div className="inline-flex items-center justify-center p-3 rounded-full bg-purple-500/20 mb-4">
                                <Award className="h-8 w-8 text-purple-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900">{profile.gamification_profile.badges.length}</h3>
                            <p className="text-slate-500">Mukofotlar</p>
                        </div>
                    </div>
                    
                    {profile.gamification_profile.badges.length > 0 && (
                        <div className="mt-6">
                            <h4 className="text-md font-semibold text-slate-900 mb-3">Mukofotlar</h4>
                            <div className="flex flex-wrap gap-2">
                                {profile.gamification_profile.badges.map((badge: string, index: number) => (
                                    <span key={index} className="px-3 py-1 bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-900 rounded-full text-sm">
                                        {badge}
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