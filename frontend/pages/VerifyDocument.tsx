import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Card from '../components/ui/Card';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { API_V1_BASE_URL } from '../config/apiBase';

type VerifyResponse = {
  valid: boolean;
  type?: string;
  type_label?: string;
  document_number?: string;
  title?: string;
  author?: string;
  date?: string;
  details?: Record<string, unknown>;
  detail?: string;
};

const DETAIL_LABELS: Record<string, string> = {
  plagiarism_percent: "O'zlashtirish (%)",
  originality_percent: 'Originallik (%)',
  citation_percent: 'Iqtiboslar (%)',
  self_citation_percent: "O'z-o'ziga iqtibos (%)",
  algorithm_version: 'Algoritm versiyasi',
  journal: 'Jurnal',
  status: 'Holati',
  udk_code: 'UDK kodi',
  udk_description: 'UDK tavsifi',
  published_articles: 'Nashr etilgan maqolalar',
  amount: 'Summa',
};

/** Sertifikatlardagi QR kod: #/verify/<kod> — hujjat tizimda haqiqatan berilganini tekshiradi. */
const VerifyDocument: React.FC = () => {
  const { code = '' } = useParams<{ code: string }>();
  const [data, setData] = useState<VerifyResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const clean = code.trim();
    if (!clean) {
      setData({ valid: false, detail: 'Tekshirish uchun QR kodni skanerlang.' });
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`${API_V1_BASE_URL}/articles/verify/${encodeURIComponent(clean)}/`)
      .then((r) => r.json())
      .then((body: VerifyResponse) => setData(body))
      .catch(() => setData({ valid: false, detail: 'Tekshirishda xatolik. Keyinroq qayta urinib ko\'ring.' }))
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/90 flex items-center justify-center p-4">
        <div className="text-center text-slate-500">
          <Loader2 className="h-10 w-10 animate-spin mx-auto mb-3 text-indigo-400" />
          <p>Hujjat tekshirilmoqda...</p>
        </div>
      </div>
    );
  }

  const details = Object.entries(data?.details || {}).filter(
    ([, v]) => v !== null && v !== undefined && String(v) !== '',
  );

  return (
    <div className="min-h-screen bg-[var(--editorial-bg)] flex flex-col items-center justify-center gap-5 p-4">
      <a href="/#/" className="flex items-center gap-2.5 text-[var(--editorial-text)] no-underline">
        <span className="w-9 h-9 rounded-[10px] bg-[#1f3f8f] text-white flex items-center justify-center font-extrabold">P</span>
        <span className="flex flex-col leading-tight">
          <span className="font-extrabold">Phoenix</span>
          <span className="text-xs text-[var(--editorial-muted)]">Ilmiy nashrlar markazi · hujjatni tekshirish</span>
        </span>
      </a>
      <Card className="max-w-lg w-full">
        {data?.valid ? (
          <>
            <div className="flex items-center gap-3 text-green-800 mb-4">
              <CheckCircle className="h-10 w-10 shrink-0" />
              <h1 className="text-xl font-bold text-slate-900">Hujjat haqiqiy</h1>
            </div>
            <p className="text-sm text-slate-500 mb-6">
              Ushbu hujjat ilmiyfaoliyat.uz tizimi tomonidan berilgan.
            </p>
            <dl className="space-y-3 text-sm">
              {[
                ['Hujjat turi', data.type_label],
                ['Hujjat raqami', data.document_number],
                [data.type === 'receipt' ? 'Xizmat' : 'Nomi', data.title],
                [data.type === 'receipt' ? "To'lovchi" : 'Muallif', data.author],
                [data.type === 'receipt' ? "To'lov sanasi" : 'Sana', data.date],
              ]
                .filter(([, v]) => v)
                .map(([label, value]) => (
                  <div key={label as string}>
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="font-medium text-slate-900 break-words">{value}</dd>
                  </div>
                ))}
              {details.map(([key, value]) => (
                <div key={key}>
                  <dt className="text-slate-500">{DETAIL_LABELS[key] || key}</dt>
                  <dd className="font-medium text-slate-900 break-words">{String(value)}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <div className="flex items-start gap-3 text-red-800">
            <XCircle className="h-10 w-10 shrink-0" />
            <div>
              <h1 className="text-xl font-bold text-slate-900 mb-1">Hujjat tasdiqlanmadi</h1>
              <p className="text-sm text-slate-600">{data?.detail || 'Hujjat topilmadi yoki kod noto\'g\'ri.'}</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default VerifyDocument;
