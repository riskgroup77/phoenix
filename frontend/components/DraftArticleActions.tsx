import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { Edit, Trash2 } from 'lucide-react';
import Card from './ui/Card';
import Button from './ui/Button';
import { apiService } from '../services/apiService';
import { useT } from '../i18n/LanguageContext';

type DraftArticle = { id: string; title: string; abstract: string; keywords: string[] };

type Props = {
  article: DraftArticle;
  onSaved: (updated: Partial<DraftArticle>) => void;
  onDeleted: () => void;
};

/** Muallif qoralamasi (to'lov qilinmagan): tahrirlash va o'chirish. */
const DraftArticleActions: React.FC<Props> = ({ article, onSaved, onDeleted }) => {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(article.title);
  const [abstract, setAbstract] = useState(article.abstract || '');
  const [keywords, setKeywords] = useState((article.keywords || []).join(', '));
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const startEdit = () => {
    setTitle(article.title);
    setAbstract(article.abstract || '');
    setKeywords((article.keywords || []).join(', '));
    setFile(null);
    setEditing(true);
  };

  const save = async () => {
    if (!title.trim()) {
      toast.error(t('Sarlavhani kiriting.'));
      return;
    }
    setSaving(true);
    try {
      const data = {
        title: title.trim(),
        abstract: abstract.trim(),
        keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
      };
      await apiService.articles.patchDraft(article.id, data, file);
      onSaved(data);
      setEditing(false);
      toast.success(t('Qoralama saqlandi.'));
    } catch (e: any) {
      toast.error(e?.message || t('Saqlashda xatolik.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(t("Qoralamani o'chirishni tasdiqlaysizmi? Bu amalni qaytarib bo'lmaydi."))) return;
    setDeleting(true);
    try {
      await apiService.articles.delete(article.id);
      toast.success(t("Qoralama o'chirildi."));
      onDeleted();
    } catch (e: any) {
      toast.error(e?.message || t("O'chirishda xatolik."));
      setDeleting(false);
    }
  };

  return (
    <Card title={t('Qoralama')}>
      {!editing ? (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-sm text-[var(--editorial-muted)]">
            {t("To'lov qilinmaguncha maqola ma'lumotlarini o'zgartirish yoki qoralamani o'chirish mumkin.")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={startEdit}>
              <Edit size={16} className="mr-2" /> {t('Tahrirlash')}
            </Button>
            <Button type="button" variant="secondary" onClick={remove} disabled={deleting}>
              <Trash2 size={16} className="mr-2" /> {deleting ? t("O'chirilmoqda...") : t("O'chirish")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium text-[var(--editorial-text)]">
            {t('Sarlavha')}
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="text-sm font-medium text-[var(--editorial-text)]">
            {t('Annotatsiya')}
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              rows={5}
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
            />
          </label>
          <label className="text-sm font-medium text-[var(--editorial-text)]">
            {t("Kalit so'zlar (vergul bilan)")}
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
            />
          </label>
          <label className="text-sm font-medium text-[var(--editorial-text)]">
            {t('Yangi fayl (ixtiyoriy)')}
            <input
              type="file"
              accept=".doc,.docx,.pdf"
              className="mt-1 block w-full text-sm"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? t('Saqlanmoqda...') : t('Saqlash')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(false)} disabled={saving}>
              {t('Bekor qilish')}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};

export default DraftArticleActions;
