import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { UserPlus, ArrowRight, ArrowLeft } from 'lucide-react';
import { apiService } from '../services/apiService';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { getUserFriendlyError, formatDrfValidationErrors } from '../utils/errorHandler';
import { Eye, EyeOff } from 'lucide-react';

const RegisterSimple: React.FC = () => {
    const navigate = useNavigate();
    const { user, login } = useAuth();
    const [step, setStep] = useState(1); // 1: Asosiy ma'lumotlar, 2: Qo'shimcha ma'lumotlar
    
    // Asosiy maydonlar (majburiy)
    const [phone, setPhone] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    
    // Qo'shimcha maydonlar (ixtiyoriy)
    const [email, setEmail] = useState('');
    const [affiliation, setAffiliation] = useState('');
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
    
    // Redirect if user is already logged in
    useEffect(() => {
        if (user) {
            navigate('/dashboard');
        }
    }, [user, navigate]);

    // Telefon raqamni formatlash (faqat 9 ta raqam, +998 alohida ko'rsatiladi)
    const formatPhone = (value: string): string => {
        // Faqat raqamlarni qoldirish
        let digits = value.replace(/\D/g, '');
        
        // Agar "998" bilan boshlansa, uni olib tashlash (+998 alohida ko'rsatilgani uchun)
        if (digits.startsWith('998')) {
            digits = digits.substring(3); // "998" ni olib tashlash
        }
        
        // Faqat 9 ta raqamgacha qabul qilish (907863888 formatida)
        return digits.substring(0, 9);
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatPhone(e.target.value);
        setPhone(formatted);
    };

    const handleStep1Submit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        // Minimal validation (phone endi faqat 9 ta raqam bo'ladi, +998 alohida)
        if (!phone || phone.length !== 9) {
            setError('Iltimos, telefon raqamni to\'liq kiriting (9 ta raqam, masalan: 901234567)');
            return;
        }
        
        if (!firstName.trim()) {
            setError('Iltimos, ismingizni kiriting');
            return;
        }
        
        if (!lastName.trim()) {
            setError('Iltimos, familiyangizni kiriting');
            return;
        }
        
        if (!password || password.length < 6) {
            setError('Parol kamida 6 ta belgidan iborat bo\'lishi kerak');
            return;
        }
        
        if (password !== passwordConfirm) {
            setError('Parollar mos kelmayapti');
            return;
        }
        
        // Keyingi bosqichga o'tish
        setStep(2);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        
        try {
            const fullPhone = phone.startsWith('998') ? phone : `998${phone}`;

            const em = email.trim();
            if (em) {
                const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em);
                if (!ok) {
                    setError('Email noto‘g‘ri formatda.');
                    setIsLoading(false);
                    return;
                }
            }
            
            const userData: Record<string, string> = {
                phone: fullPhone,
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                affiliation: affiliation.trim() || 'N/A',
                password,
                password_confirm: passwordConfirm,
            };
            if (em) {
                userData.email = em.toLowerCase();
            }
            
            const response = await apiService.auth.register(userData);
            
            if (response.access && response.user) {
                toast.success('Muvaffaqiyatli ro\'yxatdan o\'tdingiz!', { autoClose: 2000 });
                
                try {
                    const loginResult = await login(fullPhone, password);
                    if (loginResult.ok) {
                        navigate('/dashboard');
                    } else {
                        toast.info('Hisob yaratildi. Iltimos, alohida kirish qiling.', { autoClose: 4000 });
                        navigate('/login');
                    }
                } catch {
                    navigate('/login');
                }
            } else {
                throw new Error('Ro\'yxatdan o\'tishda xatolik yuz berdi.');
            }
        } catch (err: unknown) {
            const apiErr = err as { response?: Record<string, unknown> };
            const formatted = apiErr?.response ? formatDrfValidationErrors(apiErr.response) : null;
            const errorMessage = formatted || getUserFriendlyError(err);
            
            setError(errorMessage);
            toast.error(errorMessage, { autoClose: 5000 });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthLayout title="Yangi Hisob Yaratish">
            <Card>
                {step === 1 ? (
                    <form onSubmit={handleStep1Submit} className="space-y-4">
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-bold text-slate-900 mb-2">Ro'yxatdan o'tish</h2>
                            <p className="text-sm text-slate-500">Asosiy ma'lumotlarni kiriting</p>
                        </div>
                        
                        {error && (
                            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded text-sm text-red-800">
                                {error}
                            </div>
                        )}
                        
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-2">
                                Telefon raqam *
                            </label>
                            <div className="flex items-center gap-2">
                                <span className="px-3 py-3 bg-slate-100/90 border border-slate-200 rounded-lg text-slate-600 font-medium whitespace-nowrap">+998</span>
                                <input 
                                    type="tel"
                                    value={phone}
                                    onChange={handlePhoneChange}
                                    className="flex-1 p-3 bg-white/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                                    placeholder="90 123 45 67"
                                    required
                                    autoComplete="tel"
                                    inputMode="numeric"
                                    maxLength={9}
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Faqat raqam kiriting (masalan: 901234567)</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-2">Ism *</label>
                                <input 
                                    type="text" 
                                    required 
                                    className="w-full p-3 bg-white/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    placeholder="Ismingiz"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-2">Familiya *</label>
                                <input 
                                    type="text" 
                                    required 
                                    className="w-full p-3 bg-white/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    placeholder="Familiyangiz"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-2">Parol *</label>
                            <div className="relative">
                                <input 
                                    type={showPassword ? "text" : "password"}
                                    required 
                                    autoComplete="new-password"
                                    className="w-full p-3 bg-white/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500 pr-10"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Kamida 6 ta belgi"
                                    minLength={6}
                                />
                            <button
                                type="button"
                                aria-label={showPassword ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-900 p-1"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Kamida 6 ta belgi (har qanday belgilar)</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-2">Parolni tasdiqlang *</label>
                            <div className="relative">
                                <input 
                                    type={showPasswordConfirm ? "text" : "password"}
                                    required 
                                    autoComplete="new-password"
                                    className="w-full p-3 pr-10 bg-white/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                                    value={passwordConfirm}
                                    onChange={(e) => setPasswordConfirm(e.target.value)}
                                    placeholder="Parolni qayta kiriting"
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    aria-label={showPasswordConfirm ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}
                                    onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-900 p-1"
                                >
                                    {showPasswordConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        <Button 
                            type="submit" 
                            className="w-full flex items-center justify-center gap-2"
                        >
                            Keyingi bosqich
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </form>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="text-center mb-6">
                            <button
                                type="button"
                                onClick={() => { setStep(1); setError(''); }}
                                className="text-slate-500 hover:text-slate-900 mb-4 flex items-center gap-2 mx-auto"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Orqaga
                            </button>
                            <h2 className="text-2xl font-bold text-slate-900 mb-2">Qo'shimcha ma'lumotlar</h2>
                            <p className="text-sm text-slate-500">Bu maydonlar ixtiyoriy</p>
                        </div>
                        
                        {error && (
                            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded text-sm text-red-800">
                                {error}
                            </div>
                        )}
                        
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-2">
                                Email <span className="text-slate-500 text-xs">(ixtiyoriy)</span>
                            </label>
                                <input 
                                    type="email" 
                                    autoComplete="email"
                                    className="w-full p-3 bg-white/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="email@example.com"
                                />
                            <p className="text-xs text-slate-500 mt-1">Bo'sh qoldirish mumkin</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-2">
                                Ish yoki o'qish joyi <span className="text-slate-500 text-xs">(ixtiyoriy)</span>
                            </label>
                            <input 
                                type="text" 
                                className="w-full p-3 bg-white/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                                value={affiliation}
                                onChange={(e) => setAffiliation(e.target.value)}
                                placeholder="Tashkilot nomi..."
                            />
                            <p className="text-xs text-slate-500 mt-1">Bo'sh qoldirish mumkin</p>
                        </div>

                        <Button 
                            type="submit" 
                            className="w-full flex items-center justify-center gap-2"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    Ro'yxatdan o'tilmoqda...
                                </>
                            ) : (
                                <>
                                    <UserPlus className="h-4 w-4" />
                                    Ro'yxatdan o'tish
                                </>
                            )}
                        </Button>
                    </form>
                )}
                
                <div className="mt-6 text-center text-sm">
                    <p className="text-slate-500">
                        Hisobingiz bormi?{' '}
                        <Link to="/login" className="font-semibold text-blue-800 hover:text-blue-700">
                            Kirish
                        </Link>
                    </p>
                </div>
            </Card>
        </AuthLayout>
    );
};

export default RegisterSimple;
