import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Download, Filter, Search, Loader2 } from 'lucide-react';
import { apiService } from '../services/apiService';
import { txAmount } from '../utils/amount';

const Financials: React.FC = () => {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState<any[]>([]);
    const [filteredTransactions, setFilteredTransactions] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [serviceType, setServiceType] = useState('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [users, setUsers] = useState<any[]>([]);

    useEffect(() => {
        const fetchTransactions = async () => {
            if (!user) return;
            
            try {
                setLoading(true);
                setError(null);
                
                // Fetch both transactions and users data
                const [transactionsData, usersData] = await Promise.all([
                    apiService.payments.listTransactions(),
                    apiService.users.list()
                ]);
                
                // Ensure we're working with arrays
                const transactionsArray = Array.isArray(transactionsData) 
                    ? transactionsData 
                    : (transactionsData?.data && Array.isArray(transactionsData.data) 
                        ? transactionsData.data 
                        : (transactionsData?.results && Array.isArray(transactionsData.results) 
                            ? transactionsData.results 
                            : []));
                
                const usersArray = Array.isArray(usersData) 
                    ? usersData 
                    : (usersData?.data && Array.isArray(usersData.data) 
                        ? usersData.data 
                        : (usersData?.results && Array.isArray(usersData.results) 
                            ? usersData.results 
                            : []));
                
                setTransactions(transactionsArray);
                setFilteredTransactions(transactionsArray);
                setUsers(usersArray);
            } catch (err: any) {
                console.error('Failed to fetch data:', err);
                setError('Tranzaksiyalarni yuklashda xatolik yuz berdi: ' + (err.message || 'Noma\'lum xatolik'));
            } finally {
                setLoading(false);
            }
        };

        fetchTransactions();
    }, [user]);

    useEffect(() => {
        let result = transactions;
        
        // Filter by search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(t => {
                // Check user name
                const user = users.find(u => u.id === t.user);
                const userName = user ? `${user.first_name} ${user.last_name}`.toLowerCase() : '';
                
                return userName.includes(query) ||
                    t.service_type?.toLowerCase().includes(query) ||
                    (t.article && t.article.toString().includes(query)) ||
                    (t.translation_request && t.translation_request.toString().includes(query));
            });
        }
        
        // Filter by date range
        if (dateRange.start && dateRange.end) {
            result = result.filter(t => {
                const transactionDate = new Date(t.created_at);
                return transactionDate >= new Date(dateRange.start) && 
                       transactionDate <= new Date(dateRange.end);
            });
        }
        
        // Filter by service type
        if (serviceType !== 'all') {
            result = result.filter(t => t.service_type === serviceType);
        }
        
        setFilteredTransactions(result);
    }, [searchQuery, dateRange, serviceType, transactions, users]);

    const serviceTypeNames: Record<string, string> = {
        'fast-track': 'Tezkor ko\'rib chiqish',
        'publication_fee': 'Nashr haqi',
        'language_editing': 'Tilni tahrirlash',
        'top_up': 'Hisobni to\'ldirish',
        'book_publication': 'Kitob nashri',
        'translation': 'Tarjima',
    };

    const statusColors: Record<string, string> = {
        'pending': 'bg-yellow-500/20 text-yellow-900',
        'completed': 'bg-green-500/20 text-emerald-900',
        'failed': 'bg-red-500/20 text-red-800',
        'cancelled': 'bg-gray-500/20 text-slate-600',
    };

    const handleExport = () => {
        // Create CSV content
        const headers = ['Foydalanuvchi', 'Xizmat', 'Miqdor', 'Valyuta', 'Sana', 'Holat'];
        const csvContent = [
            headers.join(','),
            ...filteredTransactions.map(t => {
                const user = users.find(u => u.id === t.user);
                const userName = user ? `${user.first_name} ${user.last_name}` : 'Noma\'lum foydalanuvchi';
                const service = serviceTypeNames[t.service_type] || t.service_type || 'Noma\'lum';
                const amount = `${txAmount(t.amount) >= 0 ? '+' : ''}${txAmount(t.amount)}`;
                const date = new Date(t.created_at).toLocaleDateString();
                return `"${userName}","${service}","${amount}","${t.currency}","${date}","${t.status}"`;
            })
        ].join('\n');

        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `tranzaksiyalar_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!user) {
        return <Card title="Ruxsat kerak"><p>Ushbu sahifani ko'rish uchun tizimga kirishingiz kerak.</p></Card>;
    }

    if (loading) {
        return (
            <Card title="Moliyaviy tranzaksiyalar">
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    <span className="ml-3">Ma'lumotlar yuklanmoqda...</span>
                </div>
            </Card>
        );
    }

    if (error) {
        return (
            <Card title="Xatolik">
                <div className="text-red-700 p-4 bg-red-900/20 rounded-lg">
                    <p>{error}</p>
                    <button 
                        onClick={() => window.location.reload()} 
                        className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                    >
                        Qayta urinib ko'rish
                    </button>
                </div>
            </Card>
        );
    }

    // Calculate totals (amount har doim son — string bo'lsa ham)
    const totalIncome = filteredTransactions
        .filter((t) => txAmount(t.amount) > 0 && t.status === 'completed')
        .reduce((sum, t) => sum + txAmount(t.amount), 0);

    const totalExpenses = filteredTransactions
        .filter((t) => txAmount(t.amount) < 0 && t.status === 'completed')
        .reduce((sum, t) => sum + Math.abs(txAmount(t.amount)), 0);

    // Calculate by service type
    const incomeByServiceType: Record<string, number> = {};
    const expensesByServiceType: Record<string, number> = {};

    filteredTransactions.forEach((t) => {
        if (t.status === 'completed') {
            const service = t.service_type || 'other';
            const amt = txAmount(t.amount);
            if (amt > 0) {
                incomeByServiceType[service] = (incomeByServiceType[service] || 0) + amt;
            } else if (amt < 0) {
                expensesByServiceType[service] = (expensesByServiceType[service] || 0) + Math.abs(amt);
            }
        }
    });

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <div className="flex items-center">
                        <div className="p-3 rounded-xl bg-green-500/20 mr-4">
                            <div className="h-8 w-8 text-emerald-800 font-bold text-xl">+</div>
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Jami tushum</p>
                            <p className="text-2xl font-bold text-slate-900">{totalIncome.toLocaleString()} so'm</p>
                        </div>
                    </div>
                </Card>
                
                <Card>
                    <div className="flex items-center">
                        <div className="p-3 rounded-xl bg-red-500/20 mr-4">
                            <div className="h-8 w-8 text-red-700 font-bold text-xl">-</div>
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Jami chiqim</p>
                            <p className="text-2xl font-bold text-slate-900">{totalExpenses.toLocaleString()} so'm</p>
                        </div>
                    </div>
                </Card>
                
                <Card>
                    <div className="flex items-center">
                        <div className="p-3 rounded-xl bg-blue-500/20 mr-4">
                            <div className="h-8 w-8 text-blue-800 font-bold text-xl">=</div>
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Balans</p>
                            <p className="text-2xl font-bold text-slate-900">{(totalIncome - totalExpenses).toLocaleString()} so'm</p>
                        </div>
                    </div>
                </Card>
            </div>
            
            {/* Service Type Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card title="Tushumlar (Xizmat turlari bo'yicha)">
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                        {Object.entries(incomeByServiceType).length > 0 ? (
                            Object.entries(incomeByServiceType).map(([serviceType, amount]) => (
                                <div key={serviceType} className="flex justify-between items-center">
                                    <span className="text-slate-600">
                                        {serviceTypeNames[serviceType] || serviceType}
                                    </span>
                                    <span className="font-medium text-emerald-800">
                                        {amount.toLocaleString()} so'm
                                    </span>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-slate-500 py-4">Ma'lumot mavjud emas</p>
                        )}
                    </div>
                </Card>
                
                <Card title="Chiqimlar (Xizmat turlari bo'yicha)">
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                        {Object.entries(expensesByServiceType).length > 0 ? (
                            Object.entries(expensesByServiceType).map(([serviceType, amount]) => (
                                <div key={serviceType} className="flex justify-between items-center">
                                    <span className="text-slate-600">
                                        {serviceTypeNames[serviceType] || serviceType}
                                    </span>
                                    <span className="font-medium text-red-700">
                                        {amount.toLocaleString()} so'm
                                    </span>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-slate-500 py-4">Ma'lumot mavjud emas</p>
                        )}
                    </div>
                </Card>
            </div>

            <Card title="Moliyaviy tranzaksiyalar">
                <div className="mb-6 flex flex-col lg:flex-row gap-4">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-2">Qidirish</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 h-4 w-4" />
                                <input
                                    type="text"
                                    placeholder="Foydalanuvchi yoki xizmat bo'yicha qidirish..."
                                    className="w-full pl-10"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-2">Sana oralig'i</label>
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="date"
                                    className="w-full"
                                    value={dateRange.start}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                />
                                <input
                                    type="date"
                                    className="w-full"
                                    value={dateRange.end}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                />
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-2">Xizmat turi</label>
                            <select
                                className="w-full"
                                value={serviceType}
                                onChange={(e) => setServiceType(e.target.value)}
                            >
                                <option value="all">Barcha xizmatlar</option>
                                {Object.entries(serviceTypeNames).map(([key, value]) => (
                                    <option key={key} value={key}>{value}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    <div className="flex items-end">
                        <Button onClick={handleExport} variant="secondary" disabled={filteredTransactions.length === 0}>
                            <Download className="mr-2 h-4 w-4" /> Eksport
                        </Button>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-200/90">
                    <table className="w-full text-left">
                        <thead className="bg-slate-100/70">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Foydalanuvchi</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Xizmat</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Miqdor</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Sana</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Holat</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/80">
                            {filteredTransactions.length > 0 ? (
                                filteredTransactions.map(transaction => {
                                    const user = users.find(u => u.id === transaction.user);
                                    const userName = user ? `${user.first_name} ${user.last_name}` : 'Noma\'lum foydalanuvchi';
                                    const isCompleted = transaction.status === 'completed';
                                    const isFailed = transaction.status === 'failed' || transaction.status === 'cancelled';
                                    const amountPrefix = isFailed ? '' : '+';
                                    const amountColor = isCompleted ? 'text-emerald-800' : isFailed ? 'text-red-700' : 'text-yellow-800';
                                    return (
                                        <tr key={transaction.id} className="hover:bg-slate-100/70 transition-colors">
                                            <td className="px-4 py-4 text-sm text-slate-600">{userName}</td>
                                            <td className="px-4 py-4 text-sm text-slate-600">
                                                {serviceTypeNames[transaction.service_type] || transaction.service_type || 'Noma\'lum'}
                                            </td>
                                            <td className="px-4 py-4 text-sm font-medium">
                                                <span className={amountColor}>
                                                    {amountPrefix}{Number(transaction.amount || 0).toLocaleString()} {transaction.currency}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-sm text-slate-600">
                                                {new Date(transaction.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-4 py-4 text-sm">
                                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[transaction.status] || 'bg-gray-500/20 text-slate-600'}`}>
                                                    {transaction.status === 'completed' ? 'Tugallangan' : transaction.status === 'failed' ? 'Bekor qilindi' : transaction.status === 'cancelled' ? 'Bekor qilindi' : transaction.status === 'pending' ? 'Kutilmoqda' : transaction.status}
                                                </span>
                                                {isFailed && (transaction.error_note || '') && (
                                                    <p className="text-xs text-red-800/90 mt-1 max-w-xs truncate" title={transaction.error_note}>Sabab: {transaction.error_note}</p>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-4 py-12 text-center">
                                        <Filter className="mx-auto h-12 w-12 text-slate-500" />
                                        <h3 className="mt-2 text-sm font-medium text-slate-900">Tranzaksiyalar topilmadi</h3>
                                        <p className="mt-1 text-sm text-slate-500">
                                            {searchQuery || dateRange.start || dateRange.end || serviceType !== 'all' 
                                                ? 'Tanlangan filtrlar bo\'yicha hech narsa topilmadi.' 
                                                : 'Hozircha tranzaksiyalar mavjud emas.'}
                                        </p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default Financials;