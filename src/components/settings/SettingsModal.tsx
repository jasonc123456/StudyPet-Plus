'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const DEFAULT_ACCENT = '#4f46e5';
const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_PROFILE_IMAGE = '/profile-pics/1.png';
const DEFAULT_TEXT_MODE = 'auto';
const DEFAULT_TEXT_COLOR = '#ffffff';
const PROFILE_IMAGE_OPTIONS = [
  '/profile-pics/1.png',
  '/profile-pics/2.png',
  '/profile-pics/3.png',
  '/profile-pics/4.png',
  '/profile-pics/5.png',
  '/profile-pics/6.png',
  '/profile-pics/7.png',
  '/profile-pics/8.png',
  '/profile-pics/9.png',
  '/profile-pics/10.png',
] as const;

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    petName?: string | null;
  };
};

type SettingsTab = 'profile' | 'theme';

type ThemeTextMode = 'auto' | 'custom';

function isLightColor(hex: string) {
  if (!HEX_COLOR_REGEX.test(hex)) return false;
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.72;
}

function getContrastTextColor(hex: string) {
  return isLightColor(hex) ? '#111111' : '#ffffff';
}

function applyTheme(
  mode: 'light' | 'dark',
  accent: string,
  textMode: ThemeTextMode,
  customTextColor: string
) {
  const accentText =
    textMode === 'custom' && HEX_COLOR_REGEX.test(customTextColor)
      ? customTextColor
      : getContrastTextColor(accent);

  document.documentElement.setAttribute('data-theme', mode);
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--accent-strong', accent);
  document.documentElement.style.setProperty('--accent-soft', `${accent}18`);
  document.documentElement.style.setProperty('--accent-text', accentText);
}

export function SettingsModal({ open, onClose, user }: SettingsModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [draftAccent, setDraftAccent] = useState(DEFAULT_ACCENT);
  const [textMode, setTextMode] = useState<ThemeTextMode>(DEFAULT_TEXT_MODE);
  const [textColor, setTextColor] = useState(DEFAULT_TEXT_COLOR);
  const [draftTextColor, setDraftTextColor] = useState(DEFAULT_TEXT_COLOR);
  const [textEditorOpen, setTextEditorOpen] = useState(false);
  const [profileName, setProfileName] = useState(user.name ?? 'Demo Student');
  const [profileEmail, setProfileEmail] = useState(
    user.email ?? 'demo@studypetplus.corecrafted.net'
  );
  const [petName, setPetName] = useState(user.petName ?? 'StudyPet');
  const [profileImage, setProfileImage] = useState(
    user.image &&
      PROFILE_IMAGE_OPTIONS.includes(
        user.image as (typeof PROFILE_IMAGE_OPTIONS)[number]
      )
      ? user.image
      : DEFAULT_PROFILE_IMAGE
  );
  const [themeError, setThemeError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (!open) return;

    const savedMode =
      localStorage.getItem('studypet-theme-mode') === 'dark' ? 'dark' : 'light';
    const savedAccent =
      localStorage.getItem('studypet-theme-accent') || DEFAULT_ACCENT;
    const savedTextMode =
      localStorage.getItem('studypet-theme-text-mode') === 'custom'
        ? 'custom'
        : 'auto';
    const savedTextColor =
      localStorage.getItem('studypet-theme-text-color') || DEFAULT_TEXT_COLOR;

    setMode(savedMode);
    setAccent(savedAccent);
    setDraftAccent(savedAccent);
    setTextMode(savedTextMode);
    setTextColor(savedTextColor);
    setDraftTextColor(savedTextColor);
    setTextEditorOpen(false);
    setThemeError(null);
    setProfileError(null);
    setProfileSuccess(null);
    setProfileName(user.name ?? 'Demo Student');
    setProfileEmail(user.email ?? 'demo@studypetplus.corecrafted.net');
    setPetName(user.petName ?? 'StudyPet');
    setProfileImage(
      user.image &&
        PROFILE_IMAGE_OPTIONS.includes(
          user.image as (typeof PROFILE_IMAGE_OPTIONS)[number]
        )
        ? user.image
        : DEFAULT_PROFILE_IMAGE
    );
  }, [open, user.email, user.image, user.name, user.petName]);

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
    applyTheme(nextMode, accent, textMode, textColor);
  }

  function handleAccentSave() {
    const nextAccent = draftAccent.trim();

    if (!HEX_COLOR_REGEX.test(nextAccent)) {
      setThemeError('Enter a full hex color like #4f46e5');
      return;
    }

    setThemeError(null);
    setAccent(nextAccent);
    localStorage.setItem('studypet-theme-accent', nextAccent);
    applyTheme(mode, nextAccent, textMode, textColor);
  }

  function resetTheme() {
    setMode('light');
    setAccent(DEFAULT_ACCENT);
    setDraftAccent(DEFAULT_ACCENT);
    setTextMode(DEFAULT_TEXT_MODE);
    setTextColor(DEFAULT_TEXT_COLOR);
    setDraftTextColor(DEFAULT_TEXT_COLOR);
    setThemeError(null);
    localStorage.setItem('studypet-theme-mode', 'light');
    localStorage.setItem('studypet-theme-accent', DEFAULT_ACCENT);
    localStorage.setItem('studypet-theme-text-mode', DEFAULT_TEXT_MODE);
    localStorage.setItem('studypet-theme-text-color', DEFAULT_TEXT_COLOR);
    applyTheme('light', DEFAULT_ACCENT, DEFAULT_TEXT_MODE, DEFAULT_TEXT_COLOR);
  }

  function handleTextPreset(nextTextColor: string) {
    setTextMode('custom');
    setTextColor(nextTextColor);
    setDraftTextColor(nextTextColor);
    localStorage.setItem('studypet-theme-text-mode', 'custom');
    localStorage.setItem('studypet-theme-text-color', nextTextColor);
    applyTheme(mode, accent, 'custom', nextTextColor);
  }

  function handleAutoTextColor() {
    setTextMode('auto');
    localStorage.setItem('studypet-theme-text-mode', 'auto');
    applyTheme(mode, accent, 'auto', textColor);
  }

  function handleCustomTextColorSave() {
    const nextTextColor = draftTextColor.trim();

    if (!HEX_COLOR_REGEX.test(nextTextColor)) {
      setThemeError('Enter a full hex color like #111111 or #ffffff');
      return;
    }

    setThemeError(null);
    setTextMode('custom');
    setTextColor(nextTextColor);
    localStorage.setItem('studypet-theme-text-mode', 'custom');
    localStorage.setItem('studypet-theme-text-color', nextTextColor);
    applyTheme(mode, accent, 'custom', nextTextColor);
  }

  async function handleProfileSave() {
    setSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileName.trim(),
          email: profileEmail.trim(),
          petName: petName.trim(),
          image: profileImage,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setProfileError(data?.error ?? 'Failed to save profile');
        return;
      }

      setProfileSuccess('Profile updated');
      router.refresh();
    } catch {
      setProfileError('Network error — please try again');
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div className="mx-auto my-4 w-full max-w-5xl overflow-hidden rounded-[2rem] border border-[var(--card-border)] bg-[var(--card-bg)] shadow-2xl">
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
            <div className="flex-1 overflow-y-auto px-8 py-8 pb-20">
              {activeTab === 'profile' ? (
                <div className="max-w-5xl">
                  <h3 className="text-3xl font-black tracking-tight">
                    Profile
                  </h3>
                  <p className="theme-muted mt-3 text-sm">
                    Update your account details, StudyPet name, and avatar.
                  </p>
                  <div className="mt-8 flex flex-col gap-8 xl:flex-row xl:items-start">
                    <div className="flex flex-col items-center gap-4">
                      <div className="overflow-hidden rounded-full border border-[var(--card-border)] bg-white p-1 shadow-sm">
                        <Image
                          src={profileImage}
                          alt="Selected profile avatar"
                          width={112}
                          height={112}
                          className="h-28 w-28 rounded-full object-cover"
                        />
                      </div>
                      <div className="w-full max-w-xs">
                        <label className="mb-2 block text-sm font-semibold">
                          Default avatar
                        </label>
                        <select
                          value={profileImage}
                          onChange={(e) => setProfileImage(e.target.value)}
                          className="theme-input"
                        >
                          {PROFILE_IMAGE_OPTIONS.map((option, index) => (
                            <option key={option} value={option}>
                              Avatar {index + 1}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid flex-1 gap-6 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <label className="mb-2 block text-sm font-semibold">
                          Name
                        </label>
                        <input
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          className="theme-input"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-semibold">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={profileEmail}
                          onChange={(e) => setProfileEmail(e.target.value)}
                          className="theme-input"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-semibold">
                          StudyPet Name
                        </label>
                        <input
                          value={petName}
                          onChange={(e) => setPetName(e.target.value)}
                          className="theme-input"
                        />
                      </div>
                      {profileError && (
                        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 md:col-span-2">
                          {profileError}
                        </p>
                      )}
                      {profileSuccess && (
                        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 md:col-span-2">
                          {profileSuccess}
                        </p>
                      )}
                      <div className="md:col-span-2 flex justify-end">
                        <button
                          type="button"
                          onClick={handleProfileSave}
                          disabled={savingProfile}
                          className="btn-primary"
                        >
                          {savingProfile ? 'Saving…' : 'Save profile'}
                        </button>
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

                  <div className="mt-8 card p-5">
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

                  <div className="mt-5 card p-5">
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

                    {themeError && (
                      <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                        {themeError}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => setTextEditorOpen((open) => !open)}
                      className="mt-5 w-full rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 text-left transition hover:bg-[var(--btn-secondary-hover)]"
                    >
                      <p className="theme-muted text-sm font-semibold uppercase tracking-[0.2em]">
                        Preview
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          className="btn-primary"
                          style={{
                            color:
                              textMode === 'custom'
                                ? textColor
                                : getContrastTextColor(accent),
                          }}
                        >
                          Primary action
                        </button>
                        <button type="button" className="btn-secondary">
                          Secondary action
                        </button>
                        <span
                          className="rounded-full px-3 py-1 text-sm font-semibold text-white"
                          style={{
                            backgroundColor: accent,
                            color:
                              textMode === 'custom'
                                ? textColor
                                : getContrastTextColor(accent),
                          }}
                        >
                          Accent chip
                        </span>
                      </div>
                      <p className="theme-muted mt-4 text-xs">
                        Click preview to change text color on accent surfaces.
                      </p>
                    </button>

                    {textEditorOpen && (
                      <div className="mt-4 rounded-2xl border border-[var(--card-border)] bg-[var(--btn-secondary-hover)] p-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={handleAutoTextColor}
                            className="btn-secondary text-sm"
                          >
                            Auto contrast
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTextPreset('#111111')}
                            className="btn-secondary text-sm"
                          >
                            Black text
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTextPreset('#ffffff')}
                            className="btn-secondary text-sm"
                          >
                            White text
                          </button>
                        </div>

                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                          <div className="flex-1">
                            <label
                              htmlFor="text-color-hex"
                              className="mb-2 block text-sm font-semibold"
                            >
                              Custom text color
                            </label>
                            <input
                              id="text-color-hex"
                              type="text"
                              value={draftTextColor}
                              onChange={(e) =>
                                setDraftTextColor(e.target.value)
                              }
                              placeholder="#111111"
                              className="theme-input"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleCustomTextColorSave}
                            className="btn-primary"
                            style={{
                              color:
                                textMode === 'custom'
                                  ? textColor
                                  : getContrastTextColor(accent),
                            }}
                          >
                            Save text color
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="mt-5">
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
          </section>
        </div>
      </div>
    </div>
  );
}
