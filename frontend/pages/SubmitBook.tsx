import React, { useState, useMemo, useRef, useEffect } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { UploadCloud, CheckCircle, Loader2, XCircle, BookText, Book, BookCopy, ChevronDown, Check, Info, Minus, Plus } from 'lucide-react';
import { useAuth, useNotifications } from '../contexts/AuthContext';
import { Article, ArticleStatus } from '../types';
import { apiService } from '../services/apiService';
import { paymentService } from '../services/paymentService';

// --- Pricing Data from Image ---
const PRINTING_PER_PAGE = {
    '1-10': { eco: 125, standart: 150 },
    '11-100': { eco: 100, standart: 125 },
    '101-300': { eco: 80, standart: 100 },
    '301-1000': { eco: 75, standart: 80 },
};

const COVER_PER_BOOK = {
    '1-10': { soft: 15000, hard: 20000 },
    '11-100': { soft: 10000, hard: 15000 },
    '101-300': { soft: 8000, hard: 10000 },
    '301-1000': { soft: 6000, hard: 8000 },
};

const BINDING_PER_BOOK = {
    '1-10': 300,
    '11-100': 300,
    '101-300': 250,
    '301-1000': 200,
};

const ISBN_FEE = 600000;
const DESIGN_FEE = 75000; // Average of 50k-100k
// --- End Pricing Data ---

// --- Helper Components ---
const SliderInput: React.FC<{ label: string, value: number, onChange: (value: number) => void, min: number, max: number, step: number, icon: React.ComponentType<{ className?: string }> }> = ({ label, value, onChange, min, max, step, icon: Icon }) => (
    <div>
        <div className="flex items-center justify-between mb-2">
            <label className="flex items-center text-sm font-medium text-slate-600">
                <Icon className="w-4 h-4 mr-2" />
                {label}
            </label>
            <span className="text-sm font-medium text-blue-900 bg-blue-900/30 px-2 py-1 rounded">{value}</span>
        </div>
        <div className="flex items-center space-x-3">
            <button 
                onClick={() => onChange(Math.max(min, value - step))} 
                className="p-2 rounded-lg bg-slate-100/70 hover:bg-white/10 transition-colors"
                type="button"
            >
                <Minus className="w-4 h-4 text-slate-500" />
            </button>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseInt(e.target.value, 10) || min)}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
            />
            <button 
                onClick={() => onChange(Math.min(max, value + step))} 
                className="p-2 rounded-lg bg-slate-100/70 hover:bg-white/10 transition-colors"
                type="button"
            >
                <Plus className="w-4 h-4 text-slate-500" />
            </button>
            <input
                type="number"
                min={min}
                max={max}
                value={value}
                onChange={(e) => onChange(parseInt(e.target.value, 10) || min)}
                className="w-24 text-center !py-2"
            />
        </div>
    </div>
);

const OptionToggle: React.FC<{ label: string, options: { value: string, label: string }[], selected: string, onSelect: (value: string) => void }> = ({ label, options, selected, onSelect }) => (
    <div>
        <label className="block text-sm font-medium text-slate-600 mb-2">{label}</label>
        <div className="flex bg-slate-100/70 rounded-lg p-1">
            {options.map(opt => (
                <button
                    key={opt.value}
                    type="button"
                    onClick={() => onSelect(opt.value)}
                    className={`w-full text-center px-4 py-2 rounded-md text-sm font-semibold transition-colors duration-200 ${selected === opt.value ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:bg-white/10'}`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    </div>
);

const CheckboxCard: React.FC<{ title: string, description: string, price: number, checked: boolean, onChange: (checked: boolean) => void }> = ({ title, description, price, checked, onChange }) => (
     <div onClick={() => onChange(!checked)} className={`p-4 rounded-lg bg-slate-100/70 border-2 cursor-pointer transition-all ${checked ? 'border-blue-500 bg-blue-500/10' : 'border-transparent hover:border-slate-200/90'}`}>
        <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
                <p className="font-semibold text-slate-900">{title}</p>
                <p className="text-xs text-slate-500 mt-1">{description}</p>
            </div>
            <div className="flex flex-col items-end">
                <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 transition-all ${checked ? 'bg-blue-600 border-blue-500' : 'bg-white/10 border-slate-300/80'}`}>
                    {checked && <Check className="w-3 h-3 text-slate-900" />}
                </div>
                 <p className="text-sm font-medium text-blue-900 mt-2 whitespace-nowrap">{price.toLocaleString()} so'm</p>
            </div>
        </div>
    </div>
);

const ClickLogo = () => (
     <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-900"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg>
    </div>
);
// --- End Helper Components ---


const SubmitBook: React.FC = () => {
    const { user } = useAuth();
    const { addNotification } = useNotifications();

    // Configuration state
    const [pages, setPages] = useState(150);
    const [copies, setCopies] = useState(50);
    const [paperQuality, setPaperQuality] = useState<'eco' | 'standart'>('standart');
    const [coverType, setCoverType] = useState<'soft' | 'hard'>('soft');
    const [options, setOptions] = useState({ isbn: false, design: false });

    // Nashr turi: bosma (yuborish kerak) yoki raqamli
    const [publicationType, setPublicationType] = useState<'bosma' | 'raqamli'>('bosma');
    // Bosma nashr bo'lsa — yetkazib berish (profil dan avtomatik to'ldiriladi, boshqasiga bo'lsa o'zgartirib kiritiladi)
    const [shippingFirstName, setShippingFirstName] = useState('');
    const [shippingLastName, setShippingLastName] = useState('');
    const [shippingRegion, setShippingRegion] = useState('');
    const [shippingAddress, setShippingAddress] = useState('');
    const [shippingPhone, setShippingPhone] = useState('');

    // Book details state
    const [title, setTitle] = useState('');
    const [synopsis, setSynopsis] = useState('');
    const [manuscriptFile, setManuscriptFile] = useState<File | null>(null);
    const [coverFile, setCoverFile] = useState<File | null>(null);

    // Payment modal state
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle');
    const [paymentError, setPaymentError] = useState<string | null>(null);
    const [transactionId, setTransactionId] = useState<string | null>(null);
    const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
    const [processPaymentStatus, setProcessPaymentStatus] = useState<'pending' | 'completed' | 'failed' | null>(null);
    const [isRefreshingProcess, setIsRefreshingProcess] = useState(false);
    const paymentTimerRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (paymentTimerRef.current) clearTimeout(paymentTimerRef.current);
        };
    }, []);

    // Muqova rasm yuklanmasa — professional muqova dizayni yoqiladi; yuklasa — avtomatik o'chadi
    useEffect(() => {
        setOptions((prev) => ({ ...prev, design: !coverFile }));
    }, [coverFile]);

    // Ro'yxatdan o'tgan foydalanuvchi ismi, familyasi va telefoni avtomatik to'ldiriladi (bo'sh bo'lsa)
    useEffect(() => {
        if (user && !shippingFirstName && !shippingLastName && !shippingPhone) {
            setShippingFirstName(user.firstName || '');
            setShippingLastName(user.lastName || '');
            const phone = user.phone || '';
            setShippingPhone(phone && !phone.startsWith('+') ? `+${phone}` : phone);
        }
    }, [user]);

    // To'lov sahifasidan qaytganda transactionId ni tiklash va holatni avtomatik tekshirish
    useEffect(() => {
        const stored = sessionStorage.getItem('submitbook_pending_transaction_id');
        if (stored) {
            setTransactionId(stored);
            refreshProcessStatus(stored);
        }
    }, []);

    const calculatedCosts = useMemo(() => {
        const getTier = (numCopies: number) => {
            if (numCopies >= 1 && numCopies <= 10) return '1-10';
            if (numCopies >= 11 && numCopies <= 100) return '11-100';
            if (numCopies >= 101 && numCopies <= 300) return '101-300';
            if (numCopies >= 301) return '301-1000'; // Cap at 1000 for pricing
            return null;
        };

        const tier = getTier(copies);
        if (!tier || pages <= 0 || copies <= 0) {
            return { printing: 0, cover: 0, binding: 0, isbn: 0, design: 0, total: 0 };
        }
        
        const pagePrice = PRINTING_PER_PAGE[tier][paperQuality];
        const coverPrice = COVER_PER_BOOK[tier][coverType];
        const bindingPrice = BINDING_PER_BOOK[tier];
        
        const printingTotal = pages * copies * pagePrice;
        const coverTotal = copies * coverPrice;
        const bindingTotal = copies * bindingPrice;
        const isbnTotal = options.isbn ? ISBN_FEE : 0;
        const designTotal = options.design ? DESIGN_FEE : 0;
        
        const total = printingTotal + coverTotal + bindingTotal + isbnTotal + designTotal;

        return { printing: printingTotal, cover: coverTotal, binding: bindingTotal, isbn: isbnTotal, design: designTotal, total };
    }, [pages, copies, paperQuality, coverType, options]);


    const submitBook = async (isPaid: boolean = false) => {
        if (!user || !title || !manuscriptFile || pages <= 0) return;

        try {
            // Prepare article data for book publication
            const articleData = {
                title: `[KITOB] ${title}`,
                abstract: synopsis || 'Annotatsiya kiritilmagan.',
                keywords: ['kitob', 'nashr'],
                status: ArticleStatus.Yangi,
                journalId: 'book-publication-service', // Special ID for books
                submissionDate: new Date().toISOString().split('T')[0],
                pageCount: pages,
            };

            // Create the article with manuscript file
            const result = await apiService.articles.create(
                articleData,
                { mainFile: manuscriptFile, additionalFile: coverFile || undefined }
            );
            
            // If payment was made, record the transaction
            if(isPaid && result.id) {
                const transactionData = {
                    articleId: result.id,
                    amount: -calculatedCosts.total,
                    currency: 'so\'m',
                    serviceType: 'book_publication',
                    status: 'completed',
                    createdAt: new Date().toISOString().split('T')[0],
                };
                
                // Save transaction to backend
                await apiService.payments.createTransaction(transactionData);
            }

            addNotification({ 
                message: `Yangi "${articleData.title.substring(0, 40)}..." kitobi ko'rib chiqish uchun yuborildi.`,
                link: `/articles/${result.id}`
            });
            
            return result;
        } catch (error) {
            console.error('Failed to submit book:', error);
            addNotification({ 
                message: 'Kitob yuborishda xatolik yuz berdi. Iltimos, qayta urinib ko\'ring.',
            });
            throw error;
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (calculatedCosts.total <= 0) {
            alert("Iltimos, sahifa va nusxalar sonini to'g'ri kiriting.");
            return;
        }
        if (publicationType === 'bosma') {
            if (!shippingRegion.trim()) {
                alert("Bosma nashr uchun viloyat yoki shaharni kiriting.");
                return;
            }
            if (!shippingAddress.trim()) {
                alert("Yetkazib berish manzilini (ko'cha, uy) kiriting.");
                return;
            }
            if (!shippingFirstName.trim() || !shippingLastName.trim()) {
                alert("Yetkazib berish uchun ism va familyani kiriting.");
                return;
            }
            if (!shippingPhone.trim()) {
                alert("Yetkazib berish uchun telefon raqamini kiriting.");
                return;
            }
        }
        setPaymentStatus('idle');
        setPaymentError(null);
        setIsPaymentModalOpen(true);
    };
    
    const handlePay = async (e?: React.MouseEvent<HTMLButtonElement>) => {
        // Prevent default button behavior
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        setPaymentError(null);
        setPaymentStatus('processing');
        if (paymentTimerRef.current) clearTimeout(paymentTimerRef.current);
        
        try {
            // Create transaction and process payment via Click
            const extraData: Record<string, unknown> = {
                publication_type: publicationType,
            };
            if (publicationType === 'bosma') {
                extraData.shipping_region = shippingRegion.trim();
                extraData.shipping_address = shippingAddress.trim();
                extraData.shipping_first_name = shippingFirstName.trim();
                extraData.shipping_last_name = shippingLastName.trim();
                extraData.shipping_phone = shippingPhone.trim();
            }
            const result = await paymentService.createTransactionAndPay(
                calculatedCosts.total,
                'UZS',
                'book_publication',
                undefined, // articleId
                undefined, // translationRequestId
                'click',
                extraData
            );
            
            console.log('Payment result:', result);
            
            if (result && result.success === true && result.transaction_id) {
                const txId = result.transaction_id;
                setPaymentStatus('success');
                setTransactionId(txId);
                setProcessPaymentStatus('pending');
                sessionStorage.setItem('submitbook_pending_transaction_id', txId);
                addNotification({
                    message: 'To\'lov sahifasida QR kodni skanerlang yoki tugmani bosing. To\'lovdan keyin sahifaga qayting va "Holatni yangilash" ni bosing.',
                });
                paymentService.redirectToPaymentPage(txId);
            } else if (result && result.success === true && result.payment_url && result.transaction_id) {
                paymentService.redirectToPaymentPage(result.transaction_id);
            } else {
                // Payment preparation failed
                const errorMsg = (result as any)?.user_message || result?.error_note || result?.error || "To'lovni amalga oshirishda xatolik yuz berdi.";
                setPaymentStatus('failed');
                setPaymentError(errorMsg);
                addNotification({ 
                    message: errorMsg,
                });
            }
        } catch (err: any) {
            console.error('Payment failed:', err);
            const errorMsg = err.message || err.error_note || err.user_message || "To'lovni amalga oshirishda xatolik yuz berdi.";
            setPaymentStatus('failed');
            setPaymentError(errorMsg);
            addNotification({ 
                message: errorMsg,
            });
        }
    };
    
    const closePaymentModal = () => setIsPaymentModalOpen(false);

    const closeProcessModal = () => setIsProcessModalOpen(false);

    const STORAGE_KEY_BOOK_TX = 'submitbook_pending_transaction_id';

    const refreshProcessStatus = async (txId?: string) => {
        const id = txId ?? transactionId ?? sessionStorage.getItem(STORAGE_KEY_BOOK_TX);
        if (!id) return;

        setIsRefreshingProcess(true);
        try {
            const statusResult = await paymentService.checkPaymentStatus(id);
            if (statusResult.payment_status === 2) {
                setProcessPaymentStatus('completed');
                setTransactionId((prev) => (prev || id));
                sessionStorage.removeItem(STORAGE_KEY_BOOK_TX);
            } else if (statusResult.payment_status === -1) {
                setProcessPaymentStatus('failed');
                setTransactionId((prev) => prev || id);
            } else {
                setProcessPaymentStatus('pending');
                setTransactionId((prev) => prev || id);
            }
        } catch (err) {
            setProcessPaymentStatus('pending');
            setTransactionId((prev) => prev || id);
        } finally {
            setIsRefreshingProcess(false);
        }
    };
    
    const formatCurrency = (amount: number) => `${new Intl.NumberFormat('uz-UZ').format(amount)} so'm`;

    return (
        <>
            <Card title="Kitob Nashr Etish Kalkulyatori">
                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Left Column: Configuration */}
                        <div className="space-y-6">
                            <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-200/90 pb-3">1. Asosiy Parametrlar</h3>
                            <SliderInput label="Sahifalar soni" value={pages} onChange={setPages} min={16} max={1000} step={4} icon={BookText} />
                            <SliderInput label="Nusxalar soni" value={copies} onChange={setCopies} min={1} max={1000} step={1} icon={BookCopy} />
                            <OptionToggle label="Qog'oz sifati" options={[{ value: 'eco', label: 'Eco' }, { value: 'standart', label: 'Standart' }]} selected={paperQuality} onSelect={val => setPaperQuality(val as 'eco' | 'standart')} />
                            <OptionToggle label="Muqova turi" options={[{ value: 'soft', label: 'Yumshoq' }, { value: 'hard', label: 'Qattiq' }]} selected={coverType} onSelect={val => setCoverType(val as 'soft' | 'hard')} />

                            <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-200/90 pb-3 pt-4">2. Qo'shimcha Xizmatlar</h3>
                            <div className="space-y-3">
                                <CheckboxCard title="ISBN raqami olish" description="Kitobingizga xalqaro standart raqamini oling." price={ISBN_FEE} checked={options.isbn} onChange={c => setOptions(p => ({ ...p, isbn: c }))} />
                                <CheckboxCard title="Professional muqova dizayni" description="Tajribali dizaynerlar tomonidan muqova tayyorlash." price={DESIGN_FEE} checked={options.design} onChange={c => setOptions(p => ({ ...p, design: c }))} />
                            </div>
                        </div>

                        {/* Right Column: Summary & Upload */}
                        <div className="space-y-6">
                             <div className="sticky top-24">
                                <Card title="Hisob-kitob" className="!bg-black/40">
                                    {calculatedCosts.total > 0 ? (
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between py-1.5 border-b border-slate-200/90"><span className="text-slate-500">Chop etish:</span><span className="font-medium text-slate-900">{formatCurrency(calculatedCosts.printing)}</span></div>
                                            <div className="flex justify-between py-1.5 border-b border-slate-200/90"><span className="text-slate-500">Muqova:</span><span className="font-medium text-slate-900">{formatCurrency(calculatedCosts.cover)}</span></div>
                                            <div className="flex justify-between py-1.5 border-b border-slate-200/90"><span className="text-slate-500">Tikish:</span><span className="font-medium text-slate-900">{formatCurrency(calculatedCosts.binding)}</span></div>
                                            {options.isbn && <div className="flex justify-between py-1.5 border-b border-slate-200/90"><span className="text-slate-500">ISBN:</span><span className="font-medium text-slate-900">{formatCurrency(calculatedCosts.isbn)}</span></div>}
                                            {options.design && <div className="flex justify-between py-1.5 border-b border-slate-200/90"><span className="text-slate-500">Dizayn:</span><span className="font-medium text-slate-900">{formatCurrency(calculatedCosts.design)}</span></div>}
                                            <div className="flex justify-between items-center pt-4">
                                                <span className="text-lg font-bold text-slate-900">JAMI:</span>
                                                <span className="text-2xl font-bold text-blue-900">{formatCurrency(calculatedCosts.total)}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-slate-500">
                                            <Info className="mx-auto h-8 w-8 mb-2" />
                                            Narxni hisoblash uchun parametrlarni kiriting.
                                        </div>
                                    )}
                                </Card>
                            </div>
                        </div>
                    </div>

                    <div className="mt-10 pt-6 border-t border-slate-200/90">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">3. Kitob Ma'lumotlari va Fayllar</h3>
                         <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-2">Kitob Sarlavhasi</label>
                                <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="w-full"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-2">Annotatsiya / Synopsis</label>
                                <textarea value={synopsis} onChange={e => setSynopsis(e.target.value)} required className="w-full" rows={4}></textarea>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-2">Qo'lyozma Fayli (.doc, .docx)</label>
                                    <label htmlFor="manuscript-upload" className="cursor-pointer">
                                        <div className="p-8 border-2 border-dashed rounded-lg border-slate-200 text-center bg-slate-100/70 hover:bg-white/10 transition-colors h-full flex flex-col justify-center">
                                            <UploadCloud className="mx-auto h-10 w-10 text-slate-500" />
                                            <p className="mt-2 text-sm text-slate-500">{manuscriptFile ? manuscriptFile.name : 'Faylni yuklang'}</p>
                                        </div>
                                        <input id="manuscript-upload" type="file" className="sr-only" onChange={(e) => setManuscriptFile(e.target.files ? e.target.files[0] : null)} accept=".doc,.docx" required />
                                    </label>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-2">Muqova Rasmi (ixtiyoriy)</label>
                                    <label htmlFor="cover-upload" className="cursor-pointer">
                                        <div className="p-8 border-2 border-dashed rounded-lg border-slate-200 text-center bg-slate-100/70 hover:bg-white/10 transition-colors h-full flex flex-col justify-center">
                                            <UploadCloud className="mx-auto h-10 w-10 text-slate-500" />
                                            <p className="mt-2 text-sm text-slate-500">{coverFile ? coverFile.name : 'Rasm yuklang'}</p>
                                        </div>
                                        <input id="cover-upload" type="file" className="sr-only" onChange={(e) => setCoverFile(e.target.files ? e.target.files[0] : null)} accept="image/*" />
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-10 pt-6 border-t border-slate-200/90">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">4. Nashr turi va yetkazib berish</h3>
                        <OptionToggle
                            label="Nashr turi"
                            options={[
                                { value: 'bosma', label: 'Bosma nashr (yuborish kerak)' },
                                { value: 'raqamli', label: 'Raqamli nashr' },
                            ]}
                            selected={publicationType}
                            onSelect={(val) => setPublicationType(val as 'bosma' | 'raqamli')}
                        />
                        {publicationType === 'bosma' && (
                            <div className="mt-6 p-4 rounded-lg bg-slate-100/70 border border-slate-200/90 space-y-4">
                                <p className="text-sm text-slate-500">Kitob bosma nashrda chiqsa, yetkazib berish uchun manzilni kiriting. Ism, familya va telefon profil ma'lumotlaridan avtomatik to'ldiriladi; boshqasiga yetkazib berish bo'lsa o'zgartiring.</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-2">Ism *</label>
                                        <input
                                            type="text"
                                            value={shippingFirstName}
                                            onChange={e => setShippingFirstName(e.target.value)}
                                            placeholder="Ism"
                                            className="w-full px-4 py-2 rounded-lg bg-slate-100/70 border border-slate-200/90 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-2">Familya *</label>
                                        <input
                                            type="text"
                                            value={shippingLastName}
                                            onChange={e => setShippingLastName(e.target.value)}
                                            placeholder="Familya"
                                            className="w-full px-4 py-2 rounded-lg bg-slate-100/70 border border-slate-200/90 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-2">Telefon (yetkazib berish uchun) *</label>
                                    <input
                                        type="tel"
                                        value={shippingPhone}
                                        onChange={e => {
                                            const v = e.target.value;
                                            setShippingPhone(v && !v.startsWith('+') ? `+${v}` : v);
                                        }}
                                        placeholder="+998 90 123 45 67"
                                        className="w-full px-4 py-2 rounded-lg bg-slate-100/70 border border-slate-200/90 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-2">Viloyat / Shahar *</label>
                                    <input
                                        type="text"
                                        value={shippingRegion}
                                        onChange={e => setShippingRegion(e.target.value)}
                                        placeholder="Masalan: Toshkent, Samarqand"
                                        className="w-full px-4 py-2 rounded-lg bg-slate-100/70 border border-slate-200/90 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-2">Manzil (ko'cha, uy, kv) *</label>
                                    <input
                                        type="text"
                                        value={shippingAddress}
                                        onChange={e => setShippingAddress(e.target.value)}
                                        placeholder="Ko'cha nomi, uy raqami, kv"
                                        className="w-full px-4 py-2 rounded-lg bg-slate-100/70 border border-slate-200/90 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-10 pt-6 border-t border-slate-200/90 flex justify-end">
                        <Button
                            type="submit"
                            disabled={
                                !title || !manuscriptFile || pages <= 0 || copies <= 0 ||
                                (publicationType === 'bosma' && (
                                    !shippingRegion.trim() || !shippingAddress.trim() ||
                                    !shippingFirstName.trim() || !shippingLastName.trim() || !shippingPhone.trim()
                                ))
                            }
                        >
                            To'lovga o'tish va Yuborish
                        </Button>
                    </div>
                </form>
            </Card>

            {isPaymentModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-sm text-center">
                        {paymentStatus === 'idle' && (
                            <>
                                <ClickLogo />
                                <h3 className="text-xl font-semibold text-slate-900">To'lovni tasdiqlash</h3>
                                <p className="text-sm text-slate-500 mt-1">Kitob nashr etish</p>
                                <p className="text-4xl font-bold my-4 text-slate-900">{formatCurrency(calculatedCosts.total)}</p>
                                <Button 
                                    onClick={(e) => handlePay(e)} 
                                    className="w-full"
                                    type="button"
                                >
                                    To'lash
                                </Button>
                                <Button variant="secondary" onClick={closePaymentModal} className="w-full mt-3">
                                    Bekor qilish
                                </Button>
                            </>
                        )}
                        {paymentStatus === 'processing' && (
                            <div className="py-8">
                                <Loader2 className="mx-auto h-16 w-16 text-blue-500 animate-spin"/>
                                <p className="mt-4 text-lg font-medium text-slate-700">To'lov tasdiqlanmoqda...</p>
                            </div>
                        )}
                        {paymentStatus === 'success' && (
                           <div className="py-8">
                                <CheckCircle className="mx-auto h-16 w-16 text-green-800"/>
                                <p className="mt-4 text-lg font-medium text-slate-700">To'lov oynasi ochildi</p>
                                <p className="text-sm text-slate-500">Click sahifasi yangi tabda ochildi. To'lovni yakunlagach ushbu oynaga qayting.</p>
                                <div className="space-y-2 mt-6">
                                    <Button onClick={() => {
                                        const stored = sessionStorage.getItem('submitbook_pending_transaction_id');
                                        if (stored && !transactionId) setTransactionId(stored);
                                        setIsProcessModalOpen(true);
                                        refreshProcessStatus(stored || undefined);
                                    }} className="w-full">
                                        Jarayonni ko'rish
                                    </Button>
                                    <Button onClick={closePaymentModal} variant="secondary" className="w-full">
                                        Yopish
                                    </Button>
                                </div>
                           </div>
                        )}
                        {paymentStatus === 'failed' && (
                           <div className="py-8">
                                <XCircle className="mx-auto h-16 w-16 text-red-500"/>
                                <p className="mt-4 text-lg font-medium text-slate-700">To'lovda xatolik!</p>
                                <p className="text-sm text-slate-500 max-w-xs mx-auto">{paymentError}</p>
                                <div className="flex space-x-2 mt-6">
                                     <Button 
                                        onClick={(e) => handlePay(e)} 
                                        className="w-full"
                                        type="button"
                                    >
                                        Qayta urinish
                                    </Button>
                                    <Button 
                                        variant="secondary" 
                                        onClick={closePaymentModal} 
                                        className="w-1/2"
                                        type="button"
                                    >
                                        Yopish
                                    </Button>
                                </div>
                           </div>
                        )}
                    </Card>
                </div>
            )}

            {isProcessModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-xl">
                        <h3 className="text-xl font-semibold text-slate-900 mb-4">Kitob nashri jarayoni</h3>

                        <div className="space-y-3">
                            <div className="p-3 rounded-lg bg-slate-100/70 border border-slate-200/90 flex items-center justify-between">
                                <span className="text-slate-700">1. Buyurtma qabul qilindi</span>
                                <CheckCircle className="h-5 w-5 text-green-800" />
                            </div>
                            <div className="p-3 rounded-lg bg-slate-100/70 border border-slate-200/90 flex items-center justify-between">
                                <span className="text-slate-700">2. To'lov holati</span>
                                {processPaymentStatus === 'completed' && <CheckCircle className="h-5 w-5 text-green-800" />}
                                {processPaymentStatus === 'failed' && <XCircle className="h-5 w-5 text-red-500" />}
                                {(processPaymentStatus === 'pending' || processPaymentStatus === null) && <Loader2 className="h-5 w-5 text-yellow-800 animate-spin" />}
                            </div>
                            <div className="p-3 rounded-lg bg-slate-100/70 border border-slate-200/90 flex items-center justify-between">
                                <span className="text-slate-700">3. Muharrir ko'rib chiqadi</span>
                                <span className="text-xs text-slate-500">Kutilmoqda</span>
                            </div>
                            <div className="p-3 rounded-lg bg-slate-100/70 border border-slate-200/90 flex items-center justify-between">
                                <span className="text-slate-700">4. Nashrga tayyorlash</span>
                                <span className="text-xs text-slate-500">Kutilmoqda</span>
                            </div>
                            <div className="p-3 rounded-lg bg-slate-100/70 border border-slate-200/90 flex items-center justify-between">
                                <span className="text-slate-700">5. Yakuniy natija</span>
                                <span className="text-xs text-slate-500">Kutilmoqda</span>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-6">
                            <Button
                                onClick={() => refreshProcessStatus(transactionId || sessionStorage.getItem(STORAGE_KEY_BOOK_TX) || undefined)}
                                variant="secondary"
                                className="w-full"
                                disabled={isRefreshingProcess || !(transactionId || sessionStorage.getItem(STORAGE_KEY_BOOK_TX))}
                            >
                                {isRefreshingProcess ? 'Yangilanmoqda...' : 'Holatni yangilash'}
                            </Button>
                            <Button onClick={closeProcessModal} className="w-full">Yopish</Button>
                        </div>
                    </Card>
                </div>
            )}
        </>
    );
};

export default SubmitBook;
