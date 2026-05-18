import React from 'react';
import { useTheme } from '../hooks/useTheme';

type Theme = 'light' | 'dark' | 'system';

interface ThemeSelectorProps {
  className?: string;
}

export function ThemeSelector({ className }: ThemeSelectorProps) {
  const { theme, setTheme } = useTheme();

  const handleThemeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newTheme = event.target.value as Theme;
    setTheme(newTheme);
  };

  return (
    <div className={`theme-selector ${className || ''}`}>
      <label htmlFor="theme-selector" className="theme-label">Theme</label>
      <select
        id="theme-selector"
        value={theme}
        onChange={handleThemeChange}
        className="theme-select"
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>
  );
}