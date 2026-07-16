import React, { useState, useEffect, useRef, useCallback } from 'react';
import Card from './ui/Card';
import Button from './ui/Button';
import { apiService } from '../services/apiService';
import { toast } from 'react-toastify';
import { MessageSquare, Send } from 'lucide-react';

export interface OperatorChatMessage {
  id: string;
  body: string;
  created_at: string;
  display_name: string;
  is_from_author: boolean;
}

const POLL_MS = 5000;

interface AuthorOperatorChatProps {
  articleId: string;
  viewerIsAuthor: boolean;
  authorDisplayName?: string;
  /** O‘ng tomonda ixcham doimiy panel */
  variant?: 'default' | 'dock';
  /** Global panelda tashqi sarlavha bor — ichki gradient blokni yashirish */
  embeddedInGlobalDock?: boolean;
}

/**
 * Har bir maqola uchun alohida thread. Muallif xabarlari ism-familya bilan;
 * operator javoblari muallifga «Operator» nomi bilan chiqadi (backend serializer).
 */
const AuthorOperatorChat: React.FC<AuthorOperatorChatProps> = ({
  articleId,
  viewerIsAuthor,
  authorDisplayName,
  variant = 'default',
  embeddedInGlobalDock = false,
}) => {
  const [messages, setMessages] = useState<OperatorChatMessage[]>([]);
  const [text, setText] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      try {
        const data = await apiService.articles.getOperatorChatMessages(articleId);
        const list = Array.isArray(data) ? data : [];
        setMessages(list as OperatorChatMessage[]);
      } catch {
        if (!opts?.silent) {
          toast.error('Chat xabarlarini yuklashda xatolik.');
        }
      } finally {
        setInitialLoading(false);
      }
    },
    [articleId]
  );

  useEffect(() => {
    setInitialLoading(true);
    load();
  }, [articleId, load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      load({ silent: true });
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const b = text.trim();
    if (!b || sending) return;
    setSending(true);
    try {
      await apiService.articles.sendOperatorChatMessage(articleId, b);
      setText('');
      await load({ silent: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Yuborishda xatolik.';
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const isOwn = (msg: OperatorChatMessage) =>
    viewerIsAuthor ? msg.is_from_author : !msg.is_from_author;

  const title = viewerIsAuthor ? 'Operatorlar bilan yozishma' : 'Muallif bilan chat';
  const hint = viewerIsAuthor
    ? 'Xabaringiz barcha faol operatorlarga yetadi. Javoblar «Operator» nomidan ko‘rinadi.'
    : `Muallif: ${authorDisplayName || '—'}. Barcha operatorlar ushbu yozishmani ko‘ra oladi; javoblar muallifga umumiy «Operator» sifatida chiqadi.`;

  const isDock = variant === 'dock';

  const messagesBlock = (
    <div
      className={
        isDock
          ? 'flex-1 min-h-0 overflow-y-auto space-y-2.5 px-2 py-2 pr-1'
          : 'max-h-80 overflow-y-auto space-y-3 mb-4 pr-1'
      }
    >
      {initialLoading ? (
        <p className={`text-center text-slate-500 ${isDock ? 'py-4 text-xs' : 'py-6 text-sm'}`}>Yuklanmoqda...</p>
      ) : messages.length === 0 ? (
        <p className={`text-center text-slate-500 ${isDock ? 'py-4 text-xs' : 'py-6 text-sm'}`}>
          Hozircha xabar yo‘q. Birinchi xabarni yozing.
        </p>
      ) : (
        messages.map((msg) => {
          const own = isOwn(msg);
          return (
            <div key={msg.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`${isDock ? 'max-w-[92%] px-3 py-2' : 'max-w-[85%] sm:max-w-[70%] px-4 py-2.5'} rounded-2xl ${
                  own
                    ? 'bg-blue-600/90 text-white rounded-br-md'
                    : 'bg-white/90 text-slate-800 rounded-bl-md border border-slate-200/80 shadow-sm'
                }`}
              >
                <div className={`font-semibold opacity-90 mb-0.5 ${isDock ? 'text-[10px]' : 'text-xs'}`}>
                  {msg.display_name}
                </div>
                <p className={`whitespace-pre-wrap break-words ${isDock ? 'text-xs' : 'text-sm'}`}>{msg.body}</p>
                <div className={`mt-1 ${own ? 'text-blue-100' : 'text-slate-500'} ${isDock ? 'text-[9px]' : 'text-[10px]'}`}>
                  {new Date(msg.created_at).toLocaleString('uz-UZ')}
                </div>
              </div>
            </div>
          );
        })
      )}
      <div ref={bottomRef} />
    </div>
  );

  const inputBlock = (
    <div className={`flex gap-2 ${isDock ? 'flex-col shrink-0 p-2 border-t border-slate-200/80 bg-white/75 backdrop-blur-sm' : 'flex-col sm:flex-row'}`}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void send();
          }
        }}
        placeholder={isDock ? 'Xabar… (Enter — yuborish)' : 'Xabar yozing... (Enter — yuborish, Shift+Enter — yangi qator)'}
        rows={isDock ? 2 : 3}
        className={
          isDock
            ? 'w-full rounded-lg bg-white/95 border border-slate-200/90 text-slate-900 placeholder-slate-400 px-2.5 py-2 text-xs focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 resize-none min-h-[52px] shadow-sm'
            : 'flex-1 rounded-xl bg-white/95 border border-slate-200/90 text-slate-900 placeholder-slate-400 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 resize-y min-h-[80px] shadow-sm'
        }
        maxLength={10000}
      />
      <Button
        type="button"
        onClick={() => void send()}
        disabled={sending || !text.trim()}
        className={`${isDock ? 'w-full py-2 text-xs' : 'sm:self-end shrink-0'} flex items-center justify-center gap-2`}
        variant="primary"
      >
        <Send className={isDock ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        {sending ? 'Yuborilmoqda...' : 'Yuborish'}
      </Button>
    </div>
  );

  if (isDock) {
    return (
      <div className="flex flex-col h-full min-h-0 text-left">
        {!embeddedInGlobalDock && (
          <div className="shrink-0 px-3 py-2 border-b border-slate-200/80 bg-gradient-to-r from-sky-50/95 to-violet-50/90">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-600 shrink-0" />
              <span className="text-sm font-semibold text-slate-900 leading-tight">{title}</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-snug">{hint}</p>
          </div>
        )}
        {embeddedInGlobalDock && (
          <div className="shrink-0 px-2.5 py-1.5 border-b border-slate-200/80 bg-slate-50/90">
            <p className="text-[10px] text-slate-500 leading-snug line-clamp-2">{hint}</p>
          </div>
        )}
        {messagesBlock}
        {inputBlock}
      </div>
    );
  }

  return (
    <Card title={title}>
      <p className="text-sm text-slate-500 mb-4 flex items-start gap-2">
        <MessageSquare className="h-4 w-4 shrink-0 mt-0.5 text-blue-800" />
        {hint}
      </p>
      {messagesBlock}
      {inputBlock}
    </Card>
  );
};

export default AuthorOperatorChat;
