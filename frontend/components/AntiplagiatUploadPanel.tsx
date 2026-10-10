import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Shield, Sparkles, Layers } from 'lucide-react';
import {
  HUJJAT_TURI_OPTIONS,
  MODULE_PRESET_LABELS,
  buildModulePresets,
  moduleCategories,
  type AntiplagiatCheckMode,
  type ModulePresetId,
  loadEnabledModuleIds,
  modulesForCheckMode,
  saveEnabledModuleIds,
} from '../constants/antiplagiatModules';
import { formatMaxUploadLabel } from '../constants/upload';
import { useAntiplagiatModules } from '../hooks/useAntiplagiatModules';
import GirihPattern from './GirihPattern';
import { useT } from '../i18n/LanguageContext';

type TabId = 'document' | 'modules';

export type AntiplagiatFormValues = {
  documentName: string;
  documentType: string;
  documentDescription: string;
  authorFirstName: string;
  authorLastName: string;
  file: File | null;
  enabledModuleIds: string[];
  checkMode: AntiplagiatCheckMode;
  modulePreset: ModulePresetId;
};

type Props = {
  values: AntiplagiatFormValues;
  onChange: (patch: Partial<AntiplagiatFormValues>) => void;
  price: number;
  isChecking: boolean;
  onSubmit: () => void;
  onClose?: () => void;
  onFileSelect: (file: File | null) => void;
};

const AntiplagiatUploadPanel: React.FC<Props> = ({
  values,
  onChange,
  price,
  isChecking,
  onSubmit,
  onClose,
  onFileSelect,
}) => {
  const { t: tr } = useT();
  const [tab, setTab] = useState<TabId>('document');
  const [typeOpen, setTypeOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [moduleSearch, setModuleSearch] = useState('');
  const [moduleCategory, setModuleCategory] = useState<string>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const { modules: availableModules, loaded: modulesLoaded } = useAntiplagiatModules();
  const presets = useMemo(() => buildModulePresets(availableModules), [availableModules]);
  const categories = useMemo(() => moduleCategories(availableModules), [availableModules]);
  const presetKeys = (Object.keys(MODULE_PRESET_LABELS) as ModulePresetId[]).filter((k) => presets[k].length > 0);

  // Server ro'yxati kelganda: tanlovda faqat haqiqatan mavjud modullar qolsin
  useEffect(() => {
    if (!modulesLoaded) return;
    const available = new Set(availableModules.map((m) => m.id));
    const kept = values.enabledModuleIds.filter((id) => available.has(id));
    const next = kept.length ? kept : loadEnabledModuleIds(availableModules);
    if (next.length !== values.enabledModuleIds.length || next.some((id, i) => id !== values.enabledModuleIds[i])) {
      onChange({ enabledModuleIds: next });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modulesLoaded, availableModules]);

  const filteredTypes = useMemo(() => {
    const q = typeFilter.trim().toLowerCase();
    if (!q) return HUJJAT_TURI_OPTIONS;
    return HUJJAT_TURI_OPTIONS.filter((t) => t.toLowerCase().includes(q));
  }, [typeFilter]);

  const filteredModules = useMemo(() => {
    const q = moduleSearch.trim().toLowerCase();
    return availableModules.filter((mod) => {
      if (moduleCategory !== 'all' && mod.category !== moduleCategory) return false;
      if (!q) return true;
      return mod.label.toLowerCase().includes(q) || mod.id.toLowerCase().includes(q);
    });
  }, [moduleSearch, moduleCategory, availableModules]);

  const applyPreset = (preset: ModulePresetId) => {
    const ids = [...presets[preset]];
    saveEnabledModuleIds(ids);
    onChange({ enabledModuleIds: ids, modulePreset: preset });
  };

  const setCheckMode = (mode: AntiplagiatCheckMode) => {
    const ids = modulesForCheckMode(mode, availableModules);
    saveEnabledModuleIds(ids);
    onChange({
      checkMode: mode,
      enabledModuleIds: ids,
      modulePreset: mode === 'ai' ? 'ai' : 'all',
    });
  };

  const toggleModule = (id: string) => {
    const set = new Set(values.enabledModuleIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    const next = Array.from(set);
    saveEnabledModuleIds(next);
    onChange({ enabledModuleIds: next, modulePreset: 'all' });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) onFileSelect(f);
  };

  const submitLabel =
    values.checkMode === 'ai'
      ? 'SI tahlili'
      : values.checkMode === 'both'
        ? 'Plagiat + SI tahlili'
        : 'Plagiatga tekshirish';

  const canSubmit =
    values.file &&
    values.documentName.trim() &&
    values.documentType &&
    values.authorFirstName.trim() &&
    values.authorLastName.trim() &&
    values.enabledModuleIds.length > 0 &&
    !isChecking;

  return (
    <div className="antiplagiat-page">
      <div className="antiplagiat-hero">
        <GirihPattern opacity={0.12} />
        <p className="antiplagiat-hero-kicker">{tr('Ilmiyfaoliyat.uz · Milliy antiplagiat xizmati')}</p>
        <h1 className="antiplagiat-hero-title">
          {tr('Originallik va SI matn aniqlash')}
        </h1>
        <p className="antiplagiat-hero-sub">{tr("Ichki baza va ochiq ilmiy manbalar ({length} ta modul) bo'yicha haqiqiy moslik qidiruvi, sertifikat va to'liq hisobot.", { length: availableModules.length })}</p>
        <div className="antiplagiat-mode-row">
          <button
            type="button"
            className={`antiplagiat-mode-btn ${values.checkMode === 'plagiarism' ? 'is-active' : ''}`}
            onClick={() => setCheckMode('plagiarism')}
          >
            <Shield size={18} />
            {tr('Plagiatga tekshirish')}
          </button>
          <button
            type="button"
            className={`antiplagiat-mode-btn ${values.checkMode === 'ai' ? 'is-active' : ''}`}
            onClick={() => setCheckMode('ai')}
          >
            <Sparkles size={18} />
            {tr('SI tahlili')}
          </button>
          <button
            type="button"
            className={`antiplagiat-mode-btn ${values.checkMode === 'both' ? 'is-active' : ''}`}
            onClick={() => setCheckMode('both')}
          >
            <Layers size={18} />
            {tr('Ikkalasi ham')}
          </button>
        </div>
      </div>

      <div className="antiplagiat-panel mx-auto w-full max-w-3xl">
        <div className="antiplagiat-panel-header">
          <h2 className="antiplagiat-panel-title">{tr('Yangi hujjat tekshirish')}</h2>
          {onClose && (
            <button type="button" className="antiplagiat-panel-close" onClick={onClose} aria-label={tr('Yopish')}>
              ×
            </button>
          )}
        </div>

        <div className="antiplagiat-tabs">
          <button
            type="button"
            className={`antiplagiat-tab ${tab === 'document' ? 'antiplagiat-tab-active' : ''}`}
            onClick={() => setTab('document')}
          >
            {tr('Hujjat')}
          </button>
          <button
            type="button"
            className={`antiplagiat-tab ${tab === 'modules' ? 'antiplagiat-tab-active' : ''}`}
            onClick={() => setTab('modules')}
          >{tr('Tekshirish modullari ({length})', { length: values.enabledModuleIds.length })}</button>
        </div>

        <div className="antiplagiat-panel-body">
          {tab === 'document' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="antiplagiat-label">{tr('Ism *')}</label>
                  <input
                    className="antiplagiat-input"
                    value={values.authorFirstName}
                    onChange={(e) => onChange({ authorFirstName: e.target.value })}
                    placeholder={tr('Ism')}
                  />
                </div>
                <div>
                  <label className="antiplagiat-label">{tr('Familya *')}</label>
                  <input
                    className="antiplagiat-input"
                    value={values.authorLastName}
                    onChange={(e) => onChange({ authorLastName: e.target.value })}
                    placeholder={tr('Familya')}
                  />
                </div>
              </div>

              <div>
                <label className="antiplagiat-label">{tr('Hujjat nomi *')}</label>
                <input
                  className="antiplagiat-input"
                  value={values.documentName}
                  onChange={(e) => onChange({ documentName: e.target.value })}
                  placeholder={tr('Hujjat nomini kiriting')}
                />
              </div>

              <div
                ref={dropRef}
                className="antiplagiat-dropzone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
              >
                <p className="text-sm text-slate-600">
                  {tr('Hujjatni shu joyga tortib tashlang yoki')}{' '}
                  <span className="antiplagiat-link">{tr('hujjatni tanlang')}</span>
                </p>
                {values.file && (
                  <p className="mt-2 text-sm font-medium text-slate-800">{values.file.name}</p>
                )}
                <p className="mt-1 text-xs text-slate-500">{tr('Maksimal: {value} (.doc, .docx, .pdf, .rtf, .odt)', { value: formatMaxUploadLabel() })}</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="sr-only"
                  accept=".pdf,.doc,.docx,.rtf,.odt"
                  onChange={(e) => onFileSelect(e.target.files?.[0] || null)}
                />
              </div>

              <div className="relative">
                <label className="antiplagiat-label">{tr('Hujjat turi *')}</label>
                <button
                  type="button"
                  className="antiplagiat-select-trigger"
                  onClick={() => setTypeOpen((o) => !o)}
                >
                  <span className={values.documentType ? 'text-slate-800' : 'text-slate-400'}>
                    {values.documentType || tr('Hujjat turini tanlang')}
                  </span>
                  <span className="text-slate-400">▾</span>
                </button>
                {typeOpen && (
                  <div className="antiplagiat-select-dropdown">
                    <input
                      autoFocus
                      className="antiplagiat-select-search"
                      placeholder={tr('Qidirish...')}
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                    />
                    <ul className="antiplagiat-select-list">
                      {filteredTypes.map((opt) => (
                        <li key={opt}>
                          <button
                            type="button"
                            className={`antiplagiat-select-option ${values.documentType === opt ? 'is-selected' : ''}`}
                            onClick={() => {
                              onChange({ documentType: opt });
                              setTypeOpen(false);
                              setTypeFilter('');
                            }}
                          >
                            {opt}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div>
                <label className="antiplagiat-label">{tr('Hujjat tavsifi')}</label>
                <textarea
                  className="antiplagiat-textarea"
                  rows={3}
                  value={values.documentDescription}
                  onChange={(e) => onChange({ documentDescription: e.target.value })}
                  placeholder={tr('Ixtiyoriy — hujjat haqida qisqacha')}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="antiplagiat-preset-row">
                {presetKeys.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`antiplagiat-preset-btn ${values.modulePreset === key ? 'is-active' : ''}`}
                    onClick={() => applyPreset(key)}
                  >
                    {MODULE_PRESET_LABELS[key]} ({presets[key].length})
                  </button>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  className="antiplagiat-input flex-1"
                  placeholder={tr('Modul qidirish...')}
                  value={moduleSearch}
                  onChange={(e) => setModuleSearch(e.target.value)}
                />
                <select
                  className="antiplagiat-input sm:max-w-[180px]"
                  value={moduleCategory}
                  onChange={(e) => setModuleCategory(e.target.value)}
                >
                  <option value="all">{tr('Barcha kategoriyalar')}</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="antiplagiat-modules-grid">
                {filteredModules.map((mod) => {
                  const on = values.enabledModuleIds.includes(mod.id);
                  return (
                    <label key={mod.id} className="antiplagiat-module-row">
                      <span className="antiplagiat-module-label" title={mod.description || mod.category}>
                        {mod.label}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        className={`antiplagiat-toggle ${on ? 'is-on' : ''}`}
                        onClick={() => toggleModule(mod.id)}
                      >
                        <span className="antiplagiat-toggle-knob" />
                      </button>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="antiplagiat-panel-footer">
          <p className="antiplagiat-price">
            {tr('Bitta hujjat tekshirish narxi')}{' '}
            <strong>{price.toLocaleString('uz-UZ')}</strong> {tr("so'm")}
          </p>
          <button
            type="button"
            className="antiplagiat-submit-btn"
            disabled={!canSubmit}
            onClick={onSubmit}
          >
            {isChecking ? tr('Tekshirilmoqda...') : submitLabel}
          </button>
        </div>
      </div>

      <div className="antiplagiat-features">
        <article className="antiplagiat-feature-card">
          <h3>{tr('Haqiqiy manbalar')}</h3>
          <p>{tr("Hisobotda faqat topilgan haqiqiy moslik va tekshirilgan bazalar ko'rsatiladi.")}</p>
        </article>
        <article className="antiplagiat-feature-card">
          <h3>{tr('Batafsil hisobot')}</h3>
          <p>{tr("O'zlashtirish, iqtibos, o'z-o'ziga iqtibos, manbalar va sertifikat.")}</p>
        </article>
        <article className="antiplagiat-feature-card">
          <h3>{tr('SI uslubi tahlili')}</h3>
          <p>{tr("Sun'iy intellektga xos iboralar bo'yicha taxminiy ko'rsatkich (dalil emas).")}</p>
        </article>
      </div>
    </div>
  );
};

export function createDefaultAntiplagiatForm(): AntiplagiatFormValues {
  return {
    documentName: '',
    documentType: '',
    documentDescription: '',
    authorFirstName: '',
    authorLastName: '',
    file: null,
    enabledModuleIds: loadEnabledModuleIds(),
    checkMode: 'both',
    modulePreset: 'all',
  };
};

export default AntiplagiatUploadPanel;
