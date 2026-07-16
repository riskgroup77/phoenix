import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { apiService } from '../services/apiService';
import { BookOpen, Download, ExternalLink, Loader2 } from 'lucide-react';

interface PublicArticleData {
  id: string;
  title: string;
  status: string;
  doi?: string;
  submission_date?: string;
  author_name?: string;
  journal_name?: string;
  publication_link?: string;
  certificate_download_link?: string;
  plagiarism_history?: {
    checked_at: string;
    plagiarism_percentage: number | null;
    ai_content_percentage: number | null;
    details?: string;
  }[];
}

const PublicArticleShare: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = useState<PublicArticleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPublicArticle = async () => {
      if (!id) {
        setError('Maqola havolasi noto‘g‘ri.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await apiService.articles.getPublic(id);
        const data = response?.data || response;
        setArticle(data);
      } catch (err: any) {
        setError(err?.message || 'Maqola ma’lumotlarini yuklashda xatolik yuz berdi.');
      } finally {
        setLoading(false);
      }
    };

    fetchPublicArticle();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-10">
        <Card title="Maqola ma'lumotlari yuklanmoqda">
          <div className="flex items-center justify-center py-12 text-slate-600">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Yuklanmoqda...
          </div>
        </Card>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="max-w-3xl mx-auto py-10">
        <Card title="Maqola topilmadi">
          <p className="text-red-800">{error || 'Maqola topilmadi.'}</p>
          <div className="mt-5">
            <Link to="/login">
              <Button>Kirish sahifasiga o‘tish</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/90 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <Card title="Nashr etilgan maqola">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 leading-snug">{article.title}</h2>
              <p className="text-sm text-slate-500 mt-1">
                Muallif: <span className="text-slate-700">{article.author_name || 'Noma’lum'}</span>
                {' · '}
                Jurnal: <span className="text-slate-700">{article.journal_name || 'Noma’lum'}</span>
              </p>
              {article.doi && (
                <p className="text-sm text-slate-500 mt-0.5">DOI: <span className="text-slate-700">{article.doi}</span></p>
              )}
            </div>

            {/* Jurnal linki va sertifikat — share sahifasining asosiy qismi */}
            <div className="rounded-xl bg-slate-100/70 border border-slate-200/90 p-4 space-y-4">
              <h3 className="text-sm font-semibold text-slate-600">Nashr natijalari</h3>
              {article.publication_link ? (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Maqola chop etilgan jurnal havolasi</p>
                  <a
                    href={article.publication_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-blue-800 hover:text-blue-700 font-medium"
                  >
                    <ExternalLink size={18} />
                    Jurnal havolasini ochish
                  </a>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Jurnal havolasi hali kiritilmagan.</p>
              )}
              {article.certificate_download_link ? (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Nashr sertifikati</p>
                  <a
                    href={article.certificate_download_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"
                    download
                  >
                    <Download size={18} />
                    Sertifikatni yuklab olish
                  </a>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Sertifikat hali yuklanmagan.</p>
              )}
            </div>

            {(!article.publication_link && !article.certificate_download_link) && (
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-950 text-sm">
                Nashr havolasi va sertifikat hali to‘ldirilmagan.
              </div>
            )}

          <div className="pt-2">
            <h3 className="text-lg font-semibold text-slate-900 mb-3">Antiplagiat tarixi</h3>
            {Array.isArray(article.plagiarism_history) && article.plagiarism_history.length > 0 ? (
              <div className="space-y-2">
                {article.plagiarism_history.map((item, index) => (
                  <div key={`${item.checked_at}-${index}`} className="p-3 rounded-lg bg-slate-100/70 border border-slate-200/90">
                    <p className="text-xs text-slate-500">
                      Tekshiruv vaqti: {item.checked_at ? new Date(item.checked_at).toLocaleString() : 'Noma’lum'}
                    </p>
                    <div className="mt-1 text-sm text-slate-700 flex flex-col sm:flex-row sm:gap-6">
                      <span>Plagiat: <strong>{item.plagiarism_percentage ?? '—'}%</strong></span>
                      <span>AI kontent: <strong>{item.ai_content_percentage ?? '—'}%</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-slate-100/70 border border-slate-200/90 text-sm text-slate-500">
                Hozircha antiplagiat tarixi mavjud emas.
              </div>
            )}
          </div>

          <div className="pt-2">
            <Link to="/login">
              <Button>
                <BookOpen className="mr-2 h-4 w-4" /> Platformaga kirish
              </Button>
            </Link>
          </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PublicArticleShare;
