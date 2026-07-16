import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Plus, Search, Filter, Download, Edit, Trash2, QrCode, BookOpen, Users } from 'lucide-react';
import apiService from '../services/apiService';

interface ScientificField {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
}

interface PublicationType {
  value: string;
  label: string;
}

interface AuthorPublication {
  id: string;
  author: string;
  author_name: string;
  title: string;
  publication_type: string;
  publication_type_display: string;
  scientific_field: string;
  scientific_field_name: string;
  publication_date: string;
  doi: string;
  pages: string;
  co_authors: string;
  abstract: string;
  keywords: string;
  file_url: string;
  is_verified: boolean;
  created_at: string;
  journal?: {
    id: string;
    name: string;
    image_url?: string;
    issn?: string;
  };
  conference?: {
    id: string;
    title: string;
    location?: string;
    date?: string;
  };
}

const AuthorPublications: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [publications, setPublications] = useState<AuthorPublication[]>([]);
  const [scientificFields, setScientificFields] = useState<ScientificField[]>([]);
  const [publicationTypes, setPublicationTypes] = useState<PublicationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedField, setSelectedField] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedAuthor, setSelectedAuthor] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPublication, setEditingPublication] = useState<AuthorPublication | null>(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [allAuthors, setAllAuthors] = useState<any[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    publication_type: '',
    scientific_field: '',
    publication_date: '',
    doi: '',
    pages: '',
    co_authors: '',
    abstract: '',
    keywords: '',
    file_url: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load data based on user role
      let pubsResponse;
      if (user?.role === 'super_admin') {
        pubsResponse = await apiService.authorPublications.list();
        // Load all authors for admin filter
        const authorsResponse = await apiService.users.list();
        setAllAuthors(authorsResponse);
      } else {
        pubsResponse = await apiService.authorPublications.myPublications();
      }

      const [fieldsResponse, typesResponse] = await Promise.all([
        apiService.scientificFields.list(),
        apiService.authorPublications.publicationTypes()
      ]);

      setPublications(pubsResponse);
      setScientificFields(fieldsResponse);
      setPublicationTypes(typesResponse);
    } catch (error) {
      console.error('Ma\'lumotlarni yuklashda xatolik:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPublication) {
        await apiService.authorPublications.update(editingPublication.id, formData);
      } else {
        await apiService.authorPublications.create(formData);
      }
      
      setFormData({
        title: '',
        publication_type: '',
        scientific_field: '',
        publication_date: '',
        doi: '',
        pages: '',
        co_authors: '',
        abstract: '',
        keywords: '',
        file_url: ''
      });
      setShowAddForm(false);
      setEditingPublication(null);
      loadData();
    } catch (error) {
      console.error('Saqlashda xatolik:', error);
    }
  };

  const handleEdit = (publication: AuthorPublication) => {
    setEditingPublication(publication);
    setFormData({
      title: publication.title,
      publication_type: publication.publication_type,
      scientific_field: publication.scientific_field,
      publication_date: publication.publication_date,
      doi: publication.doi || '',
      pages: publication.pages || '',
      co_authors: publication.co_authors || '',
      abstract: publication.abstract || '',
      keywords: publication.keywords || '',
      file_url: publication.file_url || ''
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Rostdan ham ushbu nashrni o\'chirmoqchimisiz?')) {
      try {
        await apiService.authorPublications.delete(id);
        loadData();
      } catch (error) {
        console.error('O\'chirishda xatolik:', error);
      }
    }
  };

  const filteredPublications = publications.filter(pub => {
    const matchesSearch = pub.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         pub.co_authors.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         pub.keywords.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesField = !selectedField || pub.scientific_field === selectedField;
    const matchesType = !selectedType || pub.publication_type === selectedType;
    const matchesAuthor = !selectedAuthor || pub.author === selectedAuthor;
    
    return matchesSearch && matchesField && matchesType && matchesAuthor;
  });

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'journal_local': 'bg-blue-100 text-blue-800',
      'journal_international': 'bg-green-100 text-green-800',
      'journal_local_general': 'bg-purple-100 text-purple-800',
      'journal_international_general': 'bg-indigo-100 text-indigo-800',
      'conference_local': 'bg-yellow-100 text-yellow-800',
      'conference_international': 'bg-orange-100 text-orange-800',
      'scopus_journal': 'bg-red-100 text-red-800',
      'scopus_conference': 'bg-pink-100 text-pink-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const handleQRScan = () => {
    setShowQRScanner(true);
    console.log('QR code scanner');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Yuklanmoqda...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Muallif Nashrlari</h1>
        <div className="flex gap-2">
          <Button onClick={handleQRScan} variant="secondary">
            <QrCode className="w-4 h-4 mr-2" />
            QR Code Scan
          </Button>
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Yangi Nashr
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label htmlFor="search" className="block text-sm font-medium mb-2">Qidiruv</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <input
                  id="search"
                  type="text"
                  placeholder="Sarlavha, mualliflar, kalit so'zlar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Ilmiy soha</label>
              <select
                value={selectedField}
                onChange={(e) => setSelectedField(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Barcha sohalar</option>
                {scientificFields.map(field => (
                  <option key={field.id} value={field.id}>
                    {field.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Nashr turi</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Barcha turlar</option>
                {publicationTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Author filter - only for super_admin */}
            {user?.role === 'super_admin' && (
              <div>
                <label className="block text-sm font-medium mb-2">Muallif</label>
                <select
                  value={selectedAuthor}
                  onChange={(e) => setSelectedAuthor(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Barcha mualliflar</option>
                  {allAuthors.map(author => (
                    <option key={author.id} value={author.id}>
                      {author.first_name} {author.last_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-end">
              <Button variant="secondary" onClick={() => {
                setSearchTerm('');
                setSelectedField('');
                setSelectedType('');
                setSelectedAuthor('');
              }}>
                <Filter className="w-4 h-4 mr-2" />
                Tozalash
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Publications List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPublications.map(publication => (
          <Card 
            key={publication.id} 
            className="hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer transform hover:scale-105"
            onClick={() => navigate(`/author-publications/${publication.id}`)}
          >
            {/* Journal/Conference Header with Image */}
            {(publication.journal || publication.conference) && (
              <div className="relative h-32 bg-gradient-to-br from-blue-50 to-indigo-100">
                {publication.journal?.image_url ? (
                  <img 
                    src={publication.journal.image_url} 
                    alt={publication.journal.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <BookOpen className="w-12 h-12 text-blue-800" />
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <div className="flex gap-1">
                    {publication.file_url && (
                      <Button 
                        variant="secondary" 
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(publication.file_url);
                        }}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    )}
                    <Button 
                      variant="primary" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(publication);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="danger" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(publication.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            <div className="p-4">
              {/* Publication Type Badges */}
              <div className="flex gap-2 flex-wrap mb-3">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(publication.publication_type)}`}>
                  {publication.publication_type_display}
                </span>
                {publication.is_verified && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Tasdiqlangan
                  </span>
                )}
              </div>

              {/* Title */}
              <h3 className="text-lg font-semibold line-clamp-2 mb-2">{publication.title}</h3>

              {/* Journal/Conference Info */}
              {publication.journal && (
                <div className="bg-gray-50 rounded-lg p-3 mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-blue-900">{publication.journal.name}</span>
                  </div>
                  {publication.journal.issn && (
                    <div className="text-xs text-gray-600">ISSN: {publication.journal.issn}</div>
                  )}
                </div>
              )}

              {publication.conference && (
                <div className="bg-gray-50 rounded-lg p-3 mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-green-600" />
                    <span className="font-medium text-green-900">{publication.conference.title}</span>
                  </div>
                  {publication.conference.location && (
                    <div className="text-xs text-gray-600">📍 {publication.conference.location}</div>
                  )}
                  {publication.conference.date && (
                    <div className="text-xs text-gray-600">📅 {new Date(publication.conference.date).toLocaleDateString('uz-UZ')}</div>
                  )}
                </div>
              )}

              {/* Publication Details */}
              <div className="space-y-1 text-sm text-gray-600">
                <div><strong>Ilmiy soha:</strong> {publication.scientific_field_name}</div>
                <div><strong>Sana:</strong> {new Date(publication.publication_date).toLocaleDateString('uz-UZ')}</div>
                {publication.doi && <div><strong>DOI:</strong> {publication.doi}</div>}
                {publication.pages && <div><strong>Sahifalar:</strong> {publication.pages}</div>}
                {publication.co_authors && (
                  <div><strong>Hammualliflar:</strong> {publication.co_authors}</div>
                )}
                {publication.keywords && (
                  <div><strong>Kalit so'zlar:</strong> {publication.keywords}</div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">
                {editingPublication ? 'Nashrni tahrirlash' : 'Yangi nashr qo\'shish'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium mb-2">Sarlavha *</label>
                  <input
                    id="title"
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Nashr turi *</label>
                    <select
                      value={formData.publication_type}
                      onChange={(e) => setFormData({...formData, publication_type: e.target.value})}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Nashr turini tanlang</option>
                      {publicationTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Ilmiy soha *</label>
                    <select
                      value={formData.scientific_field}
                      onChange={(e) => setFormData({...formData, scientific_field: e.target.value})}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Soxani tanlang</option>
                      {scientificFields.map(field => (
                        <option key={field.id} value={field.id}>
                          {field.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="publication_date" className="block text-sm font-medium mb-2">Nashr sanasi *</label>
                    <input
                      id="publication_date"
                      type="date"
                      value={formData.publication_date}
                      onChange={(e) => setFormData({...formData, publication_date: e.target.value})}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="doi" className="block text-sm font-medium mb-2">DOI</label>
                    <input
                      id="doi"
                      type="text"
                      value={formData.doi}
                      onChange={(e) => setFormData({...formData, doi: e.target.value})}
                      placeholder="10.1000/182"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="pages" className="block text-sm font-medium mb-2">Sahifalar</label>
                  <input
                    id="pages"
                    type="text"
                    value={formData.pages}
                    onChange={(e) => setFormData({...formData, pages: e.target.value})}
                    placeholder="15-25"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="co_authors" className="block text-sm font-medium mb-2">Hammualliflar</label>
                  <input
                    id="co_authors"
                    type="text"
                    value={formData.co_authors}
                    onChange={(e) => setFormData({...formData, co_authors: e.target.value})}
                    placeholder="A. A. Karimov, B. B. To'rayev"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="abstract" className="block text-sm font-medium mb-2">Annotatsiya</label>
                  <textarea
                    id="abstract"
                    value={formData.abstract}
                    onChange={(e) => setFormData({...formData, abstract: e.target.value})}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="keywords" className="block text-sm font-medium mb-2">Kalit so'zlar</label>
                  <input
                    id="keywords"
                    type="text"
                    value={formData.keywords}
                    onChange={(e) => setFormData({...formData, keywords: e.target.value})}
                    placeholder="ta'lim, pedagogika, metodika"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="file_url" className="block text-sm font-medium mb-2">Fayl URL</label>
                  <input
                    id="file_url"
                    type="url"
                    value={formData.file_url}
                    onChange={(e) => setFormData({...formData, file_url: e.target.value})}
                    placeholder="https://example.com/file.pdf"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="secondary" onClick={() => {
                    setShowAddForm(false);
                    setEditingPublication(null);
                  }}>
                    Bekor qilish
                  </Button>
                  <Button type="submit">
                    {editingPublication ? 'Saqlash' : 'Qo\'shish'}
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">QR Code Scanner</h2>
              <div className="text-center py-8">
                <QrCode className="w-16 h-16 mx-auto mb-4 text-slate-500" />
                <p className="text-gray-600 mb-4">QR code skaner bu yerda bo'ladi</p>
                <Button onClick={() => setShowQRScanner(false)}>Yopish</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AuthorPublications;
