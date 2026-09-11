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
      className="editorial-icon-btn focus:outline-none"
      aria-label={isDark ? 'Kun rejimiga o‘tish' : 'Tun rejimiga o‘tish'}
      title={isDark ? 'Kun rejimi' : 'Tun rejimi'}
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
};

export default ThemeToggle;
