import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AuthLayout from '../components/AuthLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import { getUserFriendlyError } from '../utils/errorHandler';

const LoginSimple: React.FC = () => {
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const { login, user } = useAuth();
    const navigate = useNavigate();

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        
        try {
            if (!phone || phone.length !== 9) {
                setError('Iltimos, telefon raqamni to\'liq kiriting (9 ta raqam, masalan: 901234567)');
                return;
            }
            
            const fullPhone = `998${phone}`;
            
            if (!password || password.trim().length === 0) {
                setError('Iltimos, parolni kiriting.');
                return;
            }
            
            const result = await login(fullPhone, password);
            
            if (!result.ok) {
                setError(result.message || 'Kirish amalga oshmadi. Ma\'lumotlarni tekshiring.');
            }
        } catch (err: unknown) {
            setError(getUserFriendlyError(err));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthLayout title="Tizimga kirish">
            <Card>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Tizimga kirish</h2>
                        <p className="text-sm text-slate-500">Telefon raqam va parol bilan kirish</p>
                    </div>
                    
                    {error && (
                        <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-sm text-red-800">
                            {error}
                        </div>
                    )}
                    
                    <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-slate-600 mb-2">
                            Telefon raqam
                        </label>
                        <div className="flex items-center gap-2">
                            <span className="px-3 py-3 bg-slate-100/90 border border-slate-200 rounded-lg text-slate-600 font-medium whitespace-nowrap">+998</span>
                            <input
                                type="tel"
                                name="phone"
                                id="phone"
                                value={phone}
                                onChange={handlePhoneChange}
                                className="flex-1 p-3 bg-white/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                                placeholder="90 123 45 67"
                                required
                                autoComplete="tel"
                                inputMode="numeric"
                                maxLength={9}
                                aria-invalid={!!error}
                                aria-describedby="phone-hint"
                            />
                        </div>
                        <p id="phone-hint" className="text-xs text-slate-500 mt-1">9 ta raqam (masalan 901234567)</p>
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-slate-600 mb-2">
                            Parol
                        </label>
                        <div className="relative">
                            <input
                                id="password"
                                name="password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="current-password"
                                required
                                className="w-full p-3 pr-10 bg-white/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                                placeholder="Parolingizni kiriting"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-900"
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <Link 
                            to="/forgot-password" 
                            className="text-sm text-blue-800 hover:text-blue-700"
                        >
                            Parolni unutdingizmi?
                        </Link>
                    </div>

                    <Button 
                        type="submit" 
                        className="w-full flex items-center justify-center gap-2"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Kirish amalga oshirilmoqda...
                            </>
                        ) : (
                            <>
                                <LogIn size={18} />
                                Tizimga kirish
                            </>
                        )}
                    </Button>
                </form>

                <div className="mt-6 text-center text-sm">
                    <p className="text-slate-500">
                        Hisobingiz yo'qmi?{' '}
                        <Link to="/register" className="font-semibold text-blue-800 hover:text-blue-700">
                            Ro'yxatdan o'tish
                        </Link>
                    </p>
                </div>
            </Card>
        </AuthLayout>
    );
};

export default LoginSimple;
