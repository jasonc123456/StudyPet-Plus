'use client';

import { useEffect, useState } from 'react';

const DEFAULT_ACCENT = '#4f46e5';
const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
  user: {
    name?: string | null;
    email?: string | null;
  };
};

type SettingsTab = 'profile' | 'theme';

function isLightColor(hex: string) {
  if (!HEX_COLOR_REGEX.test(hex)) return false;
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.72;
}

function applyTheme(mode: 'light' | 'dark', accent: string) {
  const sidebarText = isLightColor(accent) ? '#111111' : '#f8fafc';
  const sidebarDivider = isLightColor(accent)
    ? 'rgba(17, 17, 17, 0.14)'
    : 'rgba(255, 255, 255, 0.12)';

  document.documentElement.setAttribute('data-theme', mode);
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--accent-strong', accent);
  document.documentElement.style.setProperty('--accent-soft', `${accent}18`);
  document.documentElement.style.setProperty('--sidebar-bg', accent);
  document.documentElement.style.setProperty(
    '--sidebar-active-bg',
    `${accent}33`
  );
  document.documentElement.style.setProperty('--sidebar-active-border', accent);
  document.documentElement.style.setProperty('--sidebar-text', sidebarText);
  document.documentElement.style.setProperty(
    '--sidebar-text-strong',
    sidebarText
  );
  document.documentElement.style.setProperty(
    '--sidebar-divider',
    sidebarDivider
  );
}

export function SettingsModal({ open, onClose, user }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [draftAccent, setDraftAccent] = useState(DEFAULT_ACCENT);
  const [error, setError] = useState<string | null>(null);

  const nameParts = (user.name ?? 'Demo Student').split(' ');
  const firstName = nameParts[0] ?? 'Demo';
  const lastName = nameParts.slice(1).join(' ') || 'Student';

  useEffect(() => {
    if (!open) return;

    const savedMode =
      localStorage.getItem('studypet-theme-mode') === 'dark' ? 'dark' : 'light';
    const savedAccent =
      localStorage.getItem('studypet-theme-accent') || DEFAULT_ACCENT;

    setMode(savedMode);
    setAccent(savedAccent);
    setDraftAccent(savedAccent);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  function handleModeChange(nextMode: 'light' | 'dark') {
    setMode(nextMode);
    localStorage.setItem('studypet-theme-mode', nextMode);
    applyTheme(nextMode, accent);
  }

  function handleAccentSave() {
    const nextAccent = draftAccent.trim();

    if (!HEX_COLOR_REGEX.test(nextAccent)) {
      setError('Enter a full hex color like #4f46e5');
      return;
    }

    setError(null);
    setAccent(nextAccent);
    localStorage.setItem('studypet-theme-accent', nextAccent);
    applyTheme(mode, nextAccent);
  }

  function resetTheme() {
    setMode('light');
    setAccent(DEFAULT_ACCENT);
    setDraftAccent(DEFAULT_ACCENT);
    setError(null);
    localStorage.setItem('studypet-theme-mode', 'light');
    localStorage.setItem('studypet-theme-accent', DEFAULT_ACCENT);
    applyTheme('light', DEFAULT_ACCENT);
  }

  function profileInitials() {
    return `${firstName[0] ?? 'D'}${lastName[0] ?? 'S'}`.toUpperCase();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[2rem] border border-[var(--card-border)] bg-[var(--card-bg)] shadow-2xl">
        <div
          className="grid lg:grid-cols-[280px_1fr]"
          onClick={(event) => event.stopPropagation()}
        >
          <aside className="border-b border-[var(--card-border)] bg-[var(--card-bg)] px-8 py-8 lg:border-b-0 lg:border-r">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black tracking-tight">Settings</h2>
                <p className="theme-muted mt-3 text-sm">
                  Manage your profile and theme preferences.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--card-border)] text-lg font-semibold text-[var(--page-text)] transition hover:bg-[var(--btn-secondary-hover)]"
                aria-label="Close settings"
              >
                ×
              </button>
            </div>

            <div className="mt-8 space-y-3">
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className={[
                  'flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left text-lg font-semibold transition',
                  activeTab === 'profile'
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'text-[var(--page-text)] hover:bg-[var(--btn-secondary-hover)]',
                ].join(' ')}
              >
                <span className="text-2xl">◌</span>
                Profile
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('theme')}
                className={[
                  'flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left text-lg font-semibold transition',
                  activeTab === 'theme'
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'text-[var(--page-text)] hover:bg-[var(--btn-secondary-hover)]',
                ].join(' ')}
              >
                <span className="text-2xl">◍</span>
                Theme
              </button>
            </div>
          </aside>

          <section className="flex min-h-0 flex-col">
            <div className="flex-1 overflow-y-auto px-8 py-8">
              {activeTab === 'profile' ? (
                <div className="max-w-5xl">
                  <h3 className="text-3xl font-black tracking-tight">
                    Profile
                  </h3>
                  <p className="theme-muted mt-3 text-sm">
                    View the current account details for this StudyPet+ session.
                  </p>
                  <div className="mt-8 flex flex-col gap-8 xl:flex-row xl:items-start">
                    <div className="flex flex-col items-center gap-4">
                      <div
                        className="flex h-28 w-28 items-center justify-center rounded-full text-3xl font-black text-white"
                        style={{ backgroundColor: 'var(--accent)' }}
                      >
                        {profileInitials()}
                      </div>
                      <p className="theme-muted text-sm">
                        Profile editing can be expanded later.
                      </p>
                    </div>

                    <div className="grid flex-1 gap-6 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-semibold">
                          First Name
                        </label>
                        <input
                          readOnly
                          value={firstName}
                          className="theme-input"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-semibold">
                          Last Name
                        </label>
                        <input
                          readOnly
                          value={lastName}
                          className="theme-input"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-2 block text-sm font-semibold">
                          Email Address
                        </label>
                        <input
                          readOnly
                          value={
                            user.email ?? 'demo@studypetplus.corecrafted.net'
                          }
                          className="theme-input"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-2 block text-sm font-semibold">
                          StudyPet Username
                        </label>
                        <input
                          readOnly
                          value={(user.email ?? 'demo')
                            .split('@')[0]
                            .replace(/[^a-zA-Z0-9_.-]/g, '')}
                          className="theme-input"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="max-w-4xl">
                  <h3 className="text-3xl font-black tracking-tight">Theme</h3>
                  <p className="theme-muted mt-3 text-sm">
                    Control dark mode and your app accent color from one place.
                  </p>

                  <div className="mt-8 card p-6">
                    <h4 className="text-xl font-bold">Mode</h4>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => handleModeChange('light')}
                        className={[
                          'rounded-2xl border px-4 py-4 text-left transition',
                          mode === 'light'
                            ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                            : 'border-[var(--card-border)] bg-[var(--card-bg)]',
                        ].join(' ')}
                      >
                        <p className="font-semibold">Light mode</p>
                        <p className="theme-muted mt-1 text-sm">
                          Bright layout for daytime studying.
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleModeChange('dark')}
                        className={[
                          'rounded-2xl border px-4 py-4 text-left transition',
                          mode === 'dark'
                            ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                            : 'border-[var(--card-border)] bg-[var(--card-bg)]',
                        ].join(' ')}
                      >
                        <p className="font-semibold">Dark mode</p>
                        <p className="theme-muted mt-1 text-sm">
                          Solid low-glare theme with a #191919 background.
                        </p>
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 card p-6">
                    <h4 className="text-xl font-bold">Accent Color</h4>
                    <p className="theme-muted mt-2 text-sm">
                      Use a hex code and apply it across buttons, highlights,
                      navigation, and branded text.
                    </p>

                    <div className="mt-5 flex flex-col gap-4 xl:flex-row xl:items-end">
                      <div className="flex-1">
                        <label
                          htmlFor="accent-hex"
                          className="mb-2 block text-sm font-semibold"
                        >
                          Hex code
                        </label>
                        <input
                          id="accent-hex"
                          type="text"
                          value={draftAccent}
                          onChange={(e) => setDraftAccent(e.target.value)}
                          placeholder="#4f46e5"
                          className="theme-input"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <div
                          aria-hidden
                          className="h-12 w-12 rounded-2xl border border-[var(--card-border)] shadow-sm"
                          style={{ backgroundColor: draftAccent }}
                        />
                        <button
                          type="button"
                          onClick={handleAccentSave}
                          className="btn-primary"
                        >
                          Save color
                        </button>
                      </div>
                    </div>

                    {error && (
                      <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                        {error}
                      </p>
                    )}

                    <div className="mt-6 rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5">
                      <p className="theme-muted text-sm font-semibold uppercase tracking-[0.2em]">
                        Preview
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <button type="button" className="btn-primary">
                          Primary action
                        </button>
                        <button type="button" className="btn-secondary">
                          Secondary action
                        </button>
                        <span
                          className="rounded-full px-3 py-1 text-sm font-semibold text-white"
                          style={{ backgroundColor: accent }}
                        >
                          Accent chip
                        </span>
                      </div>
                    </div>

                    <div className="mt-6">
                      <button
                        type="button"
                        onClick={resetTheme}
                        className="btn-secondary"
                      >
                        Reset to default
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-[var(--card-border)] px-8 py-5">
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
