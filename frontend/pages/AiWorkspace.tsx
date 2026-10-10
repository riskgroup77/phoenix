import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Menu, Sparkles, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { apiService } from '../services/apiService';
import { getUserFriendlyError } from '../utils/errorHandler';
import { setAuthorUi } from '../utils/authorUi';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ThemeToggle from '../components/ThemeToggle';
import AiSidebar from '../components/ai/AiSidebar';
import AiChat from '../components/ai/AiChat';
import AiWorkspacePanel from '../components/ai/AiWorkspacePanel';
import { AiAction, AiConversation, AiMessage, PanelTarget } from '../components/ai/types';

const STARTERS = [
  'Maqolamni jurnalga yuborish',
  "Antiplagiatdan o'tkazish",
  'Maqolalarim qayerda?',
  'UDK olish',
  'Kitob nashr etish',
  'Narxlar',
];

/** lg (1024px) dan tor ekranlar: chat to'liq, forma ustida ochiladi */
const useNarrow = () => {
  const query = '(max-width: 1023px)';
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
};

const AiWorkspace: React.FC = () => {
  const { user } = useAuth();
  const { t, lang } = useT();
  const navigate = useNavigate();
  const { conversationId } = useParams<{ conversationId?: string }>();
  const narrow = useNarrow();

  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(conversationId || null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [panel, setPanel] = useState<PanelTarget | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [panelOpenMobile, setPanelOpenMobile] = useState(false);
  const nonceRef = useRef(1);

  useEffect(() => {
    const prev = document.title;
    document.title = `${t('AI yordamchi')} — Phoenix`;
    return () => {
      document.title = prev;
    };
  }, [t]);

  const loadList = useCallback(async () => {
    try {
      const res = await apiService.assistant.listConversations();
      setConversations(Array.isArray(res?.results) ? res.results : []);
    } catch {
      /* ro'yxat bo'lmasa ham chat ishlaydi */
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const openTarget = useCallback(
    (target: Omit<PanelTarget, 'nonce'>) => {
      nonceRef.current += 1;
      setPanel({ ...target, nonce: nonceRef.current });
      if (narrow) setPanelOpenMobile(true);
    },
    [narrow],
  );

  const openAction = useCallback(
    (action: AiAction) => openTarget({ path: action.path, label: action.label, action }),
    [openTarget],
  );
  const openPath = useCallback((path: string, label: string) => openTarget({ path, label }), [openTarget]);

  // URL dagi suhbatni yuklash
  useEffect(() => {
    if (!conversationId) {
      setActiveId(null);
      setMessages([]);
      return;
    }
    if (conversationId === activeId && messages.length) return;
    let cancelled = false;
    setActiveId(conversationId);
    setLoading(true);
    apiService.assistant
      .getConversation(conversationId)
      .then((res) => {
        if (cancelled) return;
        setMessages(Array.isArray(res?.messages) ? res.messages : []);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(getUserFriendlyError(err));
        navigate('/ai', { replace: true });
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const send = useCallback(
    async (text: string, file: File | null) => {
      if (sending) return;
      const tempId = `tmp-${Date.now()}`;
      const optimistic: AiMessage = {
        id: tempId,
        role: 'user',
        text,
        payload: file ? { file: { name: file.name, size: file.size } } : {},
        created_at: new Date().toISOString(),
        pending: true,
      };
      setMessages((m) => [...m, optimistic]);
      setSending(true);
      try {
        let id = activeId;
        if (!id) {
          const conv = await apiService.assistant.createConversation();
          id = conv.id as string;
          setActiveId(id);
          navigate(`/ai/${id}`, { replace: true });
        }
        const res = await apiService.assistant.sendMessage(id!, { text, lang, file });
        if (file) setLastFile(file);
        setMessages((m) => [...m.filter((x) => x.id !== tempId), res.user_message, res.assistant_message]);
        const conv: AiConversation = res.conversation;
        setConversations((list) => [conv, ...list.filter((c) => c.id !== conv.id)]);
        const payload = res.assistant_message?.payload || {};
        if (payload.action) openAction(payload.action);
        else if (payload.open) openPath(payload.open.path, payload.open.label);
      } catch (err) {
        setMessages((m) => m.filter((x) => x.id !== tempId));
        toast.error(getUserFriendlyError(err));
      } finally {
        setSending(false);
      }
    },
    [sending, activeId, lang, navigate, openAction, openPath],
  );

  const newChat = () => {
    setDrawerOpen(false);
    setPanel(null);
    setLastFile(null);
    setMessages([]);
    setActiveId(null);
    navigate('/ai');
  };

  const selectChat = (id: string) => {
    setDrawerOpen(false);
    setPanel(null);
    setLastFile(null);
    setMessages([]);
    navigate(`/ai/${id}`);
  };

  const deleteChat = async (id: string) => {
    if (!window.confirm(t("Suhbat o'chirilsinmi?"))) return;
    try {
      await apiService.assistant.deleteConversation(id);
      setConversations((list) => list.filter((c) => c.id !== id));
      if (id === activeId) newChat();
    } catch (err) {
      toast.error(getUserFriendlyError(err));
    }
  };

  const goClassic = () => {
    setAuthorUi('classic');
    navigate('/dashboard');
  };

  const starters = useMemo(() => STARTERS.map((s) => t(s)), [t]);
  const sidebar = (
    <AiSidebar
      conversations={conversations}
      activeId={activeId}
      onSelect={selectChat}
      onNew={newChat}
      onDelete={deleteChat}
      onClassic={goClassic}
    />
  );

  return (
    <div className="flex h-[100dvh] flex-col bg-[var(--editorial-bg)] text-[var(--editorial-text)]">
      <header className="flex h-14 shrink-0 items-center gap-2 bg-[#1f3f8f] px-3 text-white sm:px-4">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label={t('Suhbatlar')}
          className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/10 xl:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <Link to="/ai" className="flex items-center gap-2 font-extrabold" aria-label="Phoenix AI">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#1f3f8f]">P</span>
          <span className="hidden sm:inline">Phoenix</span>
        </Link>
        <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold">
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> {t('AI yordamchi')}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
          <button
            type="button"
            onClick={goClassic}
            className="hidden h-9 items-center rounded-lg px-3 text-sm text-[#dbe4ff] hover:bg-white/10 md:inline-flex"
          >
            {t("Klassik ko'rinish")}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[260px] shrink-0 xl:block">{sidebar}</aside>

        <main
          className={`min-h-0 min-w-0 border-r border-[var(--editorial-border)] ${
            narrow ? 'flex-1' : panel ? 'w-[400px] shrink-0 2xl:w-[460px]' : 'flex-1 max-w-none'
          }`}
        >
          <AiChat
            messages={messages}
            sending={sending}
            loading={loading}
            firstName={user?.firstName || ''}
            starterSuggestions={starters}
            onSend={send}
            onOpen={openPath}
            onOpenAction={openAction}
            onFileError={(msg) => toast.error(msg)}
          />
        </main>

        {!narrow && (
          <section aria-label={t('Ish maydoni')} className={`min-h-0 min-w-0 bg-[var(--editorial-bg-alt)] ${panel ? 'flex-1' : 'w-[38%] max-w-[560px]'}`}>
            <AiWorkspacePanel target={panel} file={lastFile} onClose={() => setPanel(null)} />
          </section>
        )}
      </div>

      {narrow && panel && panelOpenMobile && (
        <div className="fixed inset-0 z-[90] bg-[var(--editorial-bg-alt)]" role="dialog" aria-modal="true" aria-label={t(panel.label)}>
          <AiWorkspacePanel target={panel} file={lastFile} onClose={() => setPanelOpenMobile(false)} mobile />
        </div>
      )}

      {drawerOpen && (
        <div className="fixed inset-0 z-[95] flex xl:hidden" role="dialog" aria-modal="true" aria-label={t('Suhbatlar')}>
          <div className="relative w-[280px] max-w-[85vw]">{sidebar}</div>
          <button type="button" aria-label={t('Yopish')} className="flex-1 bg-black/40" onClick={() => setDrawerOpen(false)}>
            <X className="ml-auto mr-4 mt-4 h-6 w-6 text-white" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
};

export default AiWorkspace;
