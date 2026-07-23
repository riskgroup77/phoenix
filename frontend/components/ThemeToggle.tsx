import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white focus:outline-none transition-colors p-2 rounded-full hover:bg-slate-100/90 dark:hover:bg-slate-800/80"
      aria-label={isDark ? 'Kun rejimiga o‘tish' : 'Tun rejimiga o‘tish'}
      title={isDark ? 'Kun rejimi' : 'Tun rejimi'}
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
};

export default ThemeToggle;
