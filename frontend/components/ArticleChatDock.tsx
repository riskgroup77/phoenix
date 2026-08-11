import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link, matchPath, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import AuthorOperatorChat from './AuthorOperatorChat';
import { useMediaMinWidth } from '../hooks/useMediaMinWidth';
import { getAppPathname } from '../utils/routerPath';
import { Role } from '../types';
import { FileText, MessageSquare, X } from 'lucide-react';

const LS_ACTIVE_ARTICLE_KEY = 'phoenix_global_chat_article_v1';
const LS_CHAT_OPEN_KEY = 'phoenix_global_chat_open_v1';

/** Planshet+ */
export const ARTICLE_CHAT_DOCK_BREAKPOINT_PX = 768;

export const MainRightInsetContext = React.createContext<React.Dispatch<React.SetStateAction<number>> | null>(null);

function extractAuthorId(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === 'string') return raw.trim() || null;
  if (typeof raw === 'object' && raw !== null && 'id' in raw) {
    const id = (raw as { id: unknown }).id;
    if (typeof id === 'string') return id.trim() || null;
    if (id != null) return String(id);
  }
  return null;
}

function readStoredArticleId(): string | null {
  try {
    const v = localStorage.getItem(LS_ACTIVE_ARTICLE_KEY);
    return v?.trim() || null;
  } catch {
    return null;
  }
}

function writeStoredArticleId(id: string | null): void {
  try {
    if (id) localStorage.setItem(LS_ACTIVE_ARTICLE_KEY, id);
    else localStorage.removeItem(LS_ACTIVE_ARTICLE_KEY);
  } catch {
    /* ignore */
  }
}

function readChatOpen(): boolean {
  try {
    return localStorage.getItem(LS_CHAT_OPEN_KEY) === '1';
  } catch {
    return false;
  }
}

function writeChatOpen(open: boolean): void {
  try {
    if (open) localStorage.setItem(LS_CHAT_OPEN_KEY, '1');
    else localStorage.removeItem(LS_CHAT_OPEN_KEY);
  } catch {
    /* ignore */
  }
}

function normalizeArticlesList(raw: unknown): { id: string; title: string }[] {
  let arr: unknown[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.results)) arr = o.results;
    else if (Array.isArray(o.data)) arr = o.data;
  }
  return arr
    .map((row) => {
      const r = row as { id?: unknown; title?: unknown };
      if (r?.id == null) return null;
      const id = String(r.id);
      const title = typeof r.title === 'string' && r.title.trim() ? r.title.trim() : '(Nomsiz)';
      return { id, title };
    })
    .filter((x): x is { id: string; title: string } => x != null);
}

type AccessMeta = {
  ok: boolean;
  authorName?: string;
  viewerIsAuthor: boolean;
};

async function fetchArticleAccessMeta(
  articleId: string,
  roleNorm: string,
  userId: string | undefined
): Promise<AccessMeta> {
  try {
    const res = await apiService.articles.get(articleId);
    const data = (res as { data?: Record<string, unknown> }).data ?? res;
    const authorRaw = (data as { author?: unknown }).author;
    const authorName =
      typeof (data as { author_name?: string }).author_name === 'string'
        ? (data as { author_name: string }).author_name
        : undefined;
    const aid = extractAuthorId(authorRaw);
    const uid = userId != null ? String(userId).toLowerCase().replace(/-/g, '') : '';
    const aidx = aid != null ? aid.toLowerCase().replace(/-/g, '') : '';

    if (roleNorm === 'operator') {
      return { ok: true, authorName, viewerIsAuthor: false };
    }
    if (roleNorm === 'author') {
      const viewerIsAuthor = uid !== '' && aidx !== '' && uid === aidx;
      return { ok: viewerIsAuthor, authorName, viewerIsAuthor };
    }
    return { ok: false, viewerIsAuthor: false };
  } catch {
    return { ok: false, viewerIsAuthor: false };
  }
}

/**
 * Muallif va operator uchun past-o‘ng burchakdagi ixcham chat (FAB + ochiladigan panel).
 * Admin/tahrirchi uchun ko‘rsatilmaydi — asosiy kontentni egallamaydi.
 */
const ArticleChatDock: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const setMainRightInset = useContext(MainRightInsetContext);
  const isWideEnough = useMediaMinWidth(ARTICLE_CHAT_DOCK_BREAKPOINT_PX);

  const appPath = getAppPathname(location);
  const routeMatch =
    matchPath({ path: '/articles/:id', end: true }, appPath) ||
    matchPath({ path: '/articles/:id/', end: true }, appPath);
  const routeArticleId = routeMatch?.params?.id ?? null;

  const roleNorm = typeof user?.role === 'string' ? user.role.toLowerCase() : String(user?.role ?? '');
  const isOperator = roleNorm === 'operator';
  const isAuthor = roleNorm === 'author';
  const eligibleForChat = isOperator || isAuthor;
  const showWidget = isWideEnough && !!user && eligibleForChat;

  const [open, setOpen] = useState(readChatOpen);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [authorName, setAuthorName] = useState<string | undefined>(undefined);
  const [viewerIsAuthor, setViewerIsAuthor] = useState(false);
  const [articleOptions, setArticleOptions] = useState<{ id: string; title: string }[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const chatTitle = isAuthor ? 'Operatorlar bilan yozishma' : 'Muallif bilan chat';

  const syncSelection = useCallback(async () => {
    if (!user || !eligibleForChat) {
      setSelectedArticleId(null);
      setAuthorName(undefined);
      setViewerIsAuthor(false);
      return;
    }

    setMetaLoading(true);
    try {
      if (routeArticleId) {
        const m = await fetchArticleAccessMeta(routeArticleId, roleNorm, user.id);
        if (m.ok) {
          setSelectedArticleId(routeArticleId);
          writeStoredArticleId(routeArticleId);
          setAuthorName(m.authorName);
          setViewerIsAuthor(m.viewerIsAuthor);
          return;
        }
      }

      const stored = readStoredArticleId();
      if (stored) {
        const m = await fetchArticleAccessMeta(stored, roleNorm, user.id);
        if (m.ok) {
          setSelectedArticleId(stored);
          setAuthorName(m.authorName);
          setViewerIsAuthor(m.viewerIsAuthor);
          return;
        }
        writeStoredArticleId(null);
      }

      setSelectedArticleId(null);
      setAuthorName(undefined);
      setViewerIsAuthor(false);
    } finally {
      setMetaLoading(false);
    }
  }, [user, eligibleForChat, routeArticleId, roleNorm]);

  useEffect(() => {
    void syncSelection();
  }, [syncSelection]);

  useEffect(() => {
    if (!eligibleForChat) {
      setOpen(false);
      writeChatOpen(false);
      setSelectedArticleId(null);
      writeStoredArticleId(null);
    }
  }, [eligibleForChat]);

  useEffect(() => {
    if (!showWidget || !user) return;
    let cancelled = false;
    const loadList = async () => {
      setListLoading(true);
      try {
        const raw =
          user.role === Role.Author
            ? await apiService.articles.list({ author: String(user.id) })
            : await apiService.articles.getOperatorChatInbox();
        if (!cancelled) setArticleOptions(normalizeArticlesList(raw));
      } catch {
        if (!cancelled) setArticleOptions([]);
      } finally {
        if (!cancelled) setListLoading(false);
      }
    };
    void loadList();
    return () => {
      cancelled = true;
    };
  }, [showWidget, user]);

  useEffect(() => {
    setMainRightInset?.(0);
    return () => setMainRightInset?.(0);
  }, [setMainRightInset]);

  const onSelectArticle = useCallback(
    (id: string) => {
      if (!id.trim()) {
        setSelectedArticleId(null);
        writeStoredArticleId(null);
        setAuthorName(undefined);
        setViewerIsAuthor(false);
        return;
      }
      void (async () => {
        setMetaLoading(true);
        try {
          const m = await fetchArticleAccessMeta(id.trim(), roleNorm, user?.id);
          if (m.ok) {
            setSelectedArticleId(id.trim());
            writeStoredArticleId(id.trim());
            setAuthorName(m.authorName);
            setViewerIsAuthor(m.viewerIsAuthor);
          }
        } finally {
          setMetaLoading(false);
        }
      })();
    },
    [roleNorm, user?.id]
  );

  const selectValue = useMemo(() => selectedArticleId ?? '', [selectedArticleId]);

  const toggleOpen = (next: boolean) => {
    setOpen(next);
    writeChatOpen(next);
  };

  if (!showWidget) {
    return null;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => toggleOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg px-4 py-3 text-sm font-semibold transition-colors"
        aria-label={chatTitle}
      >
        <MessageSquare className="h-5 w-5 shrink-0" aria-hidden />
        <span className="hidden sm:inline">{isAuthor ? 'Operator chat' : 'Muallif chat'}</span>
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-40 flex flex-col w-[min(380px,calc(100vw-1.5rem))] max-h-[min(70vh,640px)] rounded-2xl border border-slate-200/90 dark:border-slate-700/60 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
      aria-label={chatTitle}
    >
      <div className="shrink-0 px-3 py-2.5 border-b border-slate-200/80 dark:border-slate-700/60 flex items-start justify-between gap-2 bg-slate-50/80 dark:bg-slate-800/50">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white">
            <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" aria-hidden />
            <span className="text-sm font-semibold truncate">{chatTitle}</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
            Maqola bo‘yicha suhbat. Boshqa sahifaga o‘tsangiz ham saqlanadi.
          </p>
        </div>
        <button
          type="button"
          onClick={() => toggleOpen(false)}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/80 dark:hover:bg-slate-700 shrink-0"
          aria-label="Chatni yopish"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="shrink-0 px-3 py-2 border-b border-slate-100 dark:border-slate-800 space-y-1.5">
        <label htmlFor="global-chat-article" className="sr-only">
          Maqola tanlash
        </label>
        <select
          id="global-chat-article"
          value={selectValue}
          disabled={listLoading || metaLoading}
          onChange={(e) => onSelectArticle(e.target.value)}
          className="pinm-field w-full rounded-lg text-xs py-2 px-2"
        >
          <option value="">{listLoading ? 'Maqolalar yuklanmoqda…' : '— Maqola tanlang —'}</option>
          {articleOptions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title.length > 60 ? `${a.title.slice(0, 57)}…` : a.title}
            </option>
          ))}
        </select>
        <Link
          to="/articles"
          className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium"
        >
          <FileText className="h-3 w-3 shrink-0" aria-hidden />
          Maqolalar ro‘yxati
        </Link>
      </div>

      <div className="flex-1 min-h-0 flex flex-col min-h-[200px]">
        {metaLoading && !selectedArticleId ? (
          <div className="flex-1 flex items-center justify-center px-3 py-6">
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">Tekshirilmoqda…</p>
          </div>
        ) : !selectedArticleId ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 px-3 py-6 text-center">
            <FileText className="h-7 w-7 text-slate-400" aria-hidden />
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {isAuthor
                ? 'Yuqoridan maqolangizni tanlang yoki maqola sahifasini oching.'
                : 'Maqola tanlang — muallif bilan suhbat shu yerda ochiladi.'}
            </p>
          </div>
        ) : (
          <AuthorOperatorChat
            key={selectedArticleId}
            articleId={selectedArticleId}
            viewerIsAuthor={viewerIsAuthor}
            authorDisplayName={authorName}
            variant="dock"
            embeddedInGlobalDock
          />
        )}
      </div>
    </div>
  );
};

export default ArticleChatDock;
