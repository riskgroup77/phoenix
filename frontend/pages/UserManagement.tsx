import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Role } from '../types';
import { Search, User, Shield, Eye, Edit, Trash2, Plus, X, Download, FileText, Languages, ClipboardCheck, CreditCard, Activity } from 'lucide-react';
import { apiService } from '../services/apiService';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';

const UserManagement: React.FC = () => {
    const { user } = useAuth();
    const [users, setUsers] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterRole, setFilterRole] = useState<string>('');
    const [filterAffiliation, setFilterAffiliation] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // New user modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // View / Edit modals
    const [viewUser, setViewUser] = useState<any>(null);
    const [activityData, setActivityData] = useState<any>(null);
    const [activityLoading, setActivityLoading] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null);
    const [editForm, setEditForm] = useState({ first_name: '', last_name: '', email: '', phone: '', role: '' as string, affiliation: '' });
    const [isEditSubmitting, setIsEditSubmitting] = useState(false);

    // Delete confirmation modal (password 8406)
    const DELETE_CONFIRM_PASSWORD = '8406';
    const [userToDelete, setUserToDelete] = useState<any>(null);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteError, setDeleteError] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    
    // New user form data
    const [newUser, setNewUser] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        role: Role.Author,
        password: '',
        affiliation: ''
    });

    useEffect(() => {
        const fetchUsers = async () => {
            if (!user) return;
            
            try {
                setLoading(true);
                setError(null);
                
                const usersData = await apiService.users.list();
                
                // Ensure we're working with arrays - handle various response formats
                const usersArray = Array.isArray(usersData) 
                    ? usersData 
                    : (usersData?.data && Array.isArray(usersData.data) 
                        ? usersData.data 
                        : (usersData?.results && Array.isArray(usersData.results) 
                            ? usersData.results 
                            : []));
                setUsers(usersArray);
            } catch (err: any) {
                console.error('Failed to fetch users:', err);
                setError('Foydalanuvchilarni yuklashda xatolik yuz berdi.');
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, [user]);

    const validUsers = Array.isArray(users) ? users : [];
    const uniqueAffiliations = useMemo(
        () => [...new Set(validUsers.map((u) => u.affiliation).filter(Boolean))].sort() as string[],
        [users]
    );
    const filteredUsers = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return validUsers.filter((u) => {
            const matchesSearch =
                !q ||
                u.first_name?.toLowerCase().includes(q) ||
                u.last_name?.toLowerCase().includes(q) ||
                u.email?.toLowerCase().includes(q) ||
                u.phone?.includes(searchQuery.trim());
            const matchesRole = !filterRole || (u.role === filterRole);
            const matchesAffiliation =
                !filterAffiliation || (u.affiliation?.trim() === filterAffiliation);
            return matchesSearch && matchesRole && matchesAffiliation;
        });
    }, [validUsers, searchQuery, filterRole, filterAffiliation]);
    
    // Handle opening the new user modal
    const handleOpenModal = () => {
        // Reset form data
        setNewUser({
            first_name: '',
            last_name: '',
            email: '',
            phone: '',
            role: Role.Author,
            password: '',
            affiliation: ''
        });
        setIsModalOpen(true);
    };
    
    // Handle closing the new user modal
    const handleCloseModal = () => {
        setIsModalOpen(false);
    };
    
    // Handle form input changes
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setNewUser(prev => ({
            ...prev,
            [name]: value
        }));
    };
    
    // Handle form submission for new user
    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Basic validation
        if (!newUser.first_name || !newUser.last_name || !newUser.email || !newUser.phone || !newUser.password) {
            toast.error("Iltimos, barcha majburiy maydonlarni to'ldiring.");
            return;
        }
        
        try {
            setIsSubmitting(true);
            
            // Create user via API
            const userData = {
                first_name: newUser.first_name,
                last_name: newUser.last_name,
                email: newUser.email,
                phone: newUser.phone,
                role: newUser.role,
                password: newUser.password,
                affiliation: newUser.affiliation
            };
            
            const createdUser = await apiService.users.create(userData);
            
            // Add new user to the users list
            setUsers(prev => [...prev, createdUser]);
            
            // Close modal and reset form
            handleCloseModal();
            
            toast.success("Foydalanuvchi muvaffaqiyatli qo'shildi!");
        } catch (err: any) {
            console.error('Failed to create user:', err);
            toast.error(err?.response?.detail || err?.message || 'Foydalanuvchi yaratishda xatolik yuz berdi.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleViewUser = (u: any) => setViewUser(u);
    const handleCloseView = () => { setViewUser(null); setActivityData(null); };

    useEffect(() => {
        if (!viewUser?.id) return;
        let cancelled = false;
        setActivityLoading(true);
        setActivityData(null);
        apiService.users.activity(String(viewUser.id))
            .then((data: any) => { if (!cancelled) setActivityData(data); })
            .catch(() => { if (!cancelled) setActivityData({}); })
            .finally(() => { if (!cancelled) setActivityLoading(false); });
        return () => { cancelled = true; };
    }, [viewUser?.id]);

    const handleOpenEdit = (u: any) => {
        setEditingUser(u);
        setEditForm({
            first_name: u.first_name ?? '',
            last_name: u.last_name ?? '',
            email: u.email ?? '',
            phone: u.phone ?? '',
            role: u.role ?? '',
            affiliation: u.affiliation ?? '',
        });
    };
    const handleCloseEdit = () => {
        setEditingUser(null);
        setIsEditSubmitting(false);
    };
    const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setEditForm((prev) => ({ ...prev, [name]: value }));
    };
    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser?.id) return;
        try {
            setIsEditSubmitting(true);
            await apiService.users.update(editingUser.id, {
                first_name: editForm.first_name,
                last_name: editForm.last_name,
                email: editForm.email,
                phone: editForm.phone,
                role: editForm.role,
                affiliation: editForm.affiliation,
            });
            setUsers((prev) =>
                prev.map((u) => (u.id === editingUser.id ? { ...u, ...editForm } : u))
            );
            handleCloseEdit();
            toast.success('Foydalanuvchi yangilandi.');
        } catch (err: any) {
            toast.error(err?.message || 'Tahrirlashda xatolik.');
        } finally {
            setIsEditSubmitting(false);
        }
    };

    const handleDeleteClick = (u: any) => {
        setUserToDelete(u);
        setDeletePassword('');
        setDeleteError('');
    };
    const handleDeleteCancel = () => {
        setUserToDelete(null);
        setDeletePassword('');
        setDeleteError('');
    };
    const handleDeleteConfirm = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userToDelete?.id) return;
        if (deletePassword !== DELETE_CONFIRM_PASSWORD) {
            setDeleteError('Noto\'g\'ri parol. Iltimos, parolni tekshiring.');
            return;
        }
        try {
            setIsDeleting(true);
            setDeleteError('');
            await apiService.users.delete(userToDelete.id);
            setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
            handleDeleteCancel();
            toast.success('Foydalanuvchi o\'chirildi.');
        } catch (err: any) {
            setDeleteError(err?.message || 'O\'chirishda xatolik.');
        } finally {
            setIsDeleting(false);
        }
    };

    const roleNames: Record<string, string> = {
        'author': 'Muallif',
        'reviewer': 'Taqrizchi',
        'journal_admin': 'Jurnal administratori',
        'super_admin': 'Bosh administrator',
        'accountant': 'Moliyachi',
    };

    const roleColors: Record<string, string> = {
        'author': 'bg-blue-500/20 text-blue-900',
        'reviewer': 'bg-purple-500/20 text-purple-900',
        'journal_admin': 'bg-indigo-500/20 text-indigo-300',
        'super_admin': 'bg-red-500/20 text-red-800',
        'accountant': 'bg-green-500/20 text-emerald-900',
    };

    /** Export all loaded users to an Excel (.xlsx) file. */
    const handleExportExcel = () => {
        const headers = ['ID', 'Ism', 'Familiya', 'Email', 'Telefon', 'Rol', 'Tashkilot', "Ro'yxatdan o'tgan"];
        const rows = validUsers.map((u) => [
            u.id ?? '',
            u.first_name ?? '',
            u.last_name ?? '',
            u.email ?? '',
            u.phone ?? '',
            roleNames[u.role] ?? u.role ?? '',
            u.affiliation ?? '',
            u.date_joined ? new Date(u.date_joined).toLocaleDateString() : '',
        ]);
        const data = [headers, ...rows];
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Foydalanuvchilar');
        const fileName = `foydalanuvchilar_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, fileName);
        toast.success('Excel fayl yuklab olindi.');
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
            <Card title="Xatolik">
                <p className="text-red-700">{error}</p>
                <Button onClick={() => window.location.reload()} className="mt-4">Qayta urinish</Button>
            </Card>
        );
    }

    return (
        <>
            <Card title="Foydalanuvchilar boshqaruvi">
                <div className="mb-6 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                            <div className="flex items-center bg-slate-100/70 border border-slate-200/90 rounded-xl focus-within:border-accent-color focus-within:ring-2 focus-within:ring-accent-color-glow transition-all">
                                <Search className="text-slate-500 mx-4 shrink-0" size={20} />
                                <input
                                    type="text"
                                    placeholder="Ism, familiya, email yoki telefon bo'yicha qidirish..."
                                    className="w-full !bg-transparent !border-none !py-3 !pr-4 !pl-0 !shadow-none !ring-0"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                        <Button type="button" variant="secondary" onClick={handleExportExcel} disabled={validUsers.length === 0}>
                            <Download className="mr-2 h-4 w-4" /> Excelda yuklab olish
                        </Button>
                        <Button onClick={handleOpenModal}>
                            <Plus className="mr-2 h-4 w-4" /> Yangi foydalanuvchi
                        </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-slate-500 whitespace-nowrap">Rol:</label>
                            <select
                                value={filterRole}
                                onChange={(e) => setFilterRole(e.target.value)}
                                className="bg-slate-100/70 border border-slate-200/90 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 min-w-[180px]"
                            >
                                <option value="">Barcha rollar</option>
                                {Object.entries(roleNames).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-slate-500 whitespace-nowrap">Tashkilot:</label>
                            <select
                                value={filterAffiliation}
                                onChange={(e) => setFilterAffiliation(e.target.value)}
                                className="bg-slate-100/70 border border-slate-200/90 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 min-w-[220px]"
                            >
                                <option value="">Barcha tashkilotlar</option>
                                {uniqueAffiliations.map((aff) => (
                                    <option key={aff} value={aff}>{aff}</option>
                                ))}
                            </select>
                        </div>
                        {(filterRole || filterAffiliation) && (
                            <button
                                type="button"
                                onClick={() => { setFilterRole(''); setFilterAffiliation(''); }}
                                className="text-sm text-blue-800 hover:text-blue-700"
                            >
                                Filterni tozalash
                            </button>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-200/90">
                    <table className="w-full text-left">
                        <thead className="bg-slate-100/70">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Foydalanuvchi</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Rol</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Telefon</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Tashkilot</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Ro'yxatdan o'tgan</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Amallar</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/80">
                            {filteredUsers.map(user => (
                                <tr key={user.id} className="hover:bg-slate-100/70 transition-colors">
                                    <td className="px-4 py-4">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-10 w-10">
                                                {user.avatar_url ? (
                                                    <img className="h-10 w-10 rounded-full object-cover" src={user.avatar_url} alt={user.first_name} />
                                                ) : (
                                                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                                                        <User className="h-5 w-5 text-slate-900" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-slate-900">{user.first_name} {user.last_name}</div>
                                                <div className="text-sm text-slate-500">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColors[user.role]}`}>
                                            {roleNames[user.role]}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-slate-600">{user.phone}</td>
                                    <td className="px-4 py-4 text-sm text-slate-600">{user.affiliation}</td>
                                    <td className="px-4 py-4 text-sm text-slate-600">
                                        {new Date(user.date_joined).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-4 text-sm">
                                        <div className="flex items-center space-x-2">
                                            <Button type="button" variant="secondary" onClick={() => handleViewUser(user)} title="Ko'rish">
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button type="button" variant="secondary" onClick={() => handleOpenEdit(user)} title="Tahrirlash">
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button type="button" variant="danger" onClick={() => handleDeleteClick(user)} title="O'chirish">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {filteredUsers.length === 0 && (
                    <div className="text-center py-12">
                        <User className="mx-auto h-12 w-12 text-slate-500" />
                        <h3 className="mt-2 text-sm font-medium text-slate-900">Foydalanuvchilar topilmadi</h3>
                        <p className="mt-1 text-sm text-slate-500">
                            {searchQuery || filterRole || filterAffiliation
                                ? 'Qidiruv yoki filtrlarga mos foydalanuvchi yo\'q. Filterni o\'zgartiring yoki tozalang.'
                                : 'Hozircha foydalanuvchilar mavjud emas.'}
                        </p>
                    </div>
                )}
            </Card>
            
            {/* New User Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-2xl" title="Yangi foydalanuvchi qo'shish">
                        <button 
                            onClick={handleCloseModal}
                            className="absolute top-4 right-4 text-slate-500 hover:text-slate-900"
                        >
                            <X size={24} />
                        </button>
                        
                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-2">Ism *</label>
                                    <input 
                                        type="text" 
                                        name="first_name"
                                        value={newUser.first_name}
                                        onChange={handleInputChange}
                                        className="w-full"
                                        placeholder="Ism"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-2">Familiya *</label>
                                    <input 
                                        type="text" 
                                        name="last_name"
                                        value={newUser.last_name}
                                        onChange={handleInputChange}
                                        className="w-full"
                                        placeholder="Familiya"
                                        required
                                    />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-2">Email *</label>
                                    <input 
                                        type="email" 
                                        name="email"
                                        value={newUser.email}
                                        onChange={handleInputChange}
                                        className="w-full"
                                        placeholder="email@example.com"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-2">Telefon *</label>
                                    <input 
                                        type="tel" 
                                        name="phone"
                                        value={newUser.phone}
                                        onChange={handleInputChange}
                                        className="w-full"
                                        placeholder="+998 XX XXX XXXX"
                                        required
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-2">Tashkilot</label>
                                <input 
                                    type="text" 
                                    name="affiliation"
                                    value={newUser.affiliation}
                                    onChange={handleInputChange}
                                    className="w-full"
                                    placeholder="Tashkilot nomi"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-2">Rol *</label>
                                <select 
                                    name="role"
                                    value={newUser.role}
                                    onChange={handleInputChange}
                                    className="w-full"
                                    required
                                >
                                    <option value={Role.Author}>Muallif</option>
                                    <option value={Role.Reviewer}>Taqrizchi</option>
                                    <option value={Role.JournalAdmin}>Jurnal administratori</option>
                                    <option value={Role.Accountant}>Moliyachi</option>
                                    <option value={Role.SuperAdmin}>Bosh administrator</option>
                                </select>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-2">Parol *</label>
                                <input 
                                    type="password" 
                                    name="password"
                                    value={newUser.password}
                                    onChange={handleInputChange}
                                    className="w-full"
                                    placeholder="Parol"
                                    required
                                />
                            </div>
                            
                            <div className="flex justify-end gap-4 pt-4 border-t border-slate-200/90 mt-6">
                                <Button 
                                    type="button" 
                                    variant="secondary" 
                                    onClick={handleCloseModal}
                                    disabled={isSubmitting}
                                >
                                    Bekor qilish
                                </Button>
                                <Button 
                                    type="submit" 
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Yaratilmoqda...' : "Foydalanuvchi qo'shish"}
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}

            {/* View User Modal – ma'lumotlar, statistika, faoliyat tarixi */}
            {viewUser && (
                <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <Card className="w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" title={`${viewUser.first_name} ${viewUser.last_name} – faoliyati`}>
                        <button type="button" onClick={handleCloseView} className="absolute top-4 right-4 text-slate-500 hover:text-slate-900 z-10">
                            <X size={24} />
                        </button>
                        <div className="overflow-y-auto pr-2 space-y-6 pb-6">
                            <section>
                                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Asosiy ma'lumotlar</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                    <div><span className="text-slate-500">Email:</span> <span className="text-slate-900">{viewUser.email}</span></div>
                                    <div><span className="text-slate-500">Telefon:</span> <span className="text-slate-900">{viewUser.phone}</span></div>
                                    <div><span className="text-slate-500">Rol:</span> <span className="text-slate-900">{roleNames[viewUser.role] ?? viewUser.role}</span></div>
                                    <div><span className="text-slate-500">Tashkilot:</span> <span className="text-slate-900">{viewUser.affiliation || '—'}</span></div>
                                    <div><span className="text-slate-500">Ro'yxatdan o'tgan:</span> <span className="text-slate-900">{viewUser.date_joined ? new Date(viewUser.date_joined).toLocaleDateString() : '—'}</span></div>
                                </div>
                            </section>

                            {activityLoading && (
                                <div className="flex justify-center py-8">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
                                </div>
                            )}

                            {!activityLoading && activityData && (
                                <>
                                    <section>
                                        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Statistika (roliga qarab)</h3>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            <div className="bg-slate-100/70 rounded-lg p-3 border border-slate-200/90">
                                                <div className="flex items-center gap-2 text-slate-500 mb-1"><FileText className="h-4 w-4" /> Maqolalar</div>
                                                <div className="text-xl font-semibold text-slate-900">{(activityData.stats?.articles_total ?? 0)}</div>
                                                {activityData.stats?.articles_by_status && Object.keys(activityData.stats.articles_by_status).length > 0 && (
                                                    <div className="text-xs text-slate-500 mt-1">
                                                        {Object.entries(activityData.stats.articles_by_status).map(([s, c]: [string, any]) => `${s}: ${c}`).join(', ')}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="bg-slate-100/70 rounded-lg p-3 border border-slate-200/90">
                                                <div className="flex items-center gap-2 text-slate-500 mb-1"><Languages className="h-4 w-4" /> Tarjimalar</div>
                                                <div className="text-xl font-semibold text-slate-900">{(activityData.stats?.translations_total ?? 0)}</div>
                                            </div>
                                            <div className="bg-slate-100/70 rounded-lg p-3 border border-slate-200/90">
                                                <div className="flex items-center gap-2 text-slate-500 mb-1"><ClipboardCheck className="h-4 w-4" /> Taqrizlar</div>
                                                <div className="text-xl font-semibold text-slate-900">{(activityData.stats?.reviews_total ?? 0)}</div>
                                            </div>
                                            <div className="bg-slate-100/70 rounded-lg p-3 border border-slate-200/90">
                                                <div className="flex items-center gap-2 text-slate-500 mb-1"><CreditCard className="h-4 w-4" /> To'lovlar</div>
                                                <div className="text-xl font-semibold text-slate-900">{(activityData.stats?.transactions_total ?? 0)}</div>
                                                {activityData.stats?.transactions_by_service && Object.keys(activityData.stats.transactions_by_service).length > 0 && (
                                                    <div className="text-xs text-slate-500 mt-1">
                                                        {Object.entries(activityData.stats.transactions_by_service).map(([s, c]: [string, any]) => `${s}: ${c}`).join(', ')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </section>

                                    {((activityData.recent_articles?.length ?? 0) + (activityData.recent_translations?.length ?? 0) + (activityData.recent_reviews?.length ?? 0) + (activityData.recent_transactions?.length ?? 0)) > 0 && (
                                        <section>
                                            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">So'ngi amallar</h3>
                                            <div className="space-y-4">
                                                {activityData.recent_articles?.length > 0 && (
                                                    <div>
                                                        <div className="text-xs font-medium text-slate-500 mb-2">Maqolalar</div>
                                                        <ul className="space-y-1.5 max-h-32 overflow-y-auto text-sm">
                                                            {activityData.recent_articles.slice(0, 10).map((a: any) => (
                                                                <li key={a.id} className="flex justify-between items-center py-1 border-b border-white/5">
                                                                    <span className="text-slate-600 truncate flex-1 mr-2">{a.title}</span>
                                                                    <span className="text-slate-500 shrink-0">{a.status} · {a.submission_date ? new Date(a.submission_date).toLocaleDateString() : ''}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                                {activityData.recent_translations?.length > 0 && (
                                                    <div>
                                                        <div className="text-xs font-medium text-slate-500 mb-2">Tarjima so'rovlari</div>
                                                        <ul className="space-y-1.5 max-h-32 overflow-y-auto text-sm">
                                                            {activityData.recent_translations.slice(0, 10).map((t: any) => (
                                                                <li key={t.id} className="flex justify-between items-center py-1 border-b border-white/5">
                                                                    <span className="text-slate-600 truncate flex-1 mr-2">{t.title} ({t.source_language} → {t.target_language})</span>
                                                                    <span className="text-slate-500 shrink-0">{t.status} · {t.submission_date ? new Date(t.submission_date).toLocaleDateString() : ''}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                                {activityData.recent_reviews?.length > 0 && (
                                                    <div>
                                                        <div className="text-xs font-medium text-slate-500 mb-2">Taqrizlar</div>
                                                        <ul className="space-y-1.5 max-h-32 overflow-y-auto text-sm">
                                                            {activityData.recent_reviews.slice(0, 10).map((r: any) => (
                                                                <li key={r.id} className="flex justify-between items-center py-1 border-b border-white/5">
                                                                    <span className="text-slate-600 truncate flex-1 mr-2">{r.article_title}</span>
                                                                    <span className="text-slate-500 shrink-0">{r.status} · {r.assigned_at ? new Date(r.assigned_at).toLocaleDateString() : ''}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                                {activityData.recent_transactions?.length > 0 && (
                                                    <div>
                                                        <div className="text-xs font-medium text-slate-500 mb-2">To'lovlar</div>
                                                        <ul className="space-y-1.5 max-h-32 overflow-y-auto text-sm">
                                                            {activityData.recent_transactions.slice(0, 10).map((tx: any) => (
                                                                <li key={tx.id} className="flex justify-between items-center py-1 border-b border-white/5">
                                                                    <span className="text-slate-600">{tx.service_type}</span>
                                                                    <span className="text-slate-500 shrink-0">{tx.status} · {tx.amount} {tx.currency} · {tx.created_at ? new Date(tx.created_at).toLocaleDateString() : ''}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        </section>
                                    )}

                                    {activityData.activity_timeline?.length > 0 && (
                                        <section>
                                            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                <Activity className="h-4 w-4" /> Amallar tarixi
                                            </h3>
                                            <ul className="space-y-2 max-h-48 overflow-y-auto text-sm">
                                                {activityData.activity_timeline.map((log: any) => (
                                                    <li key={log.id} className="py-2 px-3 bg-slate-100/70 rounded-lg border border-white/5 flex flex-col gap-0.5">
                                                        <span className="text-slate-900 font-medium">{log.action}</span>
                                                        {log.details && <span className="text-slate-500 text-xs">{log.details}</span>}
                                                        {log.article_title && <span className="text-slate-500 text-xs">Maqola: {log.article_title}</span>}
                                                        <span className="text-slate-500 text-xs">{log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </section>
                                    )}
                                </>
                            )}

                            {!activityLoading && activityData && !activityData.stats && Object.keys(activityData).length === 0 && (
                                <p className="text-slate-500 text-sm">Faoliyat ma'lumotlari yuklanmadi.</p>
                            )}
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-200/90 flex justify-end shrink-0">
                            <Button type="button" variant="secondary" onClick={handleCloseView}>Yopish</Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Edit User Modal */}
            {editingUser && (
                <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-2xl" title="Foydalanuvchini tahrirlash">
                        <button type="button" onClick={handleCloseEdit} className="absolute top-4 right-4 text-slate-500 hover:text-slate-900">
                            <X size={24} />
                        </button>
                        <form onSubmit={handleEditSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-2">Ism *</label>
                                    <input type="text" name="first_name" value={editForm.first_name} onChange={handleEditInputChange} className="w-full" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-2">Familiya *</label>
                                    <input type="text" name="last_name" value={editForm.last_name} onChange={handleEditInputChange} className="w-full" required />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-2">Email *</label>
                                    <input type="email" name="email" value={editForm.email} onChange={handleEditInputChange} className="w-full" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-2">Telefon *</label>
                                    <input type="tel" name="phone" value={editForm.phone} onChange={handleEditInputChange} className="w-full" required />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-2">Tashkilot</label>
                                <input type="text" name="affiliation" value={editForm.affiliation} onChange={handleEditInputChange} className="w-full" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-2">Rol *</label>
                                <select name="role" value={editForm.role} onChange={handleEditInputChange} className="w-full" required>
                                    {Object.entries(roleNames).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex justify-end gap-4 pt-4 border-t border-slate-200/90 mt-6">
                                <Button type="button" variant="secondary" onClick={handleCloseEdit} disabled={isEditSubmitting}>Bekor qilish</Button>
                                <Button type="submit" disabled={isEditSubmitting}>{isEditSubmitting ? 'Saqlanmoqda...' : 'Saqlash'}</Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}

            {/* Delete confirmation modal – parol so'raladi */}
            {userToDelete && (
                <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md" title="Foydalanuvchini o'chirish">
                        <button type="button" onClick={handleDeleteCancel} className="absolute top-4 right-4 text-slate-500 hover:text-slate-900">
                            <X size={24} />
                        </button>
                        <p className="text-slate-600 mb-4">
                            <strong className="text-slate-900">{userToDelete.first_name} {userToDelete.last_name}</strong> foydalanuvchisini o'chirish uchun parolni kiriting.
                        </p>
                        <form onSubmit={handleDeleteConfirm} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-2">Parol</label>
                                <input
                                    type="password"
                                    value={deletePassword}
                                    onChange={(e) => { setDeletePassword(e.target.value); setDeleteError(''); }}
                                    className="w-full"
                                    placeholder="Parolni kiriting"
                                    autoFocus
                                />
                                {deleteError && <p className="mt-2 text-sm text-red-700">{deleteError}</p>}
                            </div>
                            <div className="flex justify-end gap-4 pt-4">
                                <Button type="button" variant="secondary" onClick={handleDeleteCancel} disabled={isDeleting}>Bekor qilish</Button>
                                <Button type="submit" variant="danger" disabled={isDeleting}>{isDeleting ? 'O\'chirilmoqda...' : 'O\'chirish'}</Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </>
    );
};

export default UserManagement;