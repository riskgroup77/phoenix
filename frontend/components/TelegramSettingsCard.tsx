import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { BellRing, CheckCircle, ExternalLink, Send } from 'lucide-react';
import { apiService } from '../services/apiService';
import { useT } from '../i18n/LanguageContext';

type Props = {
  connected: boolean;
  enabled: boolean;
  botUsername?: string;
  onChange: (enabled: boolean) => void;
};

/**
 * Telegram orqali xabarlar: maqola holati, to'lov, antiplagiat natijasi botga ham keladi.
 * Ulanish — botga telefon raqam va parol bilan bir marta kirish (bot sessiyani eslab qoladi).
 */
const TelegramSettingsCard: React.FC<Props> = ({ connected, enabled, botUsername, onChange }) => {
  const { t } = useT();
  const [saving, setSaving] = useState(false);
  const botLink = botUsername ? `https://t.me/${botUsername}` : '';

  const toggle = async () => {
    const next = !enabled;
    setSaving(true);
    try {
      await apiService.auth.updateProfile({ telegram_notifications: next });
      onChange(next);
      toast.success(next ? t('Telegram xabarlari yoqildi') : t("Telegram xabarlari o'chirildi"));
    } catch (e: any) {
      toast.error(e?.message || t("Sozlamani saqlab bo'lmadi"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="editorial-card flex flex-col gap-4" aria-labelledby="tg-settings">
      <div className="flex items-start gap-3">
        <span className="milliy-icon-tile shrink-0"><Send className="w-5 h-5" aria-hidden /></span>
        <div className="min-w-0">
          <h3 id="tg-settings" className="m-0 text-lg font-bold">{t('Telegram orqali xabarlar')}</h3>
          <p className="m-0 mt-1 text-sm text-[var(--editorial-muted)]">
            {t("Maqola holati o'zgarsa, to'lov o'tsa yoki antiplagiat tugasa — darhol Telegram'ga xabar keladi.")}
          </p>
        </div>
      </div>

      {connected ? (
        <div className="flex items-center gap-2 text-sm font-semibold text-[#15803d] dark:text-[#4ade80]">
          <CheckCircle className="w-4 h-4" aria-hidden /> {t('Telegram bot ulangan')}
        </div>
      ) : (
        <div className="rounded-[10px] bg-[var(--editorial-bg-alt)] p-3.5 text-sm text-[var(--editorial-body)] flex flex-col gap-2">
          <p className="m-0 font-semibold">{t('Qanday ulash mumkin:')}</p>
          <ol className="m-0 pl-5 list-decimal space-y-1">
            <li>{t('Botni oching va «Start» tugmasini bosing.')}</li>
            <li>{t('«Kirish» orqali saytdagi telefon raqam va parolingizni kiriting.')}</li>
            <li>{t("Shundan so'ng xabarlar avtomatik keladi.")}</li>
          </ol>
          {botLink && (
            <a href={botLink} target="_blank" rel="noopener noreferrer" className="milliy-btn-primary self-start !min-h-[2.5rem] text-sm mt-1">
              <Send className="w-4 h-4" aria-hidden /> {t('Botni ochish')} <ExternalLink className="w-3.5 h-3.5" aria-hidden />
            </a>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <span id="tg-switch-label" className="flex items-center gap-2 text-sm font-semibold">
          <BellRing className="w-4 h-4 text-[var(--milliy-firuza)]" aria-hidden />
          {t('Bildirishnomalarni Telegramga yuborish')}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-labelledby="tg-switch-label"
          disabled={saving}
          onClick={toggle}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
            enabled ? 'bg-[var(--milliy-firuza)]' : 'bg-[var(--editorial-border)]'
          } ${saving ? 'opacity-60' : ''}`}
        >
          <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>
    </section>
  );
};

export default TelegramSettingsCard;
