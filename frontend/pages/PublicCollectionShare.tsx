import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { apiService } from '../services/apiService';
import { Download, Loader2, BookOpen } from 'lucide-react';
import { useT } from '../i18n/LanguageContext';

interface PublicCollectionData {
  id: string;
  journal_name: string;
  issue_number: string;
  publication_date: string;
  collection_url: string;
  collection_file_url: string | null;
}

const PublicCollectionShare: React.FC = () => {
  const { t } = useT();
  const { id } = useParams<{ id: string }>();
  const [issue, setIssue] = useState<PublicCollectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPublic = async () => {
      if (!id) {
        setError(t("To'plam havolasi noto'g'ri."));
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const data = await apiService.journals.getPublicIssue(id);
        setIssue(data as PublicCollectionData);
      } catch (err: any) {
        setError(err?.message || t("To'plam ma'lumotlarini yuklashda xatolik."));
      } finally {
        setLoading(false);
      }
    };
    fetchPublic();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-10">
        <Card title={t("To'plam yuklanmoqda")}>
          <div className="flex items-center justify-center py-12 text-slate-600">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            {t('Yuklanmoqda...')}
          </div>
        </Card>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="max-w-2xl mx-auto py-10">
        <Card title={t("To'plam topilmadi")}>
          <p className="text-red-800">{error || t("To'plam topilmadi.")}</p>
          <div className="mt-5">
            <Link to="/login">
              <Button>{t('Kirish sahifasiga o‘tish')}</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const downloadUrl = issue.collection_file_url || issue.collection_url;

  return (
    <div className="max-w-2xl mx-auto py-10">
      <Card title={t("Jurnal to'plami")}>
        <div className="flex items-center gap-4 mb-6">
          <BookOpen className="h-12 w-12 text-blue-800 flex-shrink-0" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">{issue.journal_name}</h1>
            <p className="text-blue-900 font-semibold">{t('{issue_number} soni', { issue_number: issue.issue_number })}</p>
            <p className="text-sm text-slate-500 mt-1">
              {t('Nashr sanasi:')} {new Date(issue.publication_date).toLocaleDateString('uz-UZ')}
            </p>
          </div>
        </div>
        {downloadUrl ? (
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block"
          >
            <Button variant="primary" className="w-full sm:w-auto">
              <Download className="mr-2 h-4 w-4" /> {t("To'plamni yuklab olish")}
            </Button>
          </a>
        ) : (
          <p className="text-slate-500">{t('Yuklab olish havolasi hozircha mavjud emas.')}</p>
        )}
        <div className="mt-6 pt-4 border-t border-slate-200/90">
          <Link to="/login" className="text-sm text-blue-800 hover:text-blue-700">
            {t('Platformaga kirish')}
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default PublicCollectionShare;
