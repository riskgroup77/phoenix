import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from '../components/ui/Card';
import { apiService } from '../services/apiService';
import { slugToCategory } from '../constants/authorCategories';
import Button from '../components/ui/Button';
import { BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

interface JournalItem {
  id: string;
  name: string;
  description?: string;
  issn?: string;
  category_name?: string;
  publication_fee?: number;
  price_per_page?: number;
  pricing_type?: string;
}

const BrowseByCategory: React.FC = () => {
  const [searchParams] = useSearchParams();
  const categorySlug = searchParams.get('category');
  const categoryName = categorySlug ? slugToCategory(categorySlug) : null;

  const [journals, setJournals] = useState<JournalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.journals.list();
      const list = Array.isArray(data) ? data : (data?.results ?? data?.data ?? []);
      const items = list.map((j: any) => ({
        id: j.id,
        name: j.name || j.title,
        description: j.description,
        issn: j.issn,
        category_name: j.category_name || j.category?.name,
        publication_fee: j.publication_fee != null ? Number(j.publication_fee) : undefined,
        price_per_page: j.price_per_page != null ? Number(j.price_per_page) : undefined,
        pricing_type: j.pricing_type,
      }));
      setJournals(items);
    } catch (e) {
      console.error('Failed to load journals', e);
      setJournals([]);
      setError('Jurnallar yuklanmadi. Keyinroq urinib ko‘ring.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = categoryName
    ? journals.filter(
        (j) =>
          j.category_name &&
          j.category_name.trim().toLowerCase() === categoryName.trim().toLowerCase()
      )
    : journals;

  const priceText = (j: JournalItem) => {
    const fixed =
      j.pricing_type === 'fixed' ||
      (j.publication_fee != null && j.publication_fee > 0 && !j.price_per_page);
    if (fixed) return `${(j.publication_fee ?? 0).toLocaleString()} so'm`;
    if (j.price_per_page != null) return `${j.price_per_page.toLocaleString()} so'm / sahifa`;
    return '';
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card title={categoryName ? `"${categoryName}" bo‘yicha jurnallar` : 'Jurnallar'}>
        {categoryName && (
          <p className="text-slate-500 text-sm mb-6 -mt-2">
            Ushbu kategoriyadagi jurnallar ro‘yxati. Maqola yuborish uchun «Maqola yuborish» bo‘limidan jurnal tanlang.
          </p>
        )}
        {error ? (
          <div className="text-center py-12">
            <p className="text-red-700 mb-4">{error}</p>
            <Button onClick={load}>Qayta urinish</Button>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-12" role="status" aria-live="polite">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent" aria-hidden="true" />
            <span className="sr-only">Yuklanmoqda</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="mx-auto h-12 w-12 text-slate-500" />
            <h3 className="mt-2 text-sm font-medium text-slate-900">
              {categoryName
                ? `"${categoryName}" bo‘yicha jurnal topilmadi`
                : 'Jurnal topilmadi'}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {categoryName
                ? 'Boshqa kategoriyani tanlang yoki jurnal administratori ushbu kategoriyaga jurnal qo‘shguncha kuting.'
                : 'Kategoriyani yuqoridagi menyudan tanlang.'}
            </p>
            <Link
              to="/submit"
              className="inline-block mt-4 text-blue-800 hover:text-blue-700 text-sm font-medium"
            >
              Maqola yuborish →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map((j) => (
              <div
                key={j.id}
                className="p-4 rounded-xl border border-slate-200/90 bg-slate-100/70 hover:bg-white/10 transition-colors"
              >
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-5 h-5 text-blue-800" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-slate-900">{j.name}</h3>
                    {j.category_name && (
                      <p className="text-xs text-slate-500 mt-0.5">{j.category_name}</p>
                    )}
                    {j.issn && (
                      <p className="text-xs text-slate-500 font-mono mt-1">{j.issn}</p>
                    )}
                    {priceText(j) && (
                      <p className="text-sm text-blue-900 mt-2">{priceText(j)}</p>
                    )}
                  </div>
                </div>
                {j.description && (
                  <p className="text-sm text-slate-500 mt-3 line-clamp-2">{j.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default BrowseByCategory;
