import React from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, Plus, Trash2 } from 'lucide-react';
import { useT } from '../../i18n/LanguageContext';
import { AiConversation } from './types';

type Props = {
  conversations: AiConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClassic: () => void;
};

const dayKey = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.floor((today.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
  return diff <= 0 ? 'Bugun' : diff === 1 ? 'Kecha' : diff < 7 ? 'Shu hafta' : 'Oldingi';
};

const AiSidebar: React.FC<Props> = ({ conversations, activeId, onSelect, onNew, onDelete, onClassic }) => {
  const { t } = useT();
  const groups: { key: string; items: AiConversation[] }[] = [];
  conversations.forEach((c) => {
    const k = dayKey(c.updated_at);
    const g = groups.find((x) => x.key === k);
    if (g) g.items.push(c);
    else groups.push({ key: k, items: [c] });
  });

  return (
    <nav aria-label={t('Suhbatlar')} className="flex h-full min-h-0 flex-col bg-[#0f2453] text-[#dbe4ff]">
      <div className="p-3">
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#3a5694] bg-[#1f3f8f] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[#25489f] min-h-[44px]"
        >
          <Plus className="h-4 w-4" aria-hidden /> {t('Yangi suhbat')}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {conversations.length === 0 && (
          <p className="px-3 py-4 text-xs leading-relaxed text-[#93a6d4]">{t("Suhbatlar shu yerda saqlanadi.")}</p>
        )}
        {groups.map((g) => (
          <div key={g.key} className="mb-3">
            <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-[#93a6d4]">{t(g.key)}</div>
            <ul className="space-y-0.5">
              {g.items.map((c) => (
                <li key={c.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    aria-current={c.id === activeId ? 'page' : undefined}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 pr-9 text-left text-sm ${
                      c.id === activeId ? 'bg-[#23407d] text-white' : 'hover:bg-[#1a3570]'
                    }`}
                  >
                    <MessageSquare className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                    <span className="truncate">{c.title || t('Yangi suhbat')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(c.id)}
                    aria-label={t("Suhbatni o'chirish")}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-[#93a6d4] opacity-0 hover:text-white focus:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-[#23407d] p-3 space-y-1">
        <Link to="/articles" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-[#1a3570]">
          {t('Maqolalarim')}
        </Link>
        <button
          type="button"
          onClick={onClassic}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-[#1a3570]"
        >
          <LayoutDashboard className="h-4 w-4" aria-hidden /> {t("Klassik ko'rinish")}
        </button>
      </div>
    </nav>
  );
};

export default AiSidebar;
