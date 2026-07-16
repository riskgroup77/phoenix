import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from '../components/ui/Card';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { API_V1_BASE_URL } from '../config/apiBase';

const UdkVerify: React.FC = () => {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const articleId = searchParams.get('article_id');
  const [data, setData] = useState<{
    valid: boolean;
    document_number?: string;
    document_date?: string;
    author_name?: string;
    title?: string;
    udk_code?: string;
    udk_description?: string;
    detail?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = id ? `id=${encodeURIComponent(id)}` : articleId ? `article_id=${encodeURIComponent(articleId)}` : '';
    if (!q) {
      setData({ valid: false, detail: 'Tekshirish uchun QR kodni skanerlang yoki havolani oching.' });
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`${API_V1_BASE_URL}/udc/verify/?${q}`)
      .then((r) => r.json())
      .then((body) => {
        setData(body);
      })
      .catch(() => setData({ valid: false, detail: 'Tekshirishda xatolik.' }))
      .finally(() => setLoading(false));
  }, [id, articleId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/90 flex items-center justify-center p-4">
        <div className="text-center text-slate-500">
          <Loader2 className="h-10 w-10 animate-spin mx-auto mb-3 text-indigo-400" />
          <p>Ma\'lumotnoma tekshirilmoqda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/90 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        {data?.valid ? (
          <>
            <div className="flex items-center gap-3 text-green-800 mb-4">
              <CheckCircle className="h-10 w-10 shrink-0" />
              <h1 className="text-xl font-bold text-slate-900">Ma\'lumotnoma haqiqiy</h1>
            </div>
            <p className="text-sm text-slate-500 mb-6">
              Ushbu UDK ma\'lumotnoma platforma tomonidan berilgan va tasdiqlangan.
            </p>
            <dl className="space-y-3 text-sm">
              {data.document_number && (
                <>
                  <dt className="text-slate-500">Hujjat raqami</dt>
                  <dd className="text-slate-900 font-mono">{data.document_number}</dd>
                </>
              )}
              {data.document_date && (
                <>
                  <dt className="text-slate-500">Hujjat sanasi</dt>
                  <dd className="text-slate-900">{data.document_date}</dd>
                </>
              )}
              {data.author_name && (
                <>
                  <dt className="text-slate-500">Muallif</dt>
                  <dd className="text-slate-900">{data.author_name}</dd>
                </>
              )}
              {data.title && (
                <>
                  <dt className="text-slate-500">Ish nomi</dt>
                  <dd className="text-slate-900">{data.title}</dd>
                </>
              )}
              {data.udk_code && (
                <>
                  <dt className="text-slate-500">UDK raqami</dt>
                  <dd className="text-indigo-300 font-mono font-semibold">{data.udk_code}</dd>
                </>
              )}
              {data.udk_description && (
                <>
                  <dt className="text-slate-500">Tavsif</dt>
                  <dd className="text-slate-600">{data.udk_description}</dd>
                </>
              )}
            </dl>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 text-red-700 mb-4">
              <XCircle className="h-10 w-10 shrink-0" />
              <h1 className="text-xl font-bold text-slate-900">Tekshirish natijasi</h1>
            </div>
            <p className="text-slate-600">
              {data?.detail || 'Ma\'lumotnoma topilmadi yoki haqiqiy emas.'}
            </p>
          </>
        )}
        <p className="text-xs text-slate-500 mt-6">
          www.ilmiyfaoliyat.uz — Phoenix Ilmiy Nashrlar Markazi
        </p>
      </Card>
    </div>
  );
};

export default UdkVerify;
