import React from 'react';
import { BookOpen, FileDown, Printer } from 'lucide-react';
import Button from './ui/Button';
import NashrHisobotCertificate, { type NashrHisobotData } from './NashrHisobotCertificate';
import { downloadNashrHisobotDocx } from '../utils/exportNashrHisobotDocx';
import { toast } from 'react-toastify';

interface Props {
  open: boolean;
  onClose: () => void;
  data: NashrHisobotData;
}

const NashrHisobotModal: React.FC<Props> = ({ open, onClose, data }) => {
  if (!open) return null;

  const hasRows = data.articles.length > 0;

  return (
    <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-sm z-50 flex justify-center items-center p-4 print:p-0 print:bg-white no-print">
      <div className="w-full max-w-6xl h-[95vh] bg-white rounded-lg shadow-2xl flex flex-col print:max-w-none print:h-auto print:rounded-none print:shadow-none">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center gap-3 flex-wrap no-print">
          <h3 className="text-lg font-semibold text-slate-900">Maqolalar nashri haqida hisobot</h3>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={async () => {
                try {
                  await downloadNashrHisobotDocx(data);
                  toast.success('Hisobot Word (.docx) fayl sifatida yuklandi');
                } catch {
                  toast.error('Yuklab olishda xatolik');
                }
              }}
              variant="primary"
              disabled={!hasRows}
              className="flex items-center gap-2"
            >
              <FileDown className="h-4 w-4" /> Yuklab olish (.docx)
            </Button>
            <Button onClick={() => window.print()} variant="secondary" disabled={!hasRows}>
              <Printer className="mr-2 h-4 w-4" /> Chop etish / PDF
            </Button>
            <Button onClick={onClose} variant="secondary">
              Yopish
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 print:p-0 print:overflow-visible">
          {hasRows ? (
            <NashrHisobotCertificate data={data} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-[320px] text-center py-12">
              <BookOpen size={64} className="text-slate-400 mb-4" />
              <h4 className="text-xl font-semibold text-slate-900 mb-2">Nashr qilingan ishlar yo&apos;q</h4>
              <p className="text-slate-500 max-w-md text-sm">
                Hisobot yaratish uchun kamida bitta nashr etilgan platforma maqolasi yoki «Boshqa nashrlar»
                bo&apos;limidagi ilmiy ish qo&apos;shilgan bo&apos;lishi kerak.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NashrHisobotModal;
