/**
 * Tarjimon navbati: «Puxta» tarjima buyurtmalari (to'langan) va AI bajara olmaganlari.
 * Backend ro'yxatni rol bo'yicha o'zi cheklaydi (apps/translations/views.py).
 */
import React, { useEffect, useMemo, useState } from 'react';
import EditorialPageHeader from '../components/EditorialPageHeader';
import EmptyState from '../components/EmptyState';
import { PageSkeleton } from '../components/ui/Skeleton';
import { useAuth } from '../contexts/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { apiService } from '../services/apiService';
import { TranslationStatus } from '../types';
import TranslationItem from './articles/TranslationItem';
import type { TranslationRequestApiResponse } from './articles/types';

type Tab = 'new' | 'mine' | 'done';

const TranslatorQueue: React.FC = () => {
  const { t } = useT();
  const { user } = useAuth();
  const [rows, setRows] = useState<TranslationRequestApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('new');

  useEffect(() => {
    let alive = true;
    apiService.translations
      .list()
      .then((data: any) => {
        if (alive) setRows(Array.isArray(data) ? data : data?.results ?? []);
      })
      .catch(() => alive && setRows([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const me = String(user?.id ?? '');
  const groups = useMemo(() => ({
    // Yangi: hali hech kim olmagan, to'langan buyurtmalar
    new: rows.filter((r) => r.status === TranslationStatus.Yangi && !r.reviewer
      && (Number(r.cost ?? 0) <= 0 || r.payment_completed !== false)),
    mine: rows.filter((r) => r.status === TranslationStatus.Jarayonda && String(r.reviewer) === me),
    done: rows.filter((r) => r.status === TranslationStatus.Bajarildi && String(r.reviewer) === me),
  }), [rows, me]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'new', label: 'Yangi buyurtmalar' },
    { id: 'mine', label: 'Mening ishlarim' },
    { id: 'done', label: 'Bajarilganlar' },
  ];

  if (loading) return <PageSkeleton />;

  const list = groups[tab];
  return (
    <div className="max-w-5xl mx-auto">
      <EditorialPageHeader
        title={t('Tarjima navbati')}
        subtitle={t("Puxta tarjima buyurtmalari va AI bajara olmagan tarjimalar. Buyurtmani oching, ishga oling va tayyor faylni yuklang.")}
      />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === item.id
                ? 'bg-[var(--editorial-primary)] text-white'
                : 'bg-slate-100/80 text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            {t(item.label)} ({groups[item.id].length})
          </button>
        ))}
      </div>
      {list.length ? (
        <div className="space-y-3">
          {list.map((r) => <TranslationItem key={r.id} request={r} />)}
        </div>
      ) : (
        <EmptyState
          illustration="inbox"
          title={t("Bu bo'limda buyurtma yo'q")}
          description={t("Yangi puxta tarjima buyurtmasi to'langanda bildirishnoma keladi.")}
        />
      )}
    </div>
  );
};

export default TranslatorQueue;
