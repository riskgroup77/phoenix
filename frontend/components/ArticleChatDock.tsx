import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link, matchPath, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import AuthorOperatorChat from './AuthorOperatorChat';
import { useMediaMinWidth } from '../hooks/useMediaMinWidth';
import { useChatDockInsetPx } from '../hooks/useChatDockInsetPx';
import { getAppPathname } from '../utils/routerPath';
import { Role } from '../types';
import { FileText, MessageSquare } from 'lucide-react';

const LS_ACTIVE_ARTICLE_KEY = 'phoenix_global_chat_article_v1';

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

    if (roleNorm === 'operator' || roleNorm === 'super_admin') {
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
 * Barcha ichki sahifalarda o‘ng tomonda doimiy operator/muallif chati (~15% kenglik).
 * Thread maqola bo‘yicha; oxirgi tanlov saqlanadi yoki maqola sahifasida URL bilan yangilanadi.
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
  const isPrivilegedChatRole = roleNorm === 'operator' || roleNorm === 'super_admin';
  const isAuthorChatRole = roleNorm === 'author';
  const eligibleForGlobalChat = isPrivilegedChatRole || isAuthorChatRole;

  const showDock = isWideEnough && !!user && eligibleForGlobalChat;

  const panelWidthPx = useChatDockInsetPx(showDock);

  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [authorName, setAuthorName] = useState<string | undefined>(undefined);
  const [viewerIsAuthor, setViewerIsAuthor] = useState(false);
  const [articleOptions, setArticleOptions] = useState<{ id: string; title: string }[]>([]);
  const [listLoading, setListLoading] = useState(false);

  /** URL yoki saqlangan maqolaga mos thread */
  const syncSelection = useCallback(async () => {
    if (!user || !eligibleForGlobalChat) {
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
  }, [user, eligibleForGlobalChat, routeArticleId, roleNorm]);

  useEffect(() => {
    void syncSelection();
  }, [syncSelection]);

  /** Maqola ro‘yxati (tanlash uchun) */
  useEffect(() => {
    if (!showDock || !user) return;
    let cancelled = false;
    const loadList = async () => {
      setListLoading(true);
      try {
        const raw =
          user.role === Role.Author
            ? await apiService.articles.list({ author: String(user.id) })
            : await apiService.articles.list();
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
  }, [showDock, user]);

  useEffect(() => {
    if (!setMainRightInset) return;
    if (showDock && panelWidthPx > 0) {
      setMainRightInset(panelWidthPx);
    } else {
      setMainRightInset(0);
    }
    return () => {
      setMainRightInset(0);
    };
  }, [showDock, panelWidthPx, setMainRightInset]);

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

  if (!showDock) {
    return null;
  }

  return (
    <aside
      className="flex flex-col fixed right-0 z-[55] border-l border-slate-200/80 bg-white/80 backdrop-blur-2xl shadow-[-12px_0_48px_-16px_rgba(15,23,42,0.12)] top-[5.25rem] bottom-0 min-w-0"
      style={{ width: panelWidthPx }}
      aria-label="Operator va muallif chat paneli"
    >
      <div className="shrink-0 px-2.5 pt-2.5 pb-2 border-b border-slate-200/70 bg-gradient-to-br from-violet-50/95 via-white/90 to-cyan-50/90">
        <div className="flex items-center gap-2 text-slate-900">
          <MessageSquare className="h-4 w-4 text-violet-600 shrink-0" aria-hidden />
          <span className="text-xs font-semibold leading-tight">Operatorlar bilan aloqa</span>
        </div>
        <p className="text-[10px] text-slate-500 mt-1 leading-snug">
          Chat har doim ochiq. Suhbat tanlangan maqola bo‘yicha yuradi — boshqa sahifaga o‘tsangiz ham shu thread saqlanadi.
        </p>
        <label htmlFor="global-chat-article" className="sr-only">
          Maqola tanlash
        </label>
        <select
          id="global-chat-article"
          value={selectValue}
          disabled={listLoading || metaLoading}
          onChange={(e) => onSelectArticle(e.target.value)}
          className="mt-2 w-full rounded-lg bg-white/95 border border-slate-200/90 text-slate-900 text-[11px] py-2 px-2 shadow-sm focus:ring-2 focus:ring-violet-400/50 focus:border-violet-300"
        >
          <option value="">{listLoading ? 'Maqolalar yuklanmoqda…' : '— Maqola tanlang —'}</option>
          {articleOptions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title.length > 70 ? `${a.title.slice(0, 67)}…` : a.title}
            </option>
          ))}
        </select>
        <Link
          to="/articles"
          className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-violet-600 hover:text-violet-800 font-medium"
        >
          <FileText className="h-3 w-3 shrink-0" aria-hidden />
          Maqolalar ro‘yxati
        </Link>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {metaLoading && !selectedArticleId ? (
          <div className="flex-1 flex items-center justify-center px-3 py-6">
            <p className="text-xs text-slate-500 text-center">Tekshirilmoqda…</p>
          </div>
        ) : !selectedArticleId ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 px-3 py-6 text-center">
            <FileText className="h-8 w-8 text-slate-400" aria-hidden />
            <p className="text-xs text-slate-500 leading-relaxed">
              Operatorlarga yozish uchun yuqoridan o‘z maqolangizni tanlang yoki maqola kartasini oching — chat avtomatik bog‘lanadi.
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
    </aside>
  );
};

export default ArticleChatDock;
