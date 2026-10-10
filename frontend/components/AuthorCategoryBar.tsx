import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Role } from '../types';
import {
  PUBLICATION_TYPES,
  SUBJECT_AREAS,
  categoryToSlug,
  slugToCategory,
} from '../constants/authorCategories';
import { BookOpen, Layers, Filter, X } from 'lucide-react';
import { useT } from '../i18n/LanguageContext';

const AuthorCategoryBar: React.FC = () => {
  const { t } = useT();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isBrowse = location.pathname === '/browse';
  const categoryParam = new URLSearchParams(location.search).get('category');
  const currentCategory = categoryParam ? slugToCategory(categoryParam) : '';

  const isPublicationType = (name: string) =>
    PUBLICATION_TYPES.includes(name as any);
  const isSubjectArea = (name: string) => SUBJECT_AREAS.includes(name as any);

  const selectedType =
    currentCategory && isPublicationType(currentCategory)
      ? currentCategory
      : '';
  const selectedSubject =
    currentCategory && isSubjectArea(currentCategory) ? currentCategory : '';

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (!value) {
      navigate('/browse');
      return;
    }
    navigate(`/browse?category=${categoryToSlug(value)}`);
  };

  const handleSubjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (!value) {
      navigate('/browse');
      return;
    }
    navigate(`/browse?category=${categoryToSlug(value)}`);
  };

  const clearFilter = () => {
    navigate('/browse');
  };

  const hasActiveFilter = Boolean(selectedType || selectedSubject);

  if (!user || user.role !== Role.Author) return null;

  return (
    <div className="flex-shrink-0 bg-white/65 backdrop-blur border-b border-slate-200/90">
      <div className="px-4 sm:px-6 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 text-sm font-medium text-slate-500 shrink-0">
            <Filter size={18} className="text-blue-800" />
            {t('Filtr')}
          </span>

          <div className="flex flex-wrap items-center gap-3 min-w-0 w-full sm:w-auto">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <BookOpen size={16} className="text-slate-500 shrink-0" />
              <select
                value={selectedType}
                onChange={handleTypeChange}
                className="bg-slate-100/70 border border-slate-200/90 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 w-full sm:w-auto sm:min-w-[200px] cursor-pointer"
                aria-label={t('Nashr turi')}
              >
                <option value="">{t('Barcha jurnallar')}</option>
                {PUBLICATION_TYPES.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Layers size={16} className="text-slate-500 shrink-0" />
              <select
                value={selectedSubject}
                onChange={handleSubjectChange}
                className="bg-slate-100/70 border border-slate-200/90 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 w-full sm:w-auto sm:min-w-[220px] cursor-pointer"
                aria-label={t('Soha')}
              >
                <option value="">{t('Barcha sohalar')}</option>
                {SUBJECT_AREAS.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {hasActiveFilter && (
              <button
                type="button"
                onClick={clearFilter}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-900 hover:bg-white/10 transition-colors"
                aria-label={t('Filterni tozalash')}
              >
                <X size={16} />
                {t('Tozalash')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthorCategoryBar;
