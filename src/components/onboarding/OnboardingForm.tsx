'use client';

// First-run onboarding, shown once right after the initial sign-in. Captures
// the essentials — display name, time zone, and avatar — then stamps
// `onboardedAt` on the server so the dashboard stops redirecting here. Email,
// pet name, and theme are left for Settings later.

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

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

// Full IANA list when the runtime supports it (all modern browsers do), with a
// small fallback so the <select> is never empty.
const FALLBACK_ZONES = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'UTC',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Taipei',
  'Asia/Tokyo',
  'Australia/Sydney',
];

function detectBrowserZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function supportedZones(browserZone: string): string[] {
  // `Intl.supportedValuesOf` isn't in every TS lib target — access it defensively.
  const supportedValuesOf = (
    Intl as unknown as {
      supportedValuesOf?: (key: string) => string[];
    }
  ).supportedValuesOf;
  const withValues =
    typeof supportedValuesOf === 'function'
      ? supportedValuesOf('timeZone')
      : FALLBACK_ZONES;
  // Guarantee the detected zone is selectable even if it's missing from the list.
  return withValues.includes(browserZone)
    ? withValues
    : [browserZone, ...withValues];
}

export function OnboardingForm({
  defaultName,
  defaultImage,
}: {
  defaultName: string;
  defaultImage: string;
}) {
  const router = useRouter();

  // Server renders in UTC; the real browser zone is only known on the client.
  // Start from a deterministic 'UTC' so the SSR markup and first client render
  // match, then swap to the detected zone after mount to avoid a hydration
  // mismatch on the <select>. `zoneTouched` keeps the post-mount detection from
  // clobbering an explicit user choice (fast pickers).
  const [browserZone, setBrowserZone] = useState('UTC');
  const [timezone, setTimezone] = useState('UTC');
  const [zoneTouched, setZoneTouched] = useState(false);
  const zones = useMemo(() => supportedZones(browserZone), [browserZone]);

  const [name, setName] = useState(defaultName);
  const [image, setImage] = useState(defaultImage);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const detected = detectBrowserZone();
    setBrowserZone(detected);
    setTimezone((current) => (zoneTouched ? current : detected));
    // Only runs on mount; zoneTouched guard handles the race with user input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), timezone, image }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? 'Could not save — please try again');
        return;
      }

      router.replace('/dashboard');
      router.refresh();
    } catch {
      setError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-100 via-white to-mint-400/40 px-6 py-10">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-2xl border border-white/60 bg-white/90 p-8 shadow-xl backdrop-blur"
      >
        <span className="mb-2 block text-center text-5xl">🐾</span>
        <h1 className="text-center text-2xl font-extrabold text-slate-900">
          Welcome to StudyPet+
        </h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          Let&rsquo;s set up the basics. You can change everything later in
          Settings.
        </p>

        <div className="mt-8 space-y-6">
          <div>
            <label
              htmlFor="onboarding-name"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Name
            </label>
            <input
              id="onboarding-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              placeholder="Your name"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-400"
            />
          </div>

          <div>
            <label
              htmlFor="onboarding-timezone"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Time zone
            </label>
            <select
              id="onboarding-timezone"
              value={timezone}
              onChange={(e) => {
                setZoneTouched(true);
                setTimezone(e.target.value);
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-400"
            >
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-slate-400">
              Defaulted to your device&rsquo;s zone (
              {browserZone.replace(/_/g, ' ')}). Due dates and calendar times
              show in this zone.
            </p>
          </div>

          <div>
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Avatar
            </span>
            <div className="flex flex-wrap gap-3">
              {PROFILE_IMAGE_OPTIONS.map((option) => {
                const selected = option === image;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setImage(option)}
                    aria-pressed={selected}
                    aria-label={`Choose avatar ${option}`}
                    className={[
                      'overflow-hidden rounded-full border-2 bg-white p-0.5 transition',
                      selected
                        ? 'border-brand-500 ring-2 ring-brand-300'
                        : 'border-slate-200 hover:border-brand-300',
                    ].join(' ')}
                  >
                    <Image
                      src={option}
                      alt=""
                      width={48}
                      height={48}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-mint-500 px-5 py-3 font-semibold text-white shadow-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? 'Saving…' : 'Start studying'}
          </button>
        </div>
      </form>
    </main>
  );
}
