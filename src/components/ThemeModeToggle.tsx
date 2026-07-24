'use client';

import { useEffect, useState } from 'react';

/**
 * Light/dark switch for the public pages (landing, login) where the full
 * SettingsModal isn't mounted. It writes the same `studypet-theme-mode`
 * localStorage key and flips the `data-theme` attribute the layout script
 * reads on load, so the choice persists into the authenticated app. Only the
 * mode changes here — accent and text variables are left as the layout set
 * them, since neither depends on light/dark.
 */
export default function ThemeModeToggle({
  className = '',
}: {
  className?: string;
}) {
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current =
      document.documentElement.getAttribute('data-theme') === 'dark'
        ? 'dark'
        : 'light';
    setMode(current);
    setMounted(true);
  }, []);

  function toggle() {
    const next = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('studypet-theme-mode', next);
    } catch {
      // Private-mode / blocked storage: the in-page toggle still works,
      // it just won't persist across reloads.
    }
  }

  const isDark = mode === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`btn-secondary h-11 w-11 !p-0 text-lg ${className}`}
    >
      {/* Avoid a hydration flash: render neutral until we've read the theme. */}
      <span aria-hidden="true">{!mounted ? '🌗' : isDark ? '☀️' : '🌙'}</span>
    </button>
  );
}
