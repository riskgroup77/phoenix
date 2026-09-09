import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import AntiplagiatResultView from '../components/AntiplagiatResultView';
import type { AntiplagiatCertificateData } from '../components/AntiplagiatCertificate';
import type { PlagiarismFullReportData } from '../components/PlagiarismFullReport';
import { buildAntiplagiatViewFromArticle } from '../utils/antiplagiatFromArticle';
import { apiService } from '../services/apiService';
import { toast } from 'react-toastify';

interface LoadedResult {
  result: {
    plagiarism: number;
    aiContent: number;
    citations: number;
    selfCitation: number;
    sources: { source: string; similarity: number; snippet: string; search_module?: string; title?: string }[];
  };
  certificateData: AntiplagiatCertificateData;
  fullReportData: PlagiarismFullReportData;
  originalityPercent: number;
}

/**
 * Arxivdan «Ko'rish» — faqat tekshiruv natijasi (yuklash/to'lov formasi yo'q).
 */
const AntiplagiatResultPage: React.FC = () => {
  const { articleId } = useParams<{ articleId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LoadedResult | null>(null);

  useEffect(() => {
    if (!articleId) {
      setError('Hujjat identifikatori topilmadi.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiService.articles.get(articleId);
        const article = response?.data ?? response;
        if (cancelled) return;

        if (!article?.plagiarism_checked_at) {
          setError('Bu hujjat uchun antiplagiat tekshiruvi hali yakunlanmagan yoki mavjud emas.');
          return;
        }

        const built = buildAntiplagiatViewFromArticle(article);
        if (!built) {
          setError('Tekshiruv natijalarini yuklab bo\'lmadi. Keyinroq qayta urinib ko\'ring.');
          return;
        }

        setData({
          ...built,
          originalityPercent: built.fullReportData.originalityPercent,
        });
      } catch {
        if (!cancelled) {
          setError('Natijani yuklashda xatolik. Internetni tekshirib, qayta urinib ko\'ring.');
          toast.error('Antiplagiat natijasi yuklanmadi.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [articleId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="animate-spin rounded-full h-11 w-11 border-b-2 border-blue-600" />
        <p className="text-sm text-slate-600">Antiplagiat natijasi yuklanmoqda...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-lg mx-auto text-center py-20 px-4">
        <p className="text-slate-700 mb-4">{error || 'Natija topilmadi.'}</p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button onClick={() => navigate('/arxiv')}>Arxiv hujjatlarga qaytish</Button>
          <Button variant="secondary" onClick={() => navigate('/plagiarism-check')}>
            Yangi tekshiruv
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AntiplagiatResultView
      result={data.result}
      certificateData={data.certificateData}
      fullReportData={data.fullReportData}
      originalityPercent={data.originalityPercent}
      onBack={() => navigate('/arxiv')}
      backLabel="Arxiv hujjatlarga qaytish"
    />
  );
};

export default AntiplagiatResultPage;
