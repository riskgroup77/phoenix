import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

/** variant="band": lojuvard yuqori panel ustida (oq belgi) */
const ThemeToggle: React.FC<{ variant?: 'default' | 'band' }> = ({ variant = 'default' }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={variant === 'band' ? 'milliy-band-btn' : 'editorial-icon-btn'}
      aria-label={isDark ? 'Kun rejimiga o‘tish' : 'Tun rejimiga o‘tish'}
      title={isDark ? 'Kun rejimi' : 'Tun rejimi'}
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
};

export default ThemeToggle;
