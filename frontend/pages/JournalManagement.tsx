import React, { useState, useEffect } from 'react';
import { ListSkeleton } from '../components/ui/Skeleton';
import Card from '../components/ui/Card';
import EditorialPageHeader from '../components/EditorialPageHeader';
import { useAuth } from '../contexts/AuthContext';
import { Role, Journal, JournalCategory, PaymentModel, JournalPricingType, AdditionalDocumentConfig, ScientificFieldItem } from '../types';
import { PUBLICATION_TYPES, normCategory, publicationTypeKey, sameCategory } from '../constants/authorCategories';
import Button from '../components/ui/Button';
import { Edit, Trash2, PlusCircle, X, Check, UploadCloud, Archive, RotateCcw } from 'lucide-react';
import { apiService } from '../services/apiService';
import { useT } from '../i18n/LanguageContext';

import { personFullName } from '../utils/personName';
/** Form may hold number | undefined; avoid comparing number to '' for tsc */
function optionalJournalPercent(v: unknown): number | null {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

const COMMON_COUNTRIES = [
    "O'zbekiston", "Qozog'iston", "Qirg'iziston", 'Tojikiston', 'Turkmaniston', 'Rossiya', 'Turkiya',
    'Hindiston', 'AQSH', 'Buyuk Britaniya', 'Germaniya', 'Polsha', 'Indoneziya', 'Malayziya',
];

/** Server maydon nomi → forma yorlig'i (xato xabari foydalanuvchiga tushunarli bo'lsin) */
const JOURNAL_FIELD_LABELS: Record<string, string> = {
    name: 'Jurnal Nomi',
    issn: 'ISSN',
    description: 'Tavsif',
    journal_admin: 'Jurnal Admini',
    category: 'Nashr turi (rukn)',
    scientific_fields: 'Soha',
    country: 'Davlat',
    website: 'Jurnal sayti',
    publication_fee: 'Narx',
    price_per_page: 'Narx',
    image_url: 'Rasm',
};

function journalFieldErrors(body: unknown, t: (s: string) => string): string | null {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
    const lines = Object.entries(body as Record<string, unknown>)
        .filter(([, v]) => typeof v === 'string' || (Array.isArray(v) && v.every((x) => typeof x === 'string')))
        .filter(([k]) => !['detail', 'error', 'message'].includes(k))
        .map(([k, v]) => `${t(JOURNAL_FIELD_LABELS[k] || k)}: ${Array.isArray(v) ? v.join(' ') : v}`);
    return lines.length ? lines.join('\n') : null;
}

const JournalManagement: React.FC = () => {
    const { t } = useT();
    const { user } = useAuth();
    const [journals, setJournals] = useState<Journal[]>([]);
    const [categories, setCategories] = useState<JournalCategory[]>([]);
    /** Soha (fan yo'nalishlari) — rukndan alohida ro'yxat */
    const [fields, setFields] = useState<ScientificFieldItem[]>([]);
    const [fieldSearch, setFieldSearch] = useState('');
    const [selectedFieldFilter, setSelectedFieldFilter] = useState<string>('all');
    const [removeImage, setRemoveImage] = useState(false);
    const [users, setUsers] = useState<any[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    
    const [editingJournal, setEditingJournal] = useState<Journal | null>(null);
    const [deletingJournal, setDeletingJournal] = useState<Journal | null>(null);
    
    const initialNewJournalState: Partial<Journal> & { additionalDocumentConfig: AdditionalDocumentConfig; scientificFieldIds: string[] } = {
        name: '',
        issn: '',
        country: '',
        website: '',
        description: '',
        journalAdminId: '',
        categoryId: '',
        publicationFee: 0,
        pricePerPage: 0,
        imageUrl: '',
        paymentModel: PaymentModel.PostPayment,
        pricingType: JournalPricingType.Fixed,
        additionalDocumentConfig: {
            required: false,
            label: 'Taqriz fayli',
            type: 'file',
        },
        plagiarism_max_percent: undefined,
        ai_content_max_percent: undefined,
        originality_min_percent: undefined,
        scientificFieldIds: [],
    };
    const [formData, setFormData] = useState<Partial<Journal> & { additionalDocumentConfig?: AdditionalDocumentConfig; scientificFieldIds?: string[] }>(initialNewJournalState);
    const [imageFile, setImageFile] = useState<File | null>(null);
    
    // Fetch data from API
    useEffect(() => {
        const fetchData = async () => {
            if (!user || user.role !== Role.SuperAdmin) return;
            
            try {
                setLoading(true);
                setError(null);
                
                // Fetch all required data in parallel
                const [journalsData, categoriesData, usersData, fieldsData] = await Promise.all([
                    apiService.journals.list(),
                    apiService.journals.listCategories(),
                    apiService.users.list(),
                    apiService.scientificFields.list().catch(() => []),
                ]);
                
                // Ensure we're working with arrays - handle various response formats
                const processApiResponse = (data: any): any[] => {
                    if (Array.isArray(data)) {
                        return data;
                    }
                    if (data?.data && Array.isArray(data.data)) {
                        return data.data;
                    }
                    if (data?.results && Array.isArray(data.results)) {
                        return data.results;
                    }
                    return [];
                };
                
                const journalsArray = processApiResponse(journalsData);
                const categoriesArray = processApiResponse(categoriesData);
                const usersArray = processApiResponse(usersData);
                
                setJournals(journalsArray);
                setCategories(categoriesArray);
                setUsers(usersArray);
                setFields(processApiResponse(fieldsData));
            } catch (err: any) {
                console.error('Failed to fetch data:', err);
                setError(t("Ma'lumotlarni yuklashda xatolik yuz berdi."));
            } finally {
                setLoading(false);
            }
        };
        
        fetchData();
    }, [user]);
    
    // Only journal admins (not reviewers) can be assigned as journal admin
    const journalAdmins = users.filter(u =>
        u.role === Role.JournalAdmin || u.role === 'journal_admin'
    );
    


    if (user?.role !== Role.SuperAdmin) {
        return <Card title={t('Ruxsat Rad Etildi')}><p>{t("Ushbu sahifani ko'rish uchun sizda yetarli ruxsat yo'q.")}</p></Card>;
    }
    
    if (loading) {
        return <ListSkeleton rows={6} />;
    }
    
    if (error) {
        return (
            <Card title={t('Xatolik')}>
                <p className="text-red-700">{error}</p>
                <Button onClick={() => window.location.reload()} className="mt-4">{t('Qayta urinish')}</Button>
            </Card>
        );
    }

    const handleOpenModal = (journalToEdit: Journal | null = null) => {
        if (journalToEdit) {
            setEditingJournal(journalToEdit);
            // Handle both field name formats when editing
            const j = journalToEdit as any;
            const formDataWithCamelCase: any = {
                ...journalToEdit,
                journalAdminId: journalToEdit.journalAdminId || j.journal_admin,
                categoryId: journalToEdit.categoryId || j.category,
                paymentModel: journalToEdit.paymentModel || j.payment_model,
                pricingType: journalToEdit.pricingType || j.pricing_type,
                publicationFee: journalToEdit.publicationFee !== undefined ? journalToEdit.publicationFee : j.publication_fee,
                pricePerPage: journalToEdit.pricePerPage !== undefined ? journalToEdit.pricePerPage : j.price_per_page,
                plagiarism_max_percent: journalToEdit.plagiarism_max_percent ?? j.plagiarism_max_percent ?? undefined,
                ai_content_max_percent: journalToEdit.ai_content_max_percent ?? j.ai_content_max_percent ?? undefined,
                originality_min_percent: journalToEdit.originality_min_percent ?? j.originality_min_percent ?? undefined,
                additionalDocumentConfig: j.additional_document_config || journalToEdit.additionalDocumentConfig || initialNewJournalState.additionalDocumentConfig,
                scientificFieldIds: (j.scientific_fields || []).map(String),
                country: j.country || '',
                website: j.website || '',
                imageUrl: '',
            };
            setFormData(formDataWithCamelCase);
        } else {
            setEditingJournal(null);
            setFormData(initialNewJournalState);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setIsAddingCategory(false);
        setNewCategoryName('');
        setEditingJournal(null);
        setDeletingJournal(null);
        setImageFile(null);
        setRemoveImage(false);
        setFieldSearch('');
        // Reset image preview
        setFormData(prev => ({ ...prev, imageUrl: '' }));
    };

    /** Qidiruvga mos (ko'rinib turgan) sohalarning barchasini belgilash yoki olib tashlash */
    const toggleAllFields = (ids: string[], select: boolean) => {
        setFormData((prev) => {
            const cur = new Set(prev.scientificFieldIds || []);
            ids.forEach((id) => (select ? cur.add(id) : cur.delete(id)));
            return { ...prev, scientificFieldIds: [...cur] };
        });
    };

    const toggleField = (id: string) => {
        setFormData((prev) => {
            const cur = new Set(prev.scientificFieldIds || []);
            if (cur.has(id)) cur.delete(id);
            else cur.add(id);
            return { ...prev, scientificFieldIds: [...cur] };
        });
    };

    const visibleFields = fields.filter((f) => !fieldSearch.trim() || normCategory(f.name).includes(normCategory(fieldSearch)));
    const allVisibleFieldsSelected =
        visibleFields.length > 0 && visibleFields.every((f) => (formData.scientificFieldIds || []).includes(String(f.id)));
    // Davlat — erkin matn; avval kiritilganlar va keng tarqalganlari taklif sifatida
    const countryOptions = Array.from(new Set([
        ...COMMON_COUNTRIES,
        ...journals.map((j) => ((j as any).country || '').trim()).filter(Boolean),
    ])).sort((a, b) => a.localeCompare(b));

    /**
     * Rukn (nashr turi) tanlovi: 8 ta standart nashr turi (bazada bo'lmasa — "new:<nom>", saqlashda yaratiladi)
     * + qo'shimcha qo'shilgan turlar. Eski "soha" ruknlari (Iqtisodiyot, Pedagogika ...) bu yerda ko'rinmaydi —
     * soha endi alohida tanlanadi; faqat tahrirlanayotgan jurnalning joriy rukni bo'lsa "(eski)" deb chiqadi.
     */
    const categoryOptions = (() => {
        const opts: { value: string; label: string }[] = [];
        const used = new Set<string>();
        PUBLICATION_TYPES.forEach((name) => {
            // "Mahalliy OAK jurnali" (eski yozuv) standart "Mahalliy OAK jurnallari" bilan bitta tur — dublikat chiqmasin
            const existing = categories.find((c) => sameCategory(c.name, name));
            opts.push({ value: existing ? existing.id : `new:${name}`, label: name });
            used.add(publicationTypeKey(name));
        });
        categories
            .filter((c) => c.kind !== 'subject' && !used.has(publicationTypeKey(c.name)))
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach((c) => opts.push({ value: c.id, label: c.name }));
        const current = categories.find((c) => c.id === formData.categoryId);
        if (current && !opts.some((o) => o.value === current.id)) {
            opts.push({ value: current.id, label: `${current.name} (${t('eski rukn — nashr turini tanlang')})` });
        }
        return opts;
    })();
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({...prev, [name]: value}));
    };
    
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            // Set a preview URL for display purposes
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, imageUrl: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAdditionalDocConfigChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const isCheckbox = type === 'checkbox';
        const checked = (e.target as HTMLInputElement).checked;

        setFormData(prev => ({
            ...prev,
            additionalDocumentConfig: {
                ...prev!.additionalDocumentConfig!,
                [name]: isCheckbox ? checked : value,
            }
        }));
    };
    
    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) {
            alert(t('Kategoriya nomini kiriting.'));
            return;
        }
        
        try {
            const newCategoryData = {
                name: newCategoryName.trim(),
            };
            
            const newCategory = await apiService.journals.createCategory(newCategoryData);
            setCategories(prev => [...prev, newCategory]);
            setFormData(prev => ({...prev, categoryId: newCategory.id}));
            setNewCategoryName('');
            setIsAddingCategory(false);
        } catch (err: any) {
            console.error('Failed to add category:', err);
            alert(t("Kategoriya qo'shishda xatolik yuz berdi: {value}", { value: err.message || 'Unknown error' }));
        }
    };

    const handleDeleteCategory = async (categoryId: string) => {
        const isCategoryInUse = journals.some(j => (j.categoryId || (j as any).category) === categoryId);
        if (isCategoryInUse) {
            alert(t("Ushbu kategoriya jurnallar tomonidan ishlatilmoqda va o'chirib bo'lmaydi."));
            return;
        }
        
        if (window.confirm(t("Haqiqatan ham ushbu kategoriyani o'chirmoqchimisiz?"))) {
            try {
                await apiService.journals.deleteCategory(categoryId);
                setCategories(prev => prev.filter(c => c.id !== categoryId));
                // If the deleted category was selected, reset it
                if (formData.categoryId === categoryId) {
                    setFormData(prev => ({...prev, categoryId: ''}));
                }
            } catch (err: any) {
                console.error('Failed to delete category:', err);
                alert(t("Kategoriyani o'chirishda xatolik yuz berdi: {value}", { value: err.message || 'Unknown error' }));
            }
        }
    };

    const getJournalCategoryId = (journal: Journal) => journal.categoryId || (journal as any).category || 'uncategorized';

    const journalFieldIds = (journal: Journal): string[] => ((journal as any).scientific_fields || []).map(String);
    const filteredJournals = journals
        .filter(journal => selectedCategoryFilter === 'all' || getJournalCategoryId(journal) === selectedCategoryFilter)
        .filter(journal => selectedFieldFilter === 'all' || journalFieldIds(journal).includes(selectedFieldFilter));

    const groupedJournals = filteredJournals.reduce<Record<string, Journal[]>>((acc, journal) => {
        const categoryId = getJournalCategoryId(journal);
        if (!acc[categoryId]) {
            acc[categoryId] = [];
        }
        acc[categoryId].push(journal);
        return acc;
    }, {});

    const orderedCategoryIds = Object.keys(groupedJournals).sort((a, b) => {
        if (a === 'uncategorized') return 1;
        if (b === 'uncategorized') return -1;
        const aName = categories.find(c => c.id === a)?.name || '';
        const bName = categories.find(c => c.id === b)?.name || '';
        return aName.localeCompare(bName);
    });

    const handleSaveJournal = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.name || !formData.categoryId || !formData.journalAdminId) {
            alert(t("Iltimos, Jurnal Nomi, Kategoriyasi va Admini maydonlarini to'ldiring."));
            return;
        }
        // Rukn: mavjud ID yoki bazada hali yo'q standart nashr turi (server nom bo'yicha yaratadi)
        const categoryPayload = String(formData.categoryId).startsWith('new:')
            ? { category_name: String(formData.categoryId).slice(4) }
            : { category: formData.categoryId };
        const taxonomyPayload = {
            ...categoryPayload,
            scientific_fields: formData.scientificFieldIds || [],
            ...(removeImage && !imageFile ? { remove_image: true } : {}),
        };

        try {
            if (editingJournal) {
                // Update existing journal - convert to backend expected format
                // Build journal data object, excluding empty fields
                const updatedJournalData: any = {
                    name: formData.name,
                    issn: formData.issn || '',
                    country: (formData.country || '').trim(),
                    website: (formData.website || '').trim(),
                    description: formData.description || '',
                    journal_admin: formData.journalAdminId,
                    ...taxonomyPayload,
                    payment_model: formData.paymentModel || PaymentModel.PostPayment,
                    pricing_type: formData.pricingType || JournalPricingType.Fixed,
                    publication_fee: Number(formData.publicationFee) || 0,
                    price_per_page: Number(formData.pricePerPage) || 0,
                    plagiarism_max_percent: optionalJournalPercent(formData.plagiarism_max_percent),
                    ai_content_max_percent: optionalJournalPercent(formData.ai_content_max_percent),
                    originality_min_percent: optionalJournalPercent(formData.originality_min_percent),
                };
                
                // Only include additional_document_config if it exists and has content
                if (formData.additionalDocumentConfig) {
                    updatedJournalData.additional_document_config = {
                        required: Boolean(formData.additionalDocumentConfig.required),
                        label: formData.additionalDocumentConfig.label || 'Taqriz fayli',
                        type: formData.additionalDocumentConfig.type || 'file'
                    };
                }
                
                const updatedJournal = await apiService.journals.update(editingJournal.id, updatedJournalData, imageFile || undefined);
                const updatedJournals = journals.map(j => 
                    j.id === editingJournal.id ? updatedJournal : j
                );
                setJournals(updatedJournals);
            } else {
                // Create new journal - convert to backend expected format
                // Build journal data object, excluding empty fields
                const newJournalData: any = {
                    name: formData.name,
                    issn: formData.issn || '',
                    country: (formData.country || '').trim(),
                    website: (formData.website || '').trim(),
                    description: formData.description || '',
                    journal_admin: formData.journalAdminId,
                    ...taxonomyPayload,
                    payment_model: formData.paymentModel || PaymentModel.PostPayment,
                    pricing_type: formData.pricingType || JournalPricingType.Fixed,
                    publication_fee: Number(formData.publicationFee) || 0,
                    price_per_page: Number(formData.pricePerPage) || 0,
                    plagiarism_max_percent: optionalJournalPercent(formData.plagiarism_max_percent),
                    ai_content_max_percent: optionalJournalPercent(formData.ai_content_max_percent),
                    originality_min_percent: optionalJournalPercent(formData.originality_min_percent),
                };
                
                // Only include additional_document_config if it exists and has content
                if (formData.additionalDocumentConfig) {
                    newJournalData.additional_document_config = {
                        required: Boolean(formData.additionalDocumentConfig.required),
                        label: formData.additionalDocumentConfig.label || 'Taqriz fayli',
                        type: formData.additionalDocumentConfig.type || 'file'
                    };
                }
                
                const newJournal = await apiService.journals.create(newJournalData, imageFile || undefined);
                setJournals(prev => [newJournal, ...prev]);
            }
            
            // Reset image file state
            setImageFile(null);
            handleCloseModal();
        } catch (err: any) {
            console.error('Failed to save journal:', err);
            // Try to get more detailed error information
            let errorMessage = t('Jurnalni saqlashda xatolik yuz berdi');
            const fieldErrors = journalFieldErrors(err?.response, t);
            if (fieldErrors) {
                // Maydon xatolari forma yorliqlari bilan ("ISSN: ...", "Tavsif: ..."), API nomlari ("issn:") emas
                errorMessage += `:\n${fieldErrors}`;
            } else if (err.message) {
                errorMessage += `: ${err.message}`;
            } else if (typeof err === 'string') {
                errorMessage += `: ${err}`;
            } else if (err.detail) {
                errorMessage += `: ${err.detail}`;
            } else if (err.error) {
                errorMessage += `: ${err.error}`;
            }
            alert(errorMessage);
        }
    };

    const handleDeleteClick = (journalToDelete: Journal) => {
        setDeletingJournal(journalToDelete);
    };
    
    const confirmDelete = async () => {
        if (deletingJournal) {
            try {
                const res: any = await apiService.journals.delete(deletingJournal.id);
                if (res?.archived) {
                    // Maqolasi bor jurnal arxivlandi (katalogda ko'rinmaydi, maqolalar saqlanadi)
                    setJournals(prev => prev.map(j => (j.id === deletingJournal.id ? ({ ...j, is_archived: true } as any) : j)));
                    alert(res.message || t("Jurnal arxivga o'tkazildi."));
                } else {
                    setJournals(prev => prev.filter(j => j.id !== deletingJournal.id));
                }
                setDeletingJournal(null);
            } catch (err: any) {
                console.error('Failed to delete journal:', err);
                alert(t("Jurnalni o'chirishda xatolik yuz berdi: {value}", { value: err.message || 'Unknown error' }));
            }
        }
    };
    
    const restoreJournal = async (journal: Journal) => {
        try {
            const updated = await apiService.journals.restore(journal.id);
            setJournals(prev => prev.map(j => (j.id === journal.id ? updated : j)));
        } catch (err: any) {
            alert(t('Xatolik: {value}', { value: err?.message || '' }));
        }
    };

    return (
        <>
            <div className="space-y-6 max-w-6xl mx-auto">
            <EditorialPageHeader
                title={t('Jurnallarni boshqarish')}
                subtitle={t('Platforma jurnallarini yaratish, tahrirlash va kategoriyalash.')}
                actions={
                    <Button onClick={() => handleOpenModal()}><PlusCircle className="mr-2 h-4 w-4"/> {t("Yangi Jurnal Qo'shish")}</Button>
                }
            />
            <Card>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0">
                        <label className="editorial-field-label">{t("Kategoriya bo'yicha:")}</label>
                        <select
                            value={selectedCategoryFilter}
                            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                            className="editorial-select w-full sm:w-auto sm:min-w-[220px]"
                        >
                            <option value="all">{t('Barcha kategoriyalar')}</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0">
                        <label className="editorial-field-label">{t("Soha bo'yicha:")}</label>
                        <select
                            value={selectedFieldFilter}
                            onChange={(e) => setSelectedFieldFilter(e.target.value)}
                            className="editorial-select w-full sm:w-auto sm:min-w-[220px]"
                        >
                            <option value="all">{t('Barcha sohalar')}</option>
                            {fields.map(f => (
                                <option key={f.id} value={String(f.id)}>{f.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="space-y-4">
                    {orderedCategoryIds.length === 0 && (
                        <div className="editorial-empty py-8">
                            {t("Tanlangan kategoriya bo'yicha jurnal topilmadi.")}
                        </div>
                    )}
                    {orderedCategoryIds.map(categoryId => {
                        const categoryName = categoryId === 'uncategorized'
                            ? "Kategoriyasiz"
                            : (categories.find(c => c.id === categoryId)?.name || "Noma'lum kategoriya");

                        return (
                            <div key={categoryId} className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-serif font-semibold uppercase tracking-wide text-[var(--editorial-primary)]">{categoryName}</h4>
                                    <span className="text-xs text-[var(--editorial-muted)]">{t('{length} ta jurnal', { length: groupedJournals[categoryId].length })}</span>
                                </div>
                                {groupedJournals[categoryId].map(journal => {
                        // Handle both field name formats (camelCase from frontend, snake_case from backend)
                        const adminId = journal.journalAdminId || (journal as any).journal_admin;
                        const categoryId = journal.categoryId || (journal as any).category;
                        const pricingType = journal.pricingType || (journal as any).pricing_type;
                        const publicationFee = journal.publicationFee !== undefined ? journal.publicationFee : (journal as any).publication_fee;
                        const pricePerPage = journal.pricePerPage !== undefined ? journal.pricePerPage : (journal as any).price_per_page;
                        
                        const admin = users.find(u => u.id === adminId);
                        const category = categories.find(c => c.id === categoryId);
                        
                        const priceText = pricingType === JournalPricingType.Fixed
                            ? `${(publicationFee || 0).toLocaleString()} so'm`
                            : `${(pricePerPage || 0).toLocaleString()} so'm / sahifa`;

                        // Handle image URL for display (check both field name formats)
                        const imageUrl = journal.imageUrl || (journal as any).image_url;
                        
                        return (
                            <div key={journal.id} className="editorial-card flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                <div className="flex items-start gap-4">
                                    {imageUrl && (
                                        <img 
                                            src={imageUrl} 
                                            alt={t('Jurnal rasmi')} 
                                            className="h-16 w-16 rounded-md object-cover flex-shrink-0 border border-[var(--editorial-border)]"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                        />
                                    )}
                                    <div>
                                        <h4 className="font-serif font-semibold text-lg text-[var(--editorial-text)]">{journal.name}</h4>
                                        <p className="text-sm text-[var(--editorial-muted)]">
                                            {t('Admin:')} {admin ? personFullName(admin) : t('Tayinlanmagan')}
                                            <span className="mx-2">•</span>
                                            {t('Kategoriya:')} <span className="font-medium text-[var(--editorial-primary)]">{category?.name || t("Noma'lum")}</span>
                                            <span className="mx-2">•</span>
                                            {t('Narx:')} <span className="font-medium text-[var(--editorial-teal)]">{priceText}</span>
                                        </p>
                                        <p className="text-xs text-[var(--editorial-muted)] font-mono mt-1">ISSN: {journal.issn}</p>
                                        {((journal as any).scientific_field_names || []).length > 0 && (
                                            <p className="text-xs text-[var(--editorial-muted)] mt-1">
                                                {t('Soha:')} <span className="text-[var(--editorial-text)]">{(journal as any).scientific_field_names.join(', ')}</span>
                                            </p>
                                        )}
                                        {(journal as any).is_sample && (
                                            <p className="mt-1 text-xs text-[var(--editorial-muted)]">
                                                {t("Namuna (demo) jurnal — haqiqiy mualliflarga ko'rsatilmaydi.")}
                                            </p>
                                        )}
                                        {(journal as any).is_archived && (
                                            <span className="inline-flex items-center gap-1 mt-1 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                                                <Archive size={12} /> {t('Arxivda — katalogda ko\'rinmaydi')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2 mt-3 sm:mt-0">
                                    <button onClick={() => handleOpenModal(journal)} className="text-[var(--editorial-primary)] hover:opacity-80 p-2 rounded-md transition-colors" aria-label={t('Tahrirlash')}><Edit size={18}/></button>
                                    {/* Ichki (kitob buyurtmalari) jurnali o'chirilmaydi */}
                                    {(journal as any).is_archived && (
                                        <button onClick={() => restoreJournal(journal)} className="text-[var(--editorial-teal)] hover:opacity-80 p-2 rounded-md transition-colors" aria-label={t('Tiklash')} title={t('Tiklash')}><RotateCcw size={18}/></button>
                                    )}
                                    {!(journal as any).is_internal && !(journal as any).is_archived && (
                                        <button onClick={() => handleDeleteClick(journal)} className="text-red-700 hover:opacity-80 p-2 rounded-md transition-colors" aria-label={t("O'chirish")}><Trash2 size={18}/></button>
                                    )}
                                </div>
                            </div>
                        );
                                })}
                            </div>
                        );
                    })}
                </div>
            </Card>
            </div>

            {isModalOpen && (
                 <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 p-4 overflow-auto min-h-screen flex flex-col items-center py-8">
                    <Card className="w-full max-w-2xl min-w-0 max-h-[90vh] flex flex-col overflow-hidden my-auto shrink-0" title={editingJournal ? t('Jurnalni Tahrirlash') : t("Yangi Jurnal Qo'shish")}>
                        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1 -mr-1">
                        {editingJournal && (
                            <div className="mb-4">
                                <h3 className="text-lg font-medium text-slate-900 mb-2">{t('Jurnal Rasmi')}</h3>
                                {(editingJournal as any).imageUrl || (editingJournal as any).image_url ? (
                                    <img 
                                        src={(editingJournal as any).imageUrl || (editingJournal as any).image_url} 
                                        alt={t('Jurnal rasmi')} 
                                        className="h-32 w-32 rounded-lg object-cover"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                    />
                                ) : (
                                    <p className="text-slate-500 text-sm">{t('Rasm mavjud emas')}</p>
                                )}
                                {((editingJournal as any).image_url) && !imageFile && (
                                    <label className="mt-2 flex items-center gap-2 text-sm text-red-700 cursor-pointer">
                                        <input type="checkbox" checked={removeImage} onChange={(e) => setRemoveImage(e.target.checked)} />
                                        {t("Joriy rasmni o'chirish")}
                                    </label>
                                )}
                            </div>
                        )}
                        <form onSubmit={handleSaveJournal} className="space-y-4 min-w-0">
                            <div className="min-w-0">
                                <label className="block text-sm font-medium text-slate-600 mb-2">{t('Jurnal Nomi')}</label>
                                <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full min-w-0 box-border" placeholder={t('Jurnal nomini kiriting...')} required/>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-2">{t('Nashr turi (rukn)')}</label>
                                    {isAddingCategory ? (
                                        <div className="flex items-center gap-2">
                                            <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} className="w-full" placeholder={t('Yangi kategoriya nomi')} autoFocus/>
                                            <Button type="button" onClick={handleAddCategory} className="!p-3 !rounded-lg"><Check size={20}/></Button>
                                            <Button type="button" variant="secondary" onClick={() => setIsAddingCategory(false)} className="!p-3 !rounded-lg"><X size={20}/></Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <select name="categoryId" value={formData.categoryId} onChange={handleInputChange} className="w-full" required>
                                                <option value="" disabled>{t('Nashr turini tanlang')}</option>
                                                {categoryOptions.map(o => (
                                                    <option key={o.value} value={o.value}>{t(o.label)}</option>
                                                ))}
                                            </select>
                                            <Button type="button" onClick={() => setIsAddingCategory(true)} className="!p-2.5 !rounded-lg" title={t("Yangi kategoriya qo'shish")}><PlusCircle size={18}/></Button>
                                            {formData.categoryId && !String(formData.categoryId).startsWith('new:') && (
                                                <Button type="button" variant="danger" onClick={() => handleDeleteCategory(formData.categoryId!)} className="!p-2.5 !rounded-lg" title={t("Tanlangan kategoriyani o'chirish")}><Trash2 size={18}/></Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-2">{t('Jurnal Admini')}</label>
                                    <select name="journalAdminId" value={formData.journalAdminId} onChange={handleInputChange} className="w-full" required>
                                        <option value="" disabled>{t('Adminni tanlang')}</option>
                                        {journalAdmins.map(admin => (
                                            <option key={admin.id} value={admin.id}>{personFullName(admin)}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="min-w-0">
                                <label className="block text-sm font-medium text-slate-600 mb-1">
                                    {t('Jurnal sohasi')}{' '}
                                    <span className="text-xs text-slate-500">({t('bir nechtasini tanlash mumkin')}: {(formData.scientificFieldIds || []).length})</span>
                                </label>
                                <input
                                    type="text"
                                    value={fieldSearch}
                                    onChange={(e) => setFieldSearch(e.target.value)}
                                    placeholder={t('Sohani qidirish...')}
                                    className="w-full mb-2"
                                />
                                {visibleFields.length > 0 && (
                                    <label className="flex items-center gap-2 text-sm font-semibold px-2 py-1.5 mb-1 rounded bg-slate-50 border border-slate-200 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={allVisibleFieldsSelected}
                                            onChange={() => toggleAllFields(visibleFields.map((f) => String(f.id)), !allVisibleFieldsSelected)}
                                        />
                                        {fieldSearch.trim() ? t('Topilganlarning barchasini tanlash') : t('Barchasini tanlash')}
                                    </label>
                                )}
                                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                                    {visibleFields
                                        .map((f) => (
                                            <label key={f.id} className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-slate-100 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={(formData.scientificFieldIds || []).includes(String(f.id))}
                                                    onChange={() => toggleField(String(f.id))}
                                                />
                                                <span className="break-words">{t(f.name)}</span>
                                            </label>
                                        ))}
                                    {fields.length === 0 && <p className="text-xs text-slate-500 p-2">{t('Sohalar ro\'yxati yuklanmadi')}</p>}
                                </div>
                            </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
                                <div className="min-w-0">
                                    <label className="block text-sm font-medium text-slate-600 mb-2">{t('Narx Turi')}</label>
                                    <select name="pricingType" value={formData.pricingType} onChange={handleInputChange} className="w-full">
                                        <option value={JournalPricingType.Fixed}>{t("Qat'iy narx")}</option>
                                        <option value={JournalPricingType.PerPage}>{t('Sahifa uchun')}</option>
                                    </select>
                                </div>
                                {formData.pricingType === JournalPricingType.Fixed ? (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-2">{t("Chop etish narxi (so'm)")}</label>
                                        <input type="number" name="publicationFee" value={formData.publicationFee || ''} onChange={handleInputChange} className="w-full" placeholder="200000"/>
                                    </div>
                                ) : (
                                     <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-2">{t("Sahifa narxi (so'm)")}</label>
                                        <input type="number" name="pricePerPage" value={formData.pricePerPage || ''} onChange={handleInputChange} className="w-full" placeholder="15000"/>
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
                                <div className="min-w-0">
                                    <label className="block text-sm font-medium text-slate-600 mb-2">ISSN <span className="font-normal text-slate-400">{t('(ixtiyoriy)')}</span></label>
                                    <input type="text" name="issn" value={formData.issn} onChange={handleInputChange} className="w-full min-w-0 box-border" placeholder="XXXX-XXXX"/>
                                </div>
                                <div className="min-w-0">
                                    <label className="block text-sm font-medium text-slate-600 mb-2">{t('Davlat')}</label>
                                    <input type="text" name="country" value={formData.country || ''} onChange={handleInputChange} list="journal-country-options" className="w-full min-w-0 box-border" placeholder="O'zbekiston" maxLength={100}/>
                                    <datalist id="journal-country-options">
                                        {countryOptions.map((c) => <option key={c} value={c} />)}
                                    </datalist>
                                </div>
                                <div className="min-w-0">
                                    <label className="block text-sm font-medium text-slate-600 mb-2">{t('Jurnal sayti')} <span className="font-normal text-slate-400">{t('(ixtiyoriy)')}</span></label>
                                    <input type="text" inputMode="url" name="website" value={formData.website || ''} onChange={handleInputChange} className="w-full min-w-0 box-border" placeholder="https://jurnal.uz" maxLength={500}/>
                                </div>
                                <div className="min-w-0">
                                    <label className="block text-sm font-medium text-slate-600 mb-2">{t("To'lov Turi")}</label>
                                    <select name="paymentModel" value={formData.paymentModel} onChange={handleInputChange} className="w-full min-w-0 box-border">
                                        <option value={PaymentModel.PrePayment}>{t('Maqola qabul qilinishidan oldin')}</option>
                                        <option value={PaymentModel.PostPayment}>{t("Maqola qabul qilinganidan so'ng")}</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-2">{t('Jurnal Rasmi')}</label>
                                {formData.imageUrl ? (
                                    <div className="mt-2 flex items-center gap-4">
                                        <img src={formData.imageUrl} alt={t('Jurnal rasmi')} className="h-24 w-48 rounded-lg object-cover" />
                                        <div>
                                            <label htmlFor="journal-image-upload" className="cursor-pointer bg-white/10 rounded-md py-2 px-3 text-sm font-medium text-blue-900 hover:text-blue-800 hover:bg-white/20">
                                                {t("O'zgartirish")}
                                            </label>
                                            <input id="journal-image-upload" name="journal-image-upload" type="file" className="sr-only" accept="image/png, image/jpeg" onChange={handleImageChange} />
                                            <button type="button" onClick={() => { setImageFile(null); setFormData(prev => ({...prev, imageUrl: ''})); }} className="ml-3 text-red-700 hover:text-red-800 text-sm">
                                                {t("O'chirish")}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-2">
                                        <label htmlFor="journal-image-upload" className="cursor-pointer">
                                            <div className="p-8 border-2 border-dashed rounded-lg border-slate-200 text-center bg-slate-100/70 hover:bg-white/10 transition-colors">
                                                <UploadCloud className="mx-auto h-12 w-12 text-slate-500" />
                                                <p className="mt-2 text-sm text-slate-500">{t('Rasm yuklang (JPG, PNG)')}</p>
                                            </div>
                                            <input id="journal-image-upload" name="journal-image-upload" type="file" className="sr-only" accept="image/png, image/jpeg" onChange={handleImageChange} />
                                        </label>
                                    </div>
                                )}
                            </div>
                            <div className="pt-4 border-t border-slate-200/90 min-w-0">
                                <h4 className="text-sm font-semibold text-blue-900 mb-3">{t('Antiplagiat & AI Detektor talablari')}</h4>
                                <p className="text-xs text-slate-500 mb-3">{t("Maqola nashrga yuborilganda tekshiriladi. Bo'sh qoldirilsa — shart o'rnatilmaydi.")}</p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-1">{t('Plagiat max %')}</label>
                                        <input type="number" name="plagiarism_max_percent" min={0} max={100} step={0.1} value={formData.plagiarism_max_percent ?? ''} onChange={handleInputChange} className="w-full" placeholder={t('mas. 25')}/>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-1">{t('AI kontent max %')}</label>
                                        <input type="number" name="ai_content_max_percent" min={0} max={100} step={0.1} value={formData.ai_content_max_percent ?? ''} onChange={handleInputChange} className="w-full" placeholder={t('mas. 30')}/>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-1">{t('Originalilik min %')}</label>
                                        <input type="number" name="originality_min_percent" min={0} max={100} step={0.1} value={formData.originality_min_percent ?? ''} onChange={handleInputChange} className="w-full" placeholder={t('mas. 70')}/>
                                    </div>
                                </div>
                            </div>
                            <div className="min-w-0">
                                <label className="block text-sm font-medium text-slate-600 mb-2">{t('Tavsif')} <span className="font-normal text-slate-400">{t('(ixtiyoriy)')}</span></label>
                                <textarea name="description" value={formData.description} onChange={handleInputChange} className="w-full min-w-0 max-w-full box-border resize-y" rows={4} placeholder={t("Jurnal haqida qisqacha ma'lumot...")}></textarea>
                            </div>

                            <div className="pt-4 border-t border-slate-200/90 min-w-0">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input type="checkbox" name="required" checked={formData.additionalDocumentConfig?.required} onChange={handleAdditionalDocConfigChange} className="h-5 w-5 mt-0.5 shrink-0 rounded bg-white/10 border-slate-300/80 text-blue-500 focus:ring-blue-500" style={{boxShadow: 'none'}}/>
                                    <span className="font-medium text-slate-700 break-words">{t("Qo'shimcha hujjat talab qilish (masalan, taqriz)")}</span>
                                </label>
                                {formData.additionalDocumentConfig?.required && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pl-8">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-2">{t('Hujjat Nomi')}</label>
                                            <input type="text" name="label" value={formData.additionalDocumentConfig.label} onChange={handleAdditionalDocConfigChange} className="w-full" placeholder={t('Taqriz fayli')}/>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-2">{t('Hujjat Turi')}</label>
                                            <select name="type" value={formData.additionalDocumentConfig.type} onChange={handleAdditionalDocConfigChange} className="w-full">
                                                <option value="file">{t('Fayl yuklash')}</option>
                                                <option value="link">{t('Havola kiritish')}</option>
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-4 pt-4 border-t border-slate-200/90 mt-6">
                                <Button type="button" variant="secondary" onClick={handleCloseModal}>{t('Bekor qilish')}</Button>
                                <Button type="submit">{editingJournal ? t('Saqlash') : t("Qo'shish")}</Button>
                            </div>
                        </form>
                        </div>
                    </Card>
                </div>
            )}

            {deletingJournal && (
                <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md" title={t("O'chirishni tasdiqlang")}>
                        <div className="flex items-center gap-4 mb-4">
                            {(deletingJournal as any).imageUrl || (deletingJournal as any).image_url ? (
                                <img 
                                    src={(deletingJournal as any).imageUrl || (deletingJournal as any).image_url} 
                                    alt={t('Jurnal rasmi')} 
                                    className="h-16 w-16 rounded-lg object-cover"
                                    onError={(e) => {
                                        // Hide image if it fails to load
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            ) : null}
                            <div>
                                <h3 className="text-lg font-medium text-slate-900">{deletingJournal.name}</h3>
                                <p className="text-slate-500 text-sm">{t("Jurnalni o'chirish")}</p>
                            </div>
                        </div>
                        {/* Maqolasi bor jurnal o'chirilmaydi (server ham rad etadi) — avval maqolalar arxivi bilan o'chib ketardi */}
                        {Number((deletingJournal as any).articles_count || 0) > 0 ? (
                            <p className="text-amber-900 bg-amber-50 rounded-lg p-3 mb-6 text-sm">
                                {t("Bu jurnalda {count} ta maqola bor — jurnal arxivga o'tkaziladi: katalogda va maqola yuborishda ko'rinmaydi, nashr etilgan maqolalar va to'lovlar saqlanadi. Keyin qayta tiklash mumkin.", { count: Number((deletingJournal as any).articles_count) })}
                            </p>
                        ) : (
                            <p className="text-slate-600 mb-6">
                                {t('Haqiqatan ham')} <strong className="text-slate-900">{deletingJournal.name}</strong> {t("jurnalini o'chirmoqchimisiz? Bu harakatni bekor qilib bo'lmaydi.")}
                            </p>
                        )}
                        <div className="flex justify-end gap-4 mt-8">
                            <Button variant="secondary" onClick={() => setDeletingJournal(null)}>{t('Bekor qilish')}</Button>
                            <Button variant="danger" onClick={confirmDelete}>
                                {Number((deletingJournal as any).articles_count || 0) > 0 ? t('Arxivga o\'tkazish') : t("O'chirish")}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </>
    );
};

export default JournalManagement;