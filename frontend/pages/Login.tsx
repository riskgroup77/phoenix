import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { MOCK_USERS } from '../data/mockData';
import AuthLayout from '../components/AuthLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LogIn } from 'lucide-react';
import { Role } from '../types';
import { getUserFriendlyError } from '../utils/errorHandler';

const COUNTRIES = [
    { code: '+998', label: 'UZ' },
    { code: '+7', label: 'RU' },
    { code: '+1', label: 'US' },
    { code: '+44', label: 'UK' },
    { code: '+49', label: 'DE' },
];

const Login: React.FC = () => {
    const [countryCode, setCountryCode] = useState('+998');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const { login, user } = useAuth();
    const navigate = useNavigate();

    // Redirect if user is already logged in
    useEffect(() => {
        if (user) {
            navigate('/dashboard');
        }
    }, [user, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        
        try {
            // Remove + sign from country code and combine with phone
            const cleanCountryCode = countryCode.replace(/^\+/, '');
            const fullPhone = `${cleanCountryCode}${phone}`.replace(/\s/g, '').replace(/\D/g, '');
            
            if (!fullPhone || fullPhone.length < 9) {
                setError('Iltimos, to\'g\'ri telefon raqamni kiriting.');
                setIsLoading(false);
                return;
            }
            
            if (!password || password.trim().length === 0) {
                setError('Iltimos, parolni kiriting.');
                setIsLoading(false);
                return;
            }
            
            console.log('Attempting login with phone:', fullPhone);
            const result = await login(fullPhone, password);
            
            if (!result.ok) {
                setError(result.message || 'Kirish amalga oshmadi.');
            }
        } catch (err: any) {
            // Use centralized error handler
            const errorMessage = getUserFriendlyError(err);
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAutofill = (user: (typeof MOCK_USERS)[0]) => {
        try {
            const userPhone = user.phone.replace(/\s/g, '');
            let matchedCountry = COUNTRIES.find(c => userPhone.startsWith(c.code)) || COUNTRIES[0];
            setCountryCode(matchedCountry.code);
            setPhone(userPhone.substring(matchedCountry.code.length));
            setPassword(user.password || '');
            setError('');
        } catch (error) {
            console.error('Autofill error:', error);
            setError('Avtomatik to\'ldirishda xatolik yuz berdi');
        }
    };
    
    const roleNames: Record<Role, string> = {
        [Role.Author]: 'Muallif',
        [Role.Reviewer]: 'Taqrizchi',
        [Role.JournalAdmin]: 'Jurnal administratori',
        [Role.SuperAdmin]: 'Bosh administrator',
        [Role.Accountant]: 'Moliyachi',
        [Role.Operator]: 'Operator',
    };

    return (
        <AuthLayout title="Tizimga kirish">
            <Card>
                <form onSubmit={handleSubmit} className="space-y-6">
                     <h2 className="text-2xl font-bold text-center text-slate-900">Tizimga kirish</h2>
                    <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-slate-600 mb-2">
                            Telefon raqam
                        </label>
                        <div className="flex items-center phone-input-group">
                            <select
                                value={countryCode}
                                onChange={(e) => setCountryCode(e.target.value)}
                                className="shrink-0"
                                aria-label="Country code"
                            >
                                {COUNTRIES.map(c => (
                                    <option key={c.code} value={c.code}>{`${c.label} (${c.code})`}</option>
                                ))}
                            </select>
                            <input
                                type="tel"
                                name="phone"
                                id="phone"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                                className="w-full"
                                placeholder="90 123 45 67"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-slate-600 mb-2">
                            Parol
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                            required
                            className="w-full"
                            placeholder="••••••••"
                        />
                    </div>
                    
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mt-4">
                            {error}
                        </div>
                    )}

                    <div>
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
                    </div>
                </form>

                 <div className="mt-6 text-center text-sm">
                    <p className="text-slate-500">
                        Hisobingiz yo'qmi?{' '}
                        <Link to="/register" className="font-semibold text-blue-800 hover:text-blue-700">
                            Ro'yxatdan o'tish
                        </Link>
                    </p>
                </div>
                
                <div className="mt-6 pt-6 border-t border-slate-200/90">
                     <p className="text-sm text-slate-500 mb-4 text-center">Test uchun istalgan foydalanuvchi ustiga bosing:</p>
                    <div className="overflow-x-auto rounded-lg border border-slate-200/90">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100/70">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Rol</th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Parol</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/80">
                                {MOCK_USERS.map(user => (
                                    <tr key={user.id} onClick={() => handleAutofill(user)} className="cursor-pointer hover:bg-slate-100/70 transition-colors">
                                        <td className="px-4 py-2 text-slate-700">{roleNames[user.role]}</td>
                                        <td className="px-4 py-2 text-slate-700 font-mono">{user.password}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </Card>
        </AuthLayout>
    );
};

export default Login;
