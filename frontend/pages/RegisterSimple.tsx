import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { UserPlus, ArrowLeft, Send, ShieldCheck } from 'lucide-react';
import { apiService } from '../services/apiService';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { getUserFriendlyError, formatDrfValidationErrors } from '../utils/errorHandler';
import { Eye, EyeOff } from 'lucide-react';
import { LEGAL_VERSION } from '../config/legal';
import { useT } from '../i18n/LanguageContext';

/**
 * Ro'yxatdan o'tish: 1) telefon, ism, familiya, parol → Telegram bot havolasi (avto /start);
 * 2) botda raqam ulashiladi → bot 4 xonali kod yuboradi → shu yerda kod kiritiladi → hisob yaratiladi va kiriladi.
 */
const RegisterSimple: React.FC = () => {
    const { t } = useT();
    const navigate = useNavigate();
    const { user, login } = useAuth();
    const [step, setStep] = useState(1); // 1: ma'lumotlar, 2: Telegram kodi

    const [phone, setPhone] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');

    const [deepLink, setDeepLink] = useState('');
    const [token, setToken] = useState('');
    const [code, setCode] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(false);

    // Redirect if user is already logged in
    useEffect(() => {
        if (user) {
            navigate('/');
        }
    }, [user, navigate]);

    // Telefon raqamni formatlash (faqat 9 ta raqam, +998 alohida ko'rsatiladi)
    const formatPhone = (value: string): string => {
        let digits = value.replace(/\D/g, '');
        if (digits.startsWith('998')) {
            digits = digits.substring(3);
        }
        return digits.substring(0, 9);
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPhone(formatPhone(e.target.value));
    };

    const fullPhone = phone.startsWith('998') ? phone : `998${phone}`;

    const showError = (err: unknown) => {
        const apiErr = err as { response?: Record<string, unknown> };
        const formatted = apiErr?.response ? formatDrfValidationErrors(apiErr.response) : null;
        const errorMessage = formatted || getUserFriendlyError(err);
        setError(errorMessage);
        toast.error(errorMessage, { autoClose: 5000 });
    };

    const handleStart = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!phone || phone.length !== 9) {
            setError(t("Iltimos, telefon raqamni to'liq kiriting (9 ta raqam, masalan: 901234567)"));
            return;
        }
        if (!firstName.trim()) {
            setError(t('Iltimos, ismingizni kiriting'));
            return;
        }
        if (!lastName.trim()) {
            setError(t('Iltimos, familiyangizni kiriting'));
            return;
        }
        if (!password || password.length < 6) {
            setError(t("Parol kamida 6 ta belgidan iborat bo'lishi kerak"));
            return;
        }
        if (password !== passwordConfirm) {
            setError(t('Parollar mos kelmayapti'));
            return;
        }
        if (!termsAccepted) {
            setError(t("Ro'yxatdan o'tish uchun ommaviy oferta va maxfiylik siyosatiga rozilik bering."));
            return;
        }

        // Oyna bosish paytida ochiladi — aks holda brauzer so'rovdan keyingi window.open ni bloklaydi
        const tgWindow = window.open('', '_blank');
        setIsLoading(true);
        try {
            const res = await apiService.auth.registerStart({
                phone: fullPhone,
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                password,
                password_confirm: passwordConfirm,
                terms_accepted: true,
                terms_version: LEGAL_VERSION,
            });
            setDeepLink(res.deep_link);
            setToken(res.token);
            setCode('');
            setStep(2);
            if (tgWindow) {
                tgWindow.location.href = res.deep_link;
            }
        } catch (err: unknown) {
            tgWindow?.close();
            showError(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirm = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!/^\d{4}$/.test(code)) {
            setError(t('Botdan kelgan 4 xonali kodni kiriting'));
            return;
        }
        setIsLoading(true);
        try {
            await apiService.auth.registerConfirm(token, code);
            toast.success(t("Muvaffaqiyatli ro'yxatdan o'tdingiz!"), { autoClose: 2000 });
            try {
                const loginResult = await login(fullPhone, password);
                if (loginResult.ok) {
                    navigate('/');
                } else {
                    toast.info(t('Hisob yaratildi. Iltimos, alohida kirish qiling.'), { autoClose: 4000 });
                    navigate('/login');
                }
            } catch {
                navigate('/login');
            }
        } catch (err: unknown) {
            showError(err);
        } finally {
            setIsLoading(false);
        }
    };

    const inputCls = 'w-full p-3 bg-white/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500';

    return (
        <AuthLayout title={t('Yangi Hisob Yaratish')}>
            <Card>
                {step === 1 ? (
                    <form onSubmit={handleStart} className="space-y-4">
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-bold text-slate-900 mb-2">{t("Ro'yxatdan o'tish")}</h2>
                            <p className="text-sm text-slate-500">{t("Asosiy ma'lumotlarni kiriting")}</p>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded text-sm text-red-800">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-2">
                                {t('Telefon raqam *')}
                            </label>
                            <div className="flex items-center gap-2">
                                <span className="px-3 py-3 bg-slate-100/90 border border-slate-200 rounded-lg text-slate-600 font-medium whitespace-nowrap">+998</span>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={handlePhoneChange}
                                    className="flex-1 min-w-0 p-3 bg-white/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                                    placeholder="90 123 45 67"
                                    required
                                    autoComplete="tel"
                                    inputMode="numeric"
                                    maxLength={9}
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-1">{t('Faqat raqam kiriting (masalan: 901234567)')}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-2">{t('Ism *')}</label>
                                <input
                                    type="text"
                                    required
                                    className={inputCls}
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    placeholder={t('Ismingiz')}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-2">{t('Familiya *')}</label>
                                <input
                                    type="text"
                                    required
                                    className={inputCls}
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    placeholder={t('Familiyangiz')}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-2">{t('Parol *')}</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    autoComplete="new-password"
                                    className={`${inputCls} pr-10`}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder={t('Kamida 6 ta belgi')}
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    aria-label={showPassword ? t('Parolni yashirish') : t('Parolni ko‘rsatish')}
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-900 p-1"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">{t('Kamida 6 ta belgi (har qanday belgilar)')}</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-2">{t('Parolni tasdiqlang *')}</label>
                            <div className="relative">
                                <input
                                    type={showPasswordConfirm ? "text" : "password"}
                                    required
                                    autoComplete="new-password"
                                    className={`${inputCls} pr-10`}
                                    value={passwordConfirm}
                                    onChange={(e) => setPasswordConfirm(e.target.value)}
                                    placeholder={t('Parolni qayta kiriting')}
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    aria-label={showPasswordConfirm ? t('Parolni yashirish') : t('Parolni ko‘rsatish')}
                                    onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-900 p-1"
                                >
                                    {showPasswordConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white/50 p-3 text-sm text-slate-700 cursor-pointer">
                            <input
                                type="checkbox"
                                className="mt-0.5 h-5 w-5 shrink-0 accent-blue-700"
                                checked={termsAccepted}
                                onChange={(e) => setTermsAccepted(e.target.checked)}
                                required
                            />
                            <span>
                                <a href="/#/oferta" target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-800 underline">{t('Ommaviy oferta')}</a>
                                {' '}{t('va')}{' '}
                                <a href="/#/maxfiylik" target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-800 underline">{t('maxfiylik siyosati')}</a>
                                {' '}{t("bilan tanishdim, shaxsga doir ma'lumotlarimni qayta ishlashga roziman.")}
                            </span>
                        </label>

                        <Button
                            type="submit"
                            className="w-full flex items-center justify-center gap-2"
                            disabled={isLoading || !termsAccepted}
                        >
                            {isLoading ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                            {t('Telegram orqali kod olish')}
                        </Button>
                    </form>
                ) : (
                    <form onSubmit={handleConfirm} className="space-y-4">
                        <div className="text-center mb-6">
                            <button
                                type="button"
                                onClick={() => { setStep(1); setError(''); }}
                                className="text-slate-500 hover:text-slate-900 mb-4 flex items-center gap-2 mx-auto"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                {t('Orqaga')}
                            </button>
                            <ShieldCheck className="h-10 w-10 text-blue-700 mx-auto mb-2" />
                            <h2 className="text-2xl font-bold text-slate-900 mb-2">{t('Tasdiqlash kodi')}</h2>
                            <p className="text-sm text-slate-500">
                                {t("Telegram botda «📱 Raqamni ulashish» tugmasini bosing — bot sizga 4 xonali kod yuboradi.")}
                            </p>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded text-sm text-red-800">
                                {error}
                            </div>
                        )}

                        <a
                            href={deepLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full flex items-center justify-center gap-2 rounded-lg border border-sky-300 bg-sky-50 p-3 font-semibold text-sky-800 hover:bg-sky-100"
                        >
                            <Send className="h-4 w-4" />
                            {t('Telegram botni ochish')}
                        </a>

                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-2">{t('Botdan kelgan kod')}</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                maxLength={4}
                                autoFocus
                                className={`${inputCls} text-center text-2xl tracking-[0.6em] font-bold`}
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                placeholder="••••"
                                required
                            />
                        </div>

                        <Button
                            type="submit"
                            className="w-full flex items-center justify-center gap-2"
                            disabled={isLoading || code.length !== 4}
                        >
                            {isLoading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    {t("Ro'yxatdan o'tilmoqda...")}
                                </>
                            ) : (
                                <>
                                    <UserPlus className="h-4 w-4" />
                                    {t('Tasdiqlash')}
                                </>
                            )}
                        </Button>
                    </form>
                )}

                <div className="mt-6 text-center text-sm">
                    <p className="text-slate-500">
                        {t('Hisobingiz bormi?')}{' '}
                        <Link to="/login" className="font-semibold text-blue-800 hover:text-blue-700">
                            {t('Kirish')}
                        </Link>
                    </p>
                </div>
            </Card>
        </AuthLayout>
    );
};

export default RegisterSimple;
