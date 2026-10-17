import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import EditorialPageHeader from '../components/EditorialPageHeader';
import { Download, Search, Loader2 } from 'lucide-react';
import { apiService } from '../services/apiService';
import { txAmount } from '../utils/amount';
import { useT } from '../i18n/LanguageContext';
import { formatUzDate } from '../utils/uzDate';
import { toast } from 'react-toastify';

import { personFullName } from '../utils/personName';
const Financials: React.FC = () => {
    const { t: tr } = useT();
    const { user } = useAuth();
    const [transactions, setTransactions] = useState<any[]>([]);
    const [filteredTransactions, setFilteredTransactions] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [serviceType, setServiceType] = useState('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [users, setUsers] = useState<any[]>([]);
    const canRefund = user?.role === 'accountant' || user?.role === 'super_admin';
    const [refundingId, setRefundingId] = useState<string | null>(null);

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
                
                // apiService barcha sahifalarni yuklab massiv qaytaradi
                const transactionsArray: any[] = Array.isArray(transactionsData) ? transactionsData : [];
                const usersArray: any[] = Array.isArray(usersData) ? usersData : [];

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
                const userName = (t.user_name || personFullName(user)).toLowerCase();
                
                return userName.includes(query) ||
                    t.service_type?.toLowerCase().includes(query) ||
                    (t.journal_name && String(t.journal_name).toLowerCase().includes(query)) ||
                    (t.article_title && String(t.article_title).toLowerCase().includes(query)) ||
                    (t.context_label && String(t.context_label).toLowerCase().includes(query)) ||
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
        'udk_request': 'UDK buyurtmasi',
        'doi_request': 'DOI so\'rovi',
        'article_sample': 'Maqola namuna',
    };

    const transactionContext = (t: {
        journal_name?: string;
        article_title?: string;
        context_label?: string;
        service_type?: string;
    }) => {
        const journal = (t.journal_name || '').trim();
        const title = (t.article_title || '').trim();
        const fallback = (t.context_label || '').trim();
        if (journal && title) return { journal, detail: title };
        if (journal) return { journal, detail: '' };
        if (title) return { journal: '—', detail: title };
        if (fallback) return { journal: '—', detail: fallback };
        return { journal: '—', detail: '' };
    };

    const statusColors: Record<string, string> = {
        'pending': 'bg-yellow-500/20 text-yellow-900',
        'completed': 'bg-green-500/20 text-emerald-900',
        'failed': 'bg-red-500/20 text-red-800',
        'cancelled': 'bg-gray-500/20 text-slate-600',
        'refunded': 'bg-sky-500/20 text-sky-900',
    };

    // Rad etilgan maqola to'lovini qaytarish: muallif so'raydi, moliyachi Click kabinetida qaytarib shu yerda belgilaydi
    const refundRequests = transactions.filter((t) => t.status === 'completed' && t.refund_requested_at);
    /** Click to'lovi bo'lsa — Merchant API orqali avtomatik qaytarish mumkin (Click rad etsa — qo'lda) */
    const canClickRefund = (tx: any) => tx.payment_provider === 'click' || !!(tx.click_trans_id || tx.click_paydoc_id);

    const markRefunded = async (tx: any, viaClick: boolean) => {
        let note = '';
        if (viaClick) {
            if (!window.confirm(tr("{amount} so'm Click orqali muallif kartasiga qaytarilsinmi? Bu amalni bekor qilib bo'lmaydi.", { amount: Number(tx.amount || 0).toLocaleString() }))) {
                return;
            }
        } else {
            const input = window.prompt(
                tr("Qaytarish izohi (masalan: Click kabinetida qaytarildi, sana). Muallifga yuboriladi:"),
            );
            if (input === null) return;
            note = input.trim();
            if (note.length < 5) {
                toast.error(tr('Izoh yozing (kamida 5 ta belgi).'));
                return;
            }
        }
        setRefundingId(tx.id);
        try {
            const updated = await apiService.payments.markRefunded(tx.id, note, viaClick);
            setTransactions((prev) => prev.map((t) => (t.id === tx.id ? { ...t, ...updated } : t)));
            toast.success(
                viaClick
                    ? tr("Click orqali qaytarildi. Muallifga xabar yuborildi.")
                    : tr("To'lov qaytarilgan deb belgilandi. Muallifga xabar yuborildi."),
            );
        } catch (err: any) {
            toast.error(err?.message || tr("Belgilab bo'lmadi."));
        } finally {
            setRefundingId(null);
        }
    };

    const handleExport = () => {
        // Create CSV content
        const headers = ['Foydalanuvchi', 'Xizmat', 'Jurnal', 'Maqola / buyurtma', 'Miqdor', 'Valyuta', 'Sana', 'Holat'];
        const csvContent = [
            headers.join(','),
            ...filteredTransactions.map(t => {
                const user = users.find(u => u.id === t.user);
                const userName = t.user_name || personFullName(user, 'Noma\'lum foydalanuvchi');
                const service = serviceTypeNames[t.service_type] || t.service_type || 'Noma\'lum';
                const ctx = transactionContext(t);
                const amount = `${txAmount(t.amount) >= 0 ? '+' : ''}${txAmount(t.amount)}`;
                const date = new Date(t.created_at).toLocaleDateString();
                return `"${userName}","${service}","${ctx.journal}","${ctx.detail}","${amount}","${t.currency}","${date}","${t.status}"`;
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
        return <Card title={tr('Ruxsat kerak')}><p>{tr("Ushbu sahifani ko'rish uchun tizimga kirishingiz kerak.")}</p></Card>;
    }

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto">
                <EditorialPageHeader title={tr('Moliyaviy tranzaksiyalar')} subtitle={tr('Platforma tushum va chiqimlarini kuzatish.')} />
                <Card>
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-[var(--editorial-primary)]" />
                        <span className="ml-3 text-[var(--editorial-muted)]">{tr("Ma'lumotlar yuklanmoqda...")}</span>
                    </div>
                </Card>
            </div>
        );
    }

    if (error) {
        return (
            <Card title={tr('Xatolik')}>
                <div className="text-red-700 p-4 bg-red-900/20 rounded-lg">
                    <p>{error}</p>
                    <button 
                        onClick={() => window.location.reload()} 
                        className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                    >
                        {tr("Qayta urinib ko'rish")}
                    </button>
                </div>
            </Card>
        );
    }

    // Calculate totals (amount har doim son — string bo'lsa ham). Namuna (demo) to'lovlar hisobga olinmaydi.
    const realTransactions = filteredTransactions.filter((t) => !t.is_demo);
    const totalIncome = realTransactions
        .filter((t) => txAmount(t.amount) > 0 && t.status === 'completed')
        .reduce((sum, t) => sum + txAmount(t.amount), 0);

    const totalExpenses = realTransactions
        .filter((t) => txAmount(t.amount) < 0 && t.status === 'completed')
        .reduce((sum, t) => sum + Math.abs(txAmount(t.amount)), 0);

    // Calculate by service type
    const incomeByServiceType: Record<string, number> = {};
    const expensesByServiceType: Record<string, number> = {};

    realTransactions.forEach((t) => {
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
        <div className="space-y-6 max-w-6xl mx-auto">
            <EditorialPageHeader
                title={tr('Moliyaviy tranzaksiyalar')}
                subtitle={tr('Platforma tushum, chiqim va tranzaksiyalar tarixi.')}
            />
            {refundRequests.length > 0 && (
                <div className="editorial-card p-4 border-amber-300 bg-amber-50/60 text-sm text-amber-900">
                    {tr("{count} ta to'lovni qaytarish so'rovi kutmoqda — jadvalda «Qaytarish so'ralgan» belgisi bilan.", { count: refundRequests.length })}
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="editorial-card p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-md bg-[rgba(10,122,140,0.12)] text-[var(--editorial-teal)] font-bold text-xl">+</div>
                        <div>
                            <p className="text-sm text-[var(--editorial-muted)]">{tr('Jami tushum')}</p>
                            <p className="text-2xl font-serif font-bold text-[var(--editorial-text)] tabular-nums">{tr("{value} so'm", { value: totalIncome.toLocaleString() })}</p>
                        </div>
                    </div>
                </div>
                <div className="editorial-card p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-md bg-red-500/15 text-red-700 font-bold text-xl">−</div>
                        <div>
                            <p className="text-sm text-[var(--editorial-muted)]">{tr('Jami chiqim')}</p>
                            <p className="text-2xl font-serif font-bold text-[var(--editorial-text)] tabular-nums">{tr("{value} so'm", { value: totalExpenses.toLocaleString() })}</p>
                        </div>
                    </div>
                </div>
                <div className="editorial-card p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-md bg-[rgba(31,63,143,0.08)] text-[var(--editorial-primary)] font-bold text-xl">=</div>
                        <div>
                            <p className="text-sm text-[var(--editorial-muted)]">{tr('Balans')}</p>
                            <p className="text-2xl font-serif font-bold text-[var(--editorial-text)] tabular-nums">{tr("{value} so'm", { value: (totalIncome - totalExpenses).toLocaleString() })}</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card title={tr("Tushumlar (Xizmat turlari bo'yicha)")}>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {Object.entries(incomeByServiceType).length > 0 ? (
                            Object.entries(incomeByServiceType).map(([serviceType, amount]) => (
                                <div key={serviceType} className="editorial-card flex justify-between items-center p-3">
                                    <span className="text-[var(--editorial-muted)]">
                                        {serviceTypeNames[serviceType] || serviceType}
                                    </span>
                                    <span className="font-medium text-[var(--editorial-teal)] tabular-nums">{tr("{value} so'm", { value: amount.toLocaleString() })}</span>
                                </div>
                            ))
                        ) : (
                            <div className="editorial-empty py-6">{tr("Ma'lumot mavjud emas")}</div>
                        )}
                    </div>
                </Card>

                <Card title={tr("Chiqimlar (Xizmat turlari bo'yicha)")}>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {Object.entries(expensesByServiceType).length > 0 ? (
                            Object.entries(expensesByServiceType).map(([serviceType, amount]) => (
                                <div key={serviceType} className="editorial-card flex justify-between items-center p-3">
                                    <span className="text-[var(--editorial-muted)]">
                                        {serviceTypeNames[serviceType] || serviceType}
                                    </span>
                                    <span className="font-medium text-red-700 tabular-nums">{tr("{value} so'm", { value: amount.toLocaleString() })}</span>
                                </div>
                            ))
                        ) : (
                            <div className="editorial-empty py-6">{tr("Ma'lumot mavjud emas")}</div>
                        )}
                    </div>
                </Card>
            </div>

            <Card title={tr("Tranzaksiyalar ro'yxati")}>
                <div className="mb-6 flex flex-col lg:flex-row gap-4">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="editorial-field-label block mb-2">{tr('Qidirish')}</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--editorial-muted)] h-4 w-4" />
                                <input
                                    type="text"
                                    placeholder={tr("Foydalanuvchi yoki xizmat bo'yicha qidirish...")}
                                    className="w-full pl-10 editorial-select !py-2.5"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                        
                        <div>
                            <label className="editorial-field-label block mb-2">{tr("Sana oralig'i")}</label>
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
                            <label className="editorial-field-label block mb-2">{tr('Xizmat turi')}</label>
                            <select
                                className="editorial-select w-full"
                                value={serviceType}
                                onChange={(e) => setServiceType(e.target.value)}
                            >
                                <option value="all">{tr('Barcha xizmatlar')}</option>
                                {Object.entries(serviceTypeNames).map(([key, value]) => (
                                    <option key={key} value={key}>{value}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    <div className="flex items-end">
                        <Button onClick={handleExport} variant="secondary" disabled={filteredTransactions.length === 0}>
                            <Download className="mr-2 h-4 w-4" /> {tr('Eksport')}
                        </Button>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-[var(--editorial-border)] rtable-wrap">
                    <table className="w-full text-left rtable">
                        <thead className="bg-[rgba(31,63,143,0.04)]">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{tr('Foydalanuvchi')}</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{tr('Xizmat')}</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{tr('Jurnal')}</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider hidden lg:table-cell">{tr('Maqola / buyurtma')}</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{tr('Miqdor')}</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{tr('Sana')}</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{tr('Holat')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/80">
                            {filteredTransactions.length > 0 ? (
                                filteredTransactions.map(transaction => {
                                    const user = users.find(u => u.id === transaction.user);
                                    // API har to'lov bilan user_name beradi (foydalanuvchilar ro'yxati sahifalangan bo'lishi mumkin)
                                    const userName = transaction.user_name || personFullName(user, 'Noma\'lum foydalanuvchi');
                                    const isCompleted = transaction.status === 'completed';
                                    const isFailed = transaction.status === 'failed' || transaction.status === 'cancelled';
                                    const isRefunded = transaction.status === 'refunded';
                                    // Qaytarilgan to'lov tushum emas — "+" belgisisiz, alohida rangda
                                    const amountPrefix = isFailed ? '' : isRefunded ? '↩ ' : '+';
                                    const amountColor = isCompleted ? 'text-emerald-800' : isFailed ? 'text-red-700' : isRefunded ? 'text-sky-800 line-through' : 'text-yellow-800';
                                    const ctx = transactionContext(transaction);
                                    return (
                                        <tr key={transaction.id} className="hover:bg-[rgba(31,63,143,0.03)] transition-colors">
                                            <td className="px-4 py-4 text-sm text-slate-600">{userName}</td>
                                            <td className="px-4 py-4 text-sm text-slate-600">
                                                {serviceTypeNames[transaction.service_type] || transaction.service_type || tr("Noma'lum")}
                                            </td>
                                            <td className="px-4 py-4 text-sm text-slate-900 font-medium max-w-[180px]">
                                                <span className="line-clamp-2" title={ctx.journal}>{ctx.journal}</span>
                                                {ctx.detail && (
                                                    <p className="text-xs text-slate-500 font-normal mt-0.5 line-clamp-1 lg:hidden" title={ctx.detail}>
                                                        {ctx.detail}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-sm text-slate-600 hidden lg:table-cell max-w-[220px]">
                                                <span className="line-clamp-2" title={ctx.detail || '—'}>
                                                    {ctx.detail || '—'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-sm font-medium">
                                                <span className={amountColor}>
                                                    {amountPrefix}{Number(transaction.amount || 0).toLocaleString()} {transaction.currency}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-sm text-slate-600">
                                                {formatUzDate(transaction.created_at, true)}
                                            </td>
                                            <td className="px-4 py-4 text-sm">
                                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[transaction.status] || 'bg-gray-500/20 text-slate-600'}`}>
                                                    {transaction.status === 'completed' ? tr('Tugallangan') : transaction.status === 'failed' ? tr('Bekor qilindi') : transaction.status === 'cancelled' ? tr('Bekor qilindi') : transaction.status === 'pending' ? tr('Kutilmoqda') : transaction.status === 'refunded' ? tr('Qaytarildi') : transaction.status}
                                                </span>
                                                {transaction.status === 'completed' && transaction.refund_requested_at && (
                                                    <div className="mt-1 space-y-1">
                                                        <p className="text-xs text-amber-800" title={transaction.refund_reason || ''}>{tr("Qaytarish so'ralgan")}</p>
                                                        {canRefund && (
                                                            <div className="flex flex-col items-start gap-0.5">
                                                                {canClickRefund(transaction) && (
                                                                    <button
                                                                        type="button"
                                                                        disabled={refundingId === transaction.id}
                                                                        onClick={() => markRefunded(transaction, true)}
                                                                        className="text-xs font-semibold text-[var(--editorial-primary)] hover:underline disabled:opacity-50"
                                                                    >
                                                                        {refundingId === transaction.id ? tr('Qaytarilmoqda…') : tr('Click orqali qaytarish')}
                                                                    </button>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    disabled={refundingId === transaction.id}
                                                                    onClick={() => markRefunded(transaction, false)}
                                                                    className="text-xs font-medium text-slate-600 hover:underline disabled:opacity-50"
                                                                >
                                                                    {tr('Qaytarildi deb belgilash')}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {isFailed && (transaction.error_note || '') && (
                                                    <p className="text-xs text-red-800/90 mt-1 max-w-xs truncate" title={transaction.error_note}>{tr('Sabab: {error_note}', { error_note: transaction.error_note })}</p>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12">
                                        <div className="editorial-empty py-4">
                                            {searchQuery || dateRange.start || dateRange.end || serviceType !== 'all'
                                                ? tr("Tanlangan filtrlar bo'yicha hech narsa topilmadi.")
                                                : tr('Hozircha tranzaksiyalar mavjud emas.')}
                                        </div>
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