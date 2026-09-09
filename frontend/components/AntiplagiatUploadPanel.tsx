import React, { useMemo, useRef, useState } from 'react';
import { X, ChevronDown } from 'lucide-react';
import {
  ANTIPLAGIAT_MODULES,
  HUJJAT_TURI_OPTIONS,
  loadEnabledModuleIds,
  saveEnabledModuleIds,
} from '../constants/antiplagiatModules';
import { formatMaxUploadLabel } from '../constants/upload';

type TabId = 'document' | 'modules';

export type AntiplagiatFormValues = {
  documentName: string;
  documentType: string;
  documentDescription: string;
  authorFirstName: string;
  authorLastName: string;
  file: File | null;
  enabledModuleIds: string[];
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
  const [tab, setTab] = useState<TabId>('document');
  const [typeOpen, setTypeOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const filteredTypes = useMemo(() => {
    const q = typeFilter.trim().toLowerCase();
    if (!q) return HUJJAT_TURI_OPTIONS;
    return HUJJAT_TURI_OPTIONS.filter((t) => t.toLowerCase().includes(q));
  }, [typeFilter]);

  const toggleModule = (id: string) => {
    const set = new Set(values.enabledModuleIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    const next = Array.from(set);
    saveEnabledModuleIds(next);
    onChange({ enabledModuleIds: next });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) onFileSelect(f);
  };

  const canSubmit =
    values.file &&
    values.documentName.trim() &&
    values.documentType &&
    values.authorFirstName.trim() &&
    values.authorLastName.trim() &&
    values.enabledModuleIds.length > 0 &&
    !isChecking;

  return (
    <div className="antiplagiat-panel mx-auto w-full max-w-3xl">
      <div className="antiplagiat-panel-header">
        <h2 className="antiplagiat-panel-title">Faylni tanlang</h2>
        {onClose && (
          <button type="button" className="antiplagiat-panel-close" onClick={onClose} aria-label="Yopish">
            <X size={20} />
          </button>
        )}
      </div>

      <div className="antiplagiat-tabs">
        <button
          type="button"
          className={`antiplagiat-tab ${tab === 'document' ? 'antiplagiat-tab-active' : ''}`}
          onClick={() => setTab('document')}
        >
          Hujjat
        </button>
        <button
          type="button"
          className={`antiplagiat-tab ${tab === 'modules' ? 'antiplagiat-tab-active' : ''}`}
          onClick={() => setTab('modules')}
        >
          Tekshirish modullari
        </button>
      </div>

      <div className="antiplagiat-panel-body">
        {tab === 'document' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="antiplagiat-label">Ism *</label>
                <input
                  className="antiplagiat-input"
                  value={values.authorFirstName}
                  onChange={(e) => onChange({ authorFirstName: e.target.value })}
                  placeholder="Ism"
                />
              </div>
              <div>
                <label className="antiplagiat-label">Familya *</label>
                <input
                  className="antiplagiat-input"
                  value={values.authorLastName}
                  onChange={(e) => onChange({ authorLastName: e.target.value })}
                  placeholder="Familya"
                />
              </div>
            </div>

            <div>
              <label className="antiplagiat-label">Hujjat nomi *</label>
              <input
                className="antiplagiat-input"
                value={values.documentName}
                onChange={(e) => onChange({ documentName: e.target.value })}
                placeholder="Hujjat nomini kiriting"
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
                Hujjatni shu joyga tortib tashlang yoki{' '}
                <span className="antiplagiat-link">hujjatni tanlang</span>
              </p>
              {values.file && (
                <p className="mt-2 text-sm font-medium text-slate-800">{values.file.name}</p>
              )}
              <p className="mt-1 text-xs text-slate-500">Maksimal: {formatMaxUploadLabel()} (.doc, .docx, .pdf)</p>
              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                accept=".pdf,.doc,.docx"
                onChange={(e) => onFileSelect(e.target.files?.[0] || null)}
              />
            </div>

            <div className="relative">
              <label className="antiplagiat-label">Hujjat turi *</label>
              <button
                type="button"
                className="antiplagiat-select-trigger"
                onClick={() => setTypeOpen((o) => !o)}
              >
                <span className={values.documentType ? 'text-slate-800' : 'text-slate-400'}>
                  {values.documentType || 'Hujjat turini tanlang'}
                </span>
                <ChevronDown size={18} className="text-slate-400 shrink-0" />
              </button>
              {typeOpen && (
                <div className="antiplagiat-select-dropdown">
                  <input
                    autoFocus
                    className="antiplagiat-select-search"
                    placeholder="Qidirish..."
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
                    {filteredTypes.length === 0 && (
                      <li className="px-3 py-2 text-sm text-slate-500">Topilmadi</li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            <div>
              <label className="antiplagiat-label">Hujjat tavsifi</label>
              <textarea
                className="antiplagiat-textarea"
                rows={4}
                value={values.documentDescription}
                onChange={(e) => onChange({ documentDescription: e.target.value })}
                placeholder="Hujjat haqida qisqacha ma'lumot"
              />
            </div>
          </div>
        ) : (
          <div className="antiplagiat-modules-grid">
            {ANTIPLAGIAT_MODULES.map((mod) => {
              const on = values.enabledModuleIds.includes(mod.id);
              return (
                <label key={mod.id} className="antiplagiat-module-row">
                  <span className="antiplagiat-module-label">{mod.label}</span>
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
        )}
      </div>

      <div className="antiplagiat-panel-footer">
        <p className="antiplagiat-price">
          Bitta hujjat tekshirish narxi{' '}
          <strong>{price.toLocaleString('uz-UZ')}</strong> so&apos;m
        </p>
        <button
          type="button"
          className="antiplagiat-submit-btn"
          disabled={!canSubmit}
          onClick={onSubmit}
        >
          {isChecking ? 'Tekshirilmoqda...' : 'Tekshirish'}
        </button>
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
  };
}

export default AntiplagiatUploadPanel;
