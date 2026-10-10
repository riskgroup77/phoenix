import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, Loader2, Paperclip, Sparkles, X } from 'lucide-react';
import { useT } from '../../i18n/LanguageContext';
import AiCards, { ActionSummary } from './AiCards';
import { AiAction, AiMessage } from './types';

const ACCEPT = '.doc,.docx,.pdf,.rtf,.odt,.txt';
const MAX_FILE_BYTES = 25 * 1024 * 1024;

type Props = {
  messages: AiMessage[];
  sending: boolean;
  loading: boolean;
  firstName: string;
  starterSuggestions: string[];
  onSend: (text: string, file: File | null) => void;
  onOpen: (path: string, label: string) => void;
  onOpenAction: (action: AiAction) => void;
  onFileError: (message: string) => void;
};

const AiChat: React.FC<Props> = ({
  messages, sending, loading, firstName, starterSuggestions, onSend, onOpen, onOpenAction, onFileError,
}) => {
  const { t } = useT();
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, sending]);

  const pickFile = (f: File | null | undefined) => {
    if (!f) return;
    const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
    if (!ACCEPT.split(',').includes(ext)) {
      onFileError(t('Faqat DOC, DOCX, PDF, RTF, ODT yoki TXT fayl biriktiring.'));
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      onFileError(t('Fayl hajmi 25 MB dan oshmasligi kerak.'));
      return;
    }
    setFile(f);
    inputRef.current?.focus();
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (sending || (!text.trim() && !file)) return;
    onSend(text.trim(), file);
    setText('');
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  const quick = messages.length === 0 ? starterSuggestions : lastAssistant?.payload?.suggestions || [];

  return (
    <section
      aria-label={t('AI yordamchi bilan suhbat')}
      className={`flex h-full min-h-0 flex-col bg-[var(--editorial-bg)] ${dragOver ? 'ring-2 ring-inset ring-[var(--editorial-primary)]' : ''}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        pickFile(e.dataTransfer.files?.[0]);
      }}
    >
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-5 sm:px-5" aria-live="polite">
        {loading ? (
          <div className="flex justify-center py-10 text-[var(--editorial-muted)]">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          </div>
        ) : messages.length === 0 ? (
          <div className="mx-auto max-w-md py-8 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--editorial-bg-alt)] text-[var(--editorial-teal,#0b6f74)]">
              <Sparkles className="h-6 w-6" aria-hidden />
            </div>
            <h2 className="text-xl font-extrabold text-[var(--editorial-text)]">
              {firstName ? t('Salom, {name}! Nima qilamiz?', { name: firstName }) : t('Salom! Nima qilamiz?')}
            </h2>
            <p className="text-sm text-[var(--editorial-muted)] leading-relaxed">
              {t("Yozing yoki faylni shu yerga tashlang — kerakli xizmat formasini o'ngda to'ldirib beraman. To'lov va yuborishni o'zingiz tasdiqlaysiz.")}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[88%] space-y-1.5">
                    {m.payload?.file && (
                      <div className="ml-auto flex w-fit items-center gap-1.5 rounded-lg bg-[var(--editorial-bg-alt)] px-2.5 py-1.5 text-xs text-[var(--editorial-text)]">
                        <Paperclip className="h-3.5 w-3.5" aria-hidden />
                        <span className="max-w-[220px] truncate">{m.payload.file.name}</span>
                      </div>
                    )}
                    {m.text && (
                      <div className="rounded-2xl rounded-br-md bg-[var(--editorial-primary)] px-3.5 py-2.5 text-[14px] leading-relaxed text-white whitespace-pre-line break-words">
                        {m.text}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex gap-2.5">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--editorial-bg-alt)] text-[var(--editorial-teal,#0b6f74)]">
                    <Sparkles className="h-4 w-4" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2.5">
                    {m.text && (
                      <div className="text-[14px] leading-relaxed text-[var(--editorial-text)] whitespace-pre-line break-words">{m.text}</div>
                    )}
                    {m.payload?.action && <ActionSummary action={m.payload.action} onOpenAction={onOpenAction} />}
                    {m.payload?.cards && m.payload.cards.length > 0 && (
                      <AiCards cards={m.payload.cards} onOpen={onOpen} onSend={(s) => onSend(s, null)} onOpenAction={onOpenAction} />
                    )}
                  </div>
                </div>
              ),
            )}
            {sending && (
              <div className="flex gap-2.5 items-center text-[var(--editorial-muted)] text-sm">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--editorial-bg-alt)]">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                </div>
                {t('Tayyorlanmoqda...')}
              </div>
            )}
          </div>
        )}
      </div>

      {quick.length > 0 && !sending && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-2 sm:px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="list" aria-label={t('Tez takliflar')}>
          {quick.map((s) => (
            <button
              key={s}
              type="button"
              role="listitem"
              onClick={() => onSend(s, null)}
              className="shrink-0 rounded-full border border-[var(--editorial-border)] bg-[var(--editorial-bg)] px-3 py-1.5 text-[13px] font-medium text-[var(--editorial-primary)] hover:bg-[var(--editorial-bg-alt)] min-h-[36px]"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="border-t border-[var(--editorial-border)] px-3 py-3 sm:px-4">
        {file && (
          <div className="mb-2 flex w-fit max-w-full items-center gap-2 rounded-lg bg-[var(--editorial-bg-alt)] px-2.5 py-1.5 text-xs text-[var(--editorial-text)]">
            <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{file.name}</span>
            <button type="button" aria-label={t('Faylni olib tashlash')} onClick={() => setFile(null)} className="p-1 text-[var(--editorial-muted)]">
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2 rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-bg)] p-1.5 focus-within:border-[var(--editorial-primary)]">
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          <button
            type="button"
            aria-label={t('Fayl biriktirish')}
            title={t('Fayl biriktirish')}
            onClick={() => fileRef.current?.click()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--editorial-muted)] hover:bg-[var(--editorial-bg-alt)]"
          >
            <Paperclip className="h-5 w-5" aria-hidden />
          </button>
          <label className="sr-only" htmlFor="ai-composer">{t('Xabar')}</label>
          <textarea
            id="ai-composer"
            ref={inputRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            maxLength={2000}
            placeholder={t("Masalan: maqolamni antiplagiatdan o'tkaz")}
            className="input-bare max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-1 py-2 text-[15px] text-[var(--editorial-text)] outline-none"
          />
          <button
            type="submit"
            aria-label={t('Yuborish')}
            disabled={sending || (!text.trim() && !file)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--editorial-primary)] text-white disabled:opacity-40"
          >
            {sending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <ArrowUp className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </form>
    </section>
  );
};

export default AiChat;
