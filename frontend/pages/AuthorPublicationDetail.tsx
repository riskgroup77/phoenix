import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { ArrowLeft, Download, Edit, Trash2, Calendar, User, BookOpen, Users, MapPin, FileText, CheckCircle } from 'lucide-react';
import apiService from '../services/apiService';

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
  updated_at: string;
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

const AuthorPublicationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [publication, setPublication] = useState<AuthorPublication | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);

  useEffect(() => {
    if (id) {
      loadPublication();
    }
  }, [id]);

  const loadPublication = async () => {
    try {
      const response = await apiService.authorPublications.get(id!);
      setPublication(response);
    } catch (error) {
      console.error('Nashrni yuklashda xatolik:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (confirm('Rostdan ham ushbu nashrni o\'chirmoqchimisiz?')) {
      try {
        await apiService.authorPublications.delete(id!);
        navigate('/author-publications');
      } catch (error) {
        console.error('O\'chirishda xatolik:', error);
      }
    }
  };

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Yuklanmoqda...</div>
      </div>
    );
  }

  if (!publication) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Nashr topilmadi</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Back Button */}
      <div className="mb-6">
        <Button variant="secondary" onClick={() => navigate('/author-publications')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Orqaga qaytish
        </Button>
      </div>

      {/* Publication Header */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <Card className="mb-6">
            <div className="p-6">
              {/* Title and Actions */}
              <div className="flex justify-between items-start mb-4">
                <h1 className="text-2xl font-bold text-gray-900">{publication.title}</h1>
                <div className="flex gap-2">
                  {publication.file_url && (
                    <Button variant="secondary" onClick={() => window.open(publication.file_url)}>
                      <Download className="w-4 h-4 mr-2" />
                      Yuklab olish
                    </Button>
                  )}
                  <Button variant="primary" onClick={() => setShowEditForm(true)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Tahrirlash
                  </Button>
                  <Button variant="danger" onClick={handleDelete}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    O'chirish
                  </Button>
                </div>
              </div>

              {/* Publication Type and Status */}
              <div className="flex gap-2 flex-wrap mb-6">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getTypeColor(publication.publication_type)}`}>
                  {publication.publication_type_display}
                </span>
                {publication.is_verified && (
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    Tasdiqlangan
                  </span>
                )}
              </div>

              {/* Journal/Conference Info */}
              {publication.journal && (
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    {publication.journal.image_url && (
                      <img 
                        src={publication.journal.image_url} 
                        alt={publication.journal.name}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <BookOpen className="w-5 h-5 text-blue-600" />
                        <span className="font-semibold text-blue-900">{publication.journal.name}</span>
                      </div>
                      {publication.journal.issn && (
                        <div className="text-sm text-gray-600">ISSN: {publication.journal.issn}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {publication.conference && (
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-green-900">{publication.conference.title}</span>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    {publication.conference.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {publication.conference.location}
                      </div>
                    )}
                    {publication.conference.date && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(publication.conference.date).toLocaleDateString('uz-UZ')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Abstract */}
              {publication.abstract && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-2">Annotatsiya</h3>
                  <p className="text-gray-700 leading-relaxed">{publication.abstract}</p>
                </div>
              )}

              {/* Keywords */}
              {publication.keywords && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-2">Kalit so'zlar</h3>
                  <div className="flex flex-wrap gap-2">
                    {publication.keywords.split(',').map((keyword, index) => (
                      <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm">
                        {keyword.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Publication Info */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Nashr ma'lumotlari</h3>
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-slate-500">Muallif</div>
                  <div className="font-medium">{publication.author_name}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-500">Ilmiy soha</div>
                  <div className="font-medium">{publication.scientific_field_name}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-500">Nashr sanasi</div>
                  <div className="font-medium">{new Date(publication.publication_date).toLocaleDateString('uz-UZ')}</div>
                </div>
                {publication.doi && (
                  <div>
                    <div className="text-sm text-slate-500">DOI</div>
                    <div className="font-medium">{publication.doi}</div>
                  </div>
                )}
                {publication.pages && (
                  <div>
                    <div className="text-sm text-slate-500">Sahifalar</div>
                    <div className="font-medium">{publication.pages}</div>
                  </div>
                )}
                {publication.co_authors && (
                  <div>
                    <div className="text-sm text-slate-500">Hammualliflar</div>
                    <div className="font-medium">{publication.co_authors}</div>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* File Download */}
          {publication.file_url && (
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Fayl</h3>
                <Button 
                  variant="primary" 
                  onClick={() => window.open(publication.file_url)}
                  className="w-full"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Yuklab olish
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Form Modal */}
      {showEditForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Nashrni tahrirlash</h2>
              <p className="text-gray-600 mb-4">Bu funksiya hozircha rivojlanmoqda...</p>
              <div className="flex gap-2 justify-end">
                <Button variant="secondary" onClick={() => setShowEditForm(false)}>
                  Bekor qilish
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AuthorPublicationDetail;
