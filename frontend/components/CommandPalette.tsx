import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookMarked, CornerDownLeft, FileText, Search, User as UserIcon, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { flattenSidebarNav, type NavItem } from '../config/navConfig';
import { apiService } from '../services/apiService';
import { useT } from '../i18n/LanguageContext';
import { ARTICLE_STATUS_LABELS, Role } from '../types';

export const OPEN_SEARCH_EVENT = 'phx:open-search';

type ResultItem = {
  key: string;
  group: 'pages' | 'articles' | 'journals' | 'users';
  title: string;
  subtitle?: string;
  to: string;
  icon: React.ElementType;
};

const GROUP_LABELS: Record<ResultItem['group'], string> = {
  pages: "Bo'limlar",
  articles: 'Maqolalar',
  journals: 'Jurnallar',
  users: 'Foydalanuvchilar',
};

const ROLE_LABELS: Record<string, string> = {
  author: 'Muallif',
  reviewer: 'Taqrizchi',
  journal_admin: 'Jurnal administratori',
  super_admin: 'Bosh administrator',
  accountant: 'Moliyachi',
  operator: 'Operator',
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[‘’ʻʼ`]/g, "'");
}

/** Ctrl+K (yoki "/") — bo'limlar, maqolalar, jurnallar va foydalanuvchilarni tezkor qidirish. */
const CommandPalette: React.FC = () => {
  const { user } = useAuth();
  const { t } = useT();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setRemote([]);
    setActiveIdx(0);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((p) => !p);
      } else if (e.key === '/' && !typing && !open) {
        e.preventDefault();
        setOpen(true);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpen);
    };
  }, [open]);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);

  const pages = useMemo<ResultItem[]>(() => {
    if (!user) return [];
    const seen = new Set<string>();
    return flattenSidebarNav(user.role as Role)
      .filter((item: NavItem) => {
        if (seen.has(item.to)) return false;
        seen.add(item.to);
        return true;
      })
      .map((item) => ({
        key: `page-${item.to}`,
        group: 'pages' as const,
        title: t(item.label),
        to: item.to,
        icon: item.icon,
      }));
  }, [user, t]);

  // Server qidiruvi (250 ms kechikish bilan)
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2) {
      setRemote([]);
      setLoading(false);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const data = await apiService.search(q);
        if (id !== reqId.current) return;
        const rows: ResultItem[] = [
          ...(data.articles || []).map((a: any) => ({
            key: `a-${a.id}`,
            group: 'articles' as const,
            title: a.title,
            subtitle: [a.journal, ARTICLE_STATUS_LABELS[a.status] || a.status].filter(Boolean).join(' · '),
            to: a.link,
            icon: FileText,
          })),
          ...(data.journals || []).map((j: any) => ({
            key: `j-${j.id}`,
            group: 'journals' as const,
            title: j.name,
            subtitle: j.issn ? `ISSN ${j.issn}` : undefined,
            to: j.link,
            icon: BookMarked,
          })),
          ...(data.users || []).map((u: any) => ({
            key: `u-${u.id}`,
            group: 'users' as const,
            title: u.name,
            subtitle: [t(ROLE_LABELS[u.role] || u.role), u.phone].filter(Boolean).join(' · '),
            to: u.link,
            icon: UserIcon,
          })),
        ];
        setRemote(rows);
      } catch {
        if (id === reqId.current) setRemote([]);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, open, t]);

  const results = useMemo<ResultItem[]>(() => {
    const q = normalize(query.trim());
    const pageHits = q ? pages.filter((p) => normalize(p.title).includes(q)) : pages.slice(0, 8);
    return [...pageHits.slice(0, 6), ...remote];
  }, [pages, remote, query]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  if (!open || !user) return null;

  const go = (item: ResultItem) => {
    close();
    navigate(item.to);
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && results[activeIdx]) {
      e.preventDefault();
      go(results[activeIdx]);
    } else if (e.key === 'Escape') {
      close();
    }
  };

  let lastGroup = '';

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center p-4 pt-[10vh]" role="dialog" aria-modal="true" aria-label={t('Qidiruv')}>
      <button type="button" className="absolute inset-0 bg-[rgba(15,22,38,0.55)] backdrop-blur-[2px]" aria-label={t('Yopish')} onClick={close} />
      <div className="milliy-palette relative w-full max-w-[640px] overflow-hidden">
        <div className="flex items-center gap-3 px-4 border-b border-[var(--editorial-border)]">
          <Search className="w-5 h-5 text-[var(--editorial-muted)] shrink-0" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder={t("Maqola, jurnal yoki bo'lim nomini yozing...")}
            className="flex-1 min-w-0 h-14 bg-transparent outline-none text-base text-[var(--editorial-text)] placeholder:text-[var(--editorial-muted)]"
            aria-autocomplete="list"
            aria-controls="phx-palette-list"
          />
          {loading && <span className="w-4 h-4 rounded-full border-2 border-[var(--editorial-primary)] border-t-transparent animate-spin" aria-hidden />}
          <button type="button" onClick={close} className="editorial-icon-btn !w-8 !h-8" aria-label={t('Yopish')}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div ref={listRef} id="phx-palette-list" role="listbox" className="max-h-[60vh] overflow-y-auto py-2">
          {results.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-[var(--editorial-muted)]">
              {query.trim().length >= 2 && !loading ? t('Hech narsa topilmadi.') : t('Kamida 2 ta harf kiriting.')}
            </p>
          ) : (
            results.map((item, idx) => {
              const Icon = item.icon;
              const header =
                item.group !== lastGroup ? (
                  <p className="px-5 pt-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--editorial-muted)]">
                    {t(GROUP_LABELS[item.group])}
                  </p>
                ) : null;
              lastGroup = item.group;
              const isActive = idx === activeIdx;
              return (
                <React.Fragment key={item.key}>
                  {header}
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    data-idx={idx}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => go(item)}
                    className={`w-full flex items-center gap-3 px-5 py-2.5 text-left ${isActive ? 'bg-[var(--milliy-firuza-soft)]' : ''}`}
                  >
                    <span className="milliy-icon-tile milliy-icon-tile--sm shrink-0">
                      <Icon className="w-4 h-4" aria-hidden />
                    </span>
                    <span className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-semibold text-[var(--editorial-text)] truncate">{item.title}</span>
                      {item.subtitle && <span className="text-xs text-[var(--editorial-muted)] truncate">{item.subtitle}</span>}
                    </span>
                    {isActive && <CornerDownLeft className="w-4 h-4 text-[var(--editorial-muted)] shrink-0" aria-hidden />}
                  </button>
                </React.Fragment>
              );
            })
          )}
        </div>
        <div className="hidden sm:flex items-center gap-4 px-5 py-2.5 border-t border-[var(--editorial-border)] text-xs text-[var(--editorial-muted)]">
          <span><kbd className="milliy-kbd">↑</kbd> <kbd className="milliy-kbd">↓</kbd> {t('tanlash')}</span>
          <span><kbd className="milliy-kbd">Enter</kbd> {t('ochish')}</span>
          <span><kbd className="milliy-kbd">Esc</kbd> {t('yopish')}</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
