import React, { useState, useEffect } from 'react';
import Card from '../components/ui/Card';
import { useAuth } from '../contexts/AuthContext';
import { Role, Journal, JournalCategory, PaymentModel, JournalPricingType, AdditionalDocumentConfig } from '../types';
import Button from '../components/ui/Button';
import { Edit, Trash2, PlusCircle, X, Check, UploadCloud } from 'lucide-react';
import { apiService } from '../services/apiService';

/** Form may hold number | undefined; avoid comparing number to '' for tsc */
function optionalJournalPercent(v: unknown): number | null {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

const JournalManagement: React.FC = () => {
    const { user } = useAuth();
    const [journals, setJournals] = useState<Journal[]>([]);
    const [categories, setCategories] = useState<JournalCategory[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    
    const [editingJournal, setEditingJournal] = useState<Journal | null>(null);
    const [deletingJournal, setDeletingJournal] = useState<Journal | null>(null);
    
    const initialNewJournalState: Partial<Journal> & { additionalDocumentConfig: AdditionalDocumentConfig } = {
        name: '',
        issn: '',
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
    };
    const [formData, setFormData] = useState<Partial<Journal> & { additionalDocumentConfig?: AdditionalDocumentConfig }>(initialNewJournalState);
    const [imageFile, setImageFile] = useState<File | null>(null);
    
    // Fetch data from API
    useEffect(() => {
        const fetchData = async () => {
            if (!user || user.role !== Role.SuperAdmin) return;
            
            try {
                setLoading(true);
                setError(null);
                
                // Fetch all required data in parallel
                const [journalsData, categoriesData, usersData] = await Promise.all([
                    apiService.journals.list(),
                    apiService.journals.listCategories(),
                    apiService.users.list()
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
            } catch (err: any) {
                console.error('Failed to fetch data:', err);
                setError('Ma\'lumotlarni yuklashda xatolik yuz berdi.');
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
        return <Card title="Ruxsat Rad Etildi"><p>Ushbu sahifani ko'rish uchun sizda yetarli ruxsat yo'q.</p></Card>;
    }
    
    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }
    
    if (error) {
        return (
            <Card title="Xatolik">
                <p className="text-red-700">{error}</p>
                <Button onClick={() => window.location.reload()} className="mt-4">Qayta urinish</Button>
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
                additionalDocumentConfig: journalToEdit.additionalDocumentConfig || initialNewJournalState.additionalDocumentConfig,
                plagiarism_max_percent: journalToEdit.plagiarism_max_percent ?? j.plagiarism_max_percent ?? undefined,
                ai_content_max_percent: journalToEdit.ai_content_max_percent ?? j.ai_content_max_percent ?? undefined,
                originality_min_percent: journalToEdit.originality_min_percent ?? j.originality_min_percent ?? undefined,
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
        // Reset image preview
        setFormData(prev => ({ ...prev, imageUrl: '' }));
    };
    
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
            alert('Kategoriya nomini kiriting.');
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
            alert(`Kategoriya qo'shishda xatolik yuz berdi: ${err.message || 'Unknown error'}`);
        }
    };

    const handleDeleteCategory = async (categoryId: string) => {
        const isCategoryInUse = journals.some(j => (j.categoryId || (j as any).category) === categoryId);
        if (isCategoryInUse) {
            alert("Ushbu kategoriya jurnallar tomonidan ishlatilmoqda va o'chirib bo'lmaydi.");
            return;
        }
        
        if (window.confirm("Haqiqatan ham ushbu kategoriyani o'chirmoqchimisiz?")) {
            try {
                await apiService.journals.deleteCategory(categoryId);
                setCategories(prev => prev.filter(c => c.id !== categoryId));
                // If the deleted category was selected, reset it
                if (formData.categoryId === categoryId) {
                    setFormData(prev => ({...prev, categoryId: ''}));
                }
            } catch (err: any) {
                console.error('Failed to delete category:', err);
                alert(`Kategoriyani o'chirishda xatolik yuz berdi: ${err.message || 'Unknown error'}`);
            }
        }
    };

    const getJournalCategoryId = (journal: Journal) => journal.categoryId || (journal as any).category || 'uncategorized';

    const filteredJournals = selectedCategoryFilter === 'all'
        ? journals
        : journals.filter(journal => getJournalCategoryId(journal) === selectedCategoryFilter);

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
            alert("Iltimos, Jurnal Nomi, Kategoriyasi va Admini maydonlarini to'ldiring.");
            return;
        }

        try {
            if (editingJournal) {
                // Update existing journal - convert to backend expected format
                // Build journal data object, excluding empty fields
                const updatedJournalData: any = {
                    name: formData.name,
                    issn: formData.issn || '',
                    description: formData.description || '',
                    journal_admin: formData.journalAdminId,
                    category: formData.categoryId,
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
                
                // Handle image upload if we have an image file
                if (imageFile) {
                    try {
                        // For Django ImageField, we need to send the image as part of the main request
                        // We'll include it in the FormData for the journal update
                    } catch (uploadError: any) {
                        console.error('Failed to process image:', uploadError);
                        alert(`Rasmni qayta ishlashda xatolik yuz berdi: ${uploadError.message || 'Unknown error'}`);
                        return; // Don't update the journal if image processing fails
                    }
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
                    description: formData.description || '',
                    journal_admin: formData.journalAdminId,
                    category: formData.categoryId,
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
                
                // Handle image upload if we have an image file
                if (imageFile) {
                    try {
                        // For Django ImageField, we need to send the image as part of the main request
                        // We'll include it in the FormData for the journal creation
                    } catch (uploadError: any) {
                        console.error('Failed to process image:', uploadError);
                        alert(`Rasmni qayta ishlashda xatolik yuz berdi: ${uploadError.message || 'Unknown error'}`);
                        return; // Don't create the journal if image processing fails
                    }
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
            let errorMessage = 'Jurnalni saqlashda xatolik yuz berdi';
            if (err.message) {
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
                await apiService.journals.delete(deletingJournal.id);
                setJournals(prev => prev.filter(j => j.id !== deletingJournal.id));
                setDeletingJournal(null);
            } catch (err: any) {
                console.error('Failed to delete journal:', err);
                alert(`Jurnalni o'chirishda xatolik yuz berdi: ${err.message || 'Unknown error'}`);
            }
        }
    };
    
    return (
        <>
            <Card title="Jurnallarni Boshqarish">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <label className="text-sm text-slate-600">Kategoriya bo'yicha:</label>
                        <select
                            value={selectedCategoryFilter}
                            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                            className="min-w-[220px]"
                        >
                            <option value="all">Barcha kategoriyalar</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>
                    <Button onClick={() => handleOpenModal()}><PlusCircle className="mr-2 h-4 w-4"/> Yangi Jurnal Qo'shish</Button>
                </div>
                <div className="space-y-4">
                    {orderedCategoryIds.length === 0 && (
                        <div className="p-6 rounded-lg bg-slate-100/70 text-center text-slate-500">
                            Tanlangan kategoriya bo'yicha jurnal topilmadi.
                        </div>
                    )}
                    {orderedCategoryIds.map(categoryId => {
                        const categoryName = categoryId === 'uncategorized'
                            ? "Kategoriyasiz"
                            : (categories.find(c => c.id === categoryId)?.name || "Noma'lum kategoriya");

                        return (
                            <div key={categoryId} className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-semibold uppercase tracking-wide text-blue-900">{categoryName}</h4>
                                    <span className="text-xs text-slate-500">{groupedJournals[categoryId].length} ta jurnal</span>
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
                            <div key={journal.id} className="p-4 bg-slate-100/70 rounded-lg flex flex-col sm:flex-row justify-between sm:items-center">
                                <div className="flex items-start gap-4">
                                    {imageUrl && (
                                        <img 
                                            src={imageUrl} 
                                            alt="Jurnal rasmi" 
                                            className="h-16 w-16 rounded-lg object-cover flex-shrink-0"
                                            onError={(e) => {
                                                // Hide image if it fails to load
                                                (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                        />
                                    )}
                                    <div>
                                        <h4 className="font-semibold text-lg text-slate-900">{journal.name}</h4>
                                        <p className="text-sm text-slate-500">
                                            Admin: {admin ? `${admin.firstName || admin.first_name} ${admin.lastName || admin.last_name}` : 'Tayinlanmagan'}
                                            <span className="mx-2 text-gray-600">•</span>
                                            Kategoriya: <span className="font-medium text-blue-900">{category?.name || "Noma'lum"}</span>
                                            <span className="mx-2 text-gray-600">•</span>
                                            Narx: <span className="font-medium text-emerald-800">{priceText}</span>
                                        </p>
                                        <p className="text-xs text-slate-500 font-mono mt-1">ISSN: {journal.issn}</p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2 mt-3 sm:mt-0">
                                    <button onClick={() => handleOpenModal(journal)} className="text-indigo-400 hover:text-indigo-200 p-2 rounded-md hover:bg-white/10 transition-colors" aria-label="Tahrirlash"><Edit size={18}/></button>
                                    <button onClick={() => handleDeleteClick(journal)} className="text-red-700 hover:text-red-200 p-2 rounded-md hover:bg-white/10 transition-colors" aria-label="O'chirish"><Trash2 size={18}/></button>
                                </div>
                            </div>
                        );
                                })}
                            </div>
                        );
                    })}
                </div>
            </Card>

            {isModalOpen && (
                 <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 p-4 overflow-auto min-h-screen flex flex-col items-center py-8">
                    <Card className="w-full max-w-2xl min-w-0 max-h-[90vh] flex flex-col overflow-hidden my-auto shrink-0" title={editingJournal ? "Jurnalni Tahrirlash" : "Yangi Jurnal Qo'shish"}>
                        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1 -mr-1">
                        {editingJournal && (
                            <div className="mb-4">
                                <h3 className="text-lg font-medium text-slate-900 mb-2">Jurnal Rasmi</h3>
                                {(editingJournal as any).imageUrl || (editingJournal as any).image_url ? (
                                    <img 
                                        src={(editingJournal as any).imageUrl || (editingJournal as any).image_url} 
                                        alt="Jurnal rasmi" 
                                        className="h-32 w-32 rounded-lg object-cover"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                    />
                                ) : (
                                    <p className="text-slate-500 text-sm">Rasm mavjud emas</p>
                                )}
                            </div>
                        )}
                        <form onSubmit={handleSaveJournal} className="space-y-4 min-w-0">
                            <div className="min-w-0">
                                <label className="block text-sm font-medium text-slate-600 mb-2">Jurnal Nomi</label>
                                <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full min-w-0 box-border" placeholder="Jurnal nomini kiriting..." required/>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-2">Jurnal Kategoriyasi</label>
                                    {isAddingCategory ? (
                                        <div className="flex items-center gap-2">
                                            <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} className="w-full" placeholder="Yangi kategoriya nomi" autoFocus/>
                                            <Button type="button" onClick={handleAddCategory} className="!p-3 !rounded-lg"><Check size={20}/></Button>
                                            <Button type="button" variant="secondary" onClick={() => setIsAddingCategory(false)} className="!p-3 !rounded-lg"><X size={20}/></Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <select name="categoryId" value={formData.categoryId} onChange={handleInputChange} className="w-full" required>
                                                <option value="" disabled>Kategoriyani tanlang</option>
                                                {categories.map(cat => (
                                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                ))}
                                            </select>
                                            <Button type="button" onClick={() => setIsAddingCategory(true)} className="!p-2.5 !rounded-lg" title="Yangi kategoriya qo'shish"><PlusCircle size={18}/></Button>
                                            {formData.categoryId && (
                                                <Button type="button" variant="danger" onClick={() => handleDeleteCategory(formData.categoryId!)} className="!p-2.5 !rounded-lg" title="Tanlangan kategoriyani o'chirish"><Trash2 size={18}/></Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-2">Jurnal Admini</label>
                                    <select name="journalAdminId" value={formData.journalAdminId} onChange={handleInputChange} className="w-full" required>
                                        <option value="" disabled>Adminni tanlang</option>
                                        {journalAdmins.map(admin => (
                                            <option key={admin.id} value={admin.id}>{admin.firstName || admin.first_name} {admin.lastName || admin.last_name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
                                <div className="min-w-0">
                                    <label className="block text-sm font-medium text-slate-600 mb-2">Narx Turi</label>
                                    <select name="pricingType" value={formData.pricingType} onChange={handleInputChange} className="w-full">
                                        <option value={JournalPricingType.Fixed}>Qat'iy narx</option>
                                        <option value={JournalPricingType.PerPage}>Sahifa uchun</option>
                                    </select>
                                </div>
                                {formData.pricingType === JournalPricingType.Fixed ? (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-2">Chop etish narxi (so'm)</label>
                                        <input type="number" name="publicationFee" value={formData.publicationFee || ''} onChange={handleInputChange} className="w-full" placeholder="200000"/>
                                    </div>
                                ) : (
                                     <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-2">Sahifa narxi (so'm)</label>
                                        <input type="number" name="pricePerPage" value={formData.pricePerPage || ''} onChange={handleInputChange} className="w-full" placeholder="15000"/>
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
                                <div className="min-w-0">
                                    <label className="block text-sm font-medium text-slate-600 mb-2">ISSN</label>
                                    <input type="text" name="issn" value={formData.issn} onChange={handleInputChange} className="w-full min-w-0 box-border" placeholder="XXXX-XXXX"/>
                                </div>
                                <div className="min-w-0">
                                    <label className="block text-sm font-medium text-slate-600 mb-2">To'lov Turi</label>
                                    <select name="paymentModel" value={formData.paymentModel} onChange={handleInputChange} className="w-full min-w-0 box-border">
                                        <option value={PaymentModel.PrePayment}>Maqola qabul qilinishidan oldin</option>
                                        <option value={PaymentModel.PostPayment}>Maqola qabul qilinganidan so'ng</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-2">Jurnal Rasmi</label>
                                {formData.imageUrl ? (
                                    <div className="mt-2 flex items-center gap-4">
                                        <img src={formData.imageUrl} alt="Jurnal rasmi" className="h-24 w-48 rounded-lg object-cover" />
                                        <div>
                                            <label htmlFor="journal-image-upload" className="cursor-pointer bg-white/10 rounded-md py-2 px-3 text-sm font-medium text-blue-900 hover:text-blue-800 hover:bg-white/20">
                                                O'zgartirish
                                            </label>
                                            <input id="journal-image-upload" name="journal-image-upload" type="file" className="sr-only" accept="image/png, image/jpeg" onChange={handleImageChange} />
                                            <button type="button" onClick={() => setFormData(prev => ({...prev, imageUrl: ''}))} className="ml-3 text-red-700 hover:text-red-800 text-sm">
                                                O'chirish
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-2">
                                        <label htmlFor="journal-image-upload" className="cursor-pointer">
                                            <div className="p-8 border-2 border-dashed rounded-lg border-slate-200 text-center bg-slate-100/70 hover:bg-white/10 transition-colors">
                                                <UploadCloud className="mx-auto h-12 w-12 text-slate-500" />
                                                <p className="mt-2 text-sm text-slate-500">Rasm yuklang (JPG, PNG)</p>
                                            </div>
                                            <input id="journal-image-upload" name="journal-image-upload" type="file" className="sr-only" accept="image/png, image/jpeg" onChange={handleImageChange} />
                                        </label>
                                    </div>
                                )}
                            </div>
                            <div className="pt-4 border-t border-slate-200/90 min-w-0">
                                <h4 className="text-sm font-semibold text-blue-900 mb-3">Antiplagiat & AI Detektor talablari</h4>
                                <p className="text-xs text-slate-500 mb-3">Maqola nashrga yuborilganda tekshiriladi. Bo&apos;sh qoldirilsa — shart o&apos;rnatilmaydi.</p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-1">Plagiat max %</label>
                                        <input type="number" name="plagiarism_max_percent" min={0} max={100} step={0.1} value={formData.plagiarism_max_percent ?? ''} onChange={handleInputChange} className="w-full" placeholder="mas. 25"/>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-1">AI kontent max %</label>
                                        <input type="number" name="ai_content_max_percent" min={0} max={100} step={0.1} value={formData.ai_content_max_percent ?? ''} onChange={handleInputChange} className="w-full" placeholder="mas. 30"/>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-1">Originalilik min %</label>
                                        <input type="number" name="originality_min_percent" min={0} max={100} step={0.1} value={formData.originality_min_percent ?? ''} onChange={handleInputChange} className="w-full" placeholder="mas. 70"/>
                                    </div>
                                </div>
                            </div>
                            <div className="min-w-0">
                                <label className="block text-sm font-medium text-slate-600 mb-2">Tavsif</label>
                                <textarea name="description" value={formData.description} onChange={handleInputChange} className="w-full min-w-0 max-w-full box-border resize-y" rows={4} placeholder="Jurnal haqida qisqacha ma'lumot..."></textarea>
                            </div>

                            <div className="pt-4 border-t border-slate-200/90 min-w-0">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input type="checkbox" name="required" checked={formData.additionalDocumentConfig?.required} onChange={handleAdditionalDocConfigChange} className="h-5 w-5 mt-0.5 shrink-0 rounded bg-white/10 border-slate-300/80 text-blue-500 focus:ring-blue-500" style={{boxShadow: 'none'}}/>
                                    <span className="font-medium text-slate-700 break-words">Qo'shimcha hujjat talab qilish (masalan, taqriz)</span>
                                </label>
                                {formData.additionalDocumentConfig?.required && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pl-8">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-2">Hujjat Nomi</label>
                                            <input type="text" name="label" value={formData.additionalDocumentConfig.label} onChange={handleAdditionalDocConfigChange} className="w-full" placeholder="Taqriz fayli"/>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-2">Hujjat Turi</label>
                                            <select name="type" value={formData.additionalDocumentConfig.type} onChange={handleAdditionalDocConfigChange} className="w-full">
                                                <option value="file">Fayl yuklash</option>
                                                <option value="link">Havola kiritish</option>
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-4 pt-4 border-t border-slate-200/90 mt-6">
                                <Button type="button" variant="secondary" onClick={handleCloseModal}>Bekor qilish</Button>
                                <Button type="submit">{editingJournal ? "Saqlash" : "Qo'shish"}</Button>
                            </div>
                        </form>
                        </div>
                    </Card>
                </div>
            )}

            {deletingJournal && (
                <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md" title="O'chirishni tasdiqlang">
                        <div className="flex items-center gap-4 mb-4">
                            {(deletingJournal as any).imageUrl || (deletingJournal as any).image_url ? (
                                <img 
                                    src={(deletingJournal as any).imageUrl || (deletingJournal as any).image_url} 
                                    alt="Jurnal rasmi" 
                                    className="h-16 w-16 rounded-lg object-cover"
                                    onError={(e) => {
                                        // Hide image if it fails to load
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            ) : null}
                            <div>
                                <h3 className="text-lg font-medium text-slate-900">{deletingJournal.name}</h3>
                                <p className="text-slate-500 text-sm">Jurnalni o'chirish</p>
                            </div>
                        </div>
                        <p className="text-slate-600 mb-6">
                            Haqiqatan ham <strong className="text-slate-900">{deletingJournal.name}</strong> jurnalini o'chirmoqchimisiz?
                            Bu harakatni bekor qilib bo'lmaydi.
                        </p>
                        <div className="flex justify-end gap-4 mt-8">
                            <Button variant="secondary" onClick={() => setDeletingJournal(null)}>Bekor qilish</Button>
                            <Button variant="danger" onClick={confirmDelete}>O'chirish</Button>
                        </div>
                    </Card>
                </div>
            )}
        </>
    );
};

export default JournalManagement;