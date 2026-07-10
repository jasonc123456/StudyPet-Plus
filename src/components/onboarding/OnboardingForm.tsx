'use client';

// First-run onboarding, shown once right after the initial sign-in. Captures
// required profile basics, then optionally connects a Canvas/ICS feed using the
// same calendar subscription API that powers the dashboard calendar page.

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

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

const DEFAULT_CALENDAR_COLOR = '#0ea5e9';
const CANVAS_COLOR = '#e2483d';

function detectBrowserZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function supportedZones(browserZone: string): string[] {
  const supportedValuesOf = (
    Intl as unknown as {
      supportedValuesOf?: (key: string) => string[];
    }
  ).supportedValuesOf;
  const withValues =
    typeof supportedValuesOf === 'function'
      ? supportedValuesOf('timeZone')
      : FALLBACK_ZONES;

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
  const icsInputRef = useRef<HTMLInputElement>(null);

  const [browserZone, setBrowserZone] = useState('UTC');
  const [timezone, setTimezone] = useState('UTC');
  const [zoneTouched, setZoneTouched] = useState(false);
  const zones = useMemo(() => supportedZones(browserZone), [browserZone]);

  const [name, setName] = useState(defaultName);
  const [image, setImage] = useState(defaultImage);
  const [calendarName, setCalendarName] = useState('');
  const [icsUrl, setIcsUrl] = useState('');
  const [calendarColor, setCalendarColor] = useState(DEFAULT_CALENDAR_COLOR);
  const [autoSync, setAutoSync] = useState(true);
  const [showCanvasGuide, setShowCanvasGuide] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const detected = detectBrowserZone();
    setBrowserZone(detected);
    setTimezone((current) => (zoneTouched ? current : detected));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function prefillCanvas() {
    setCalendarName('Canvas');
    setCalendarColor(CANVAS_COLOR);
    setShowCanvasGuide(true);
    setError(null);
    icsInputRef.current?.focus();
  }

  async function saveOnboarding(includeCalendar: boolean) {
    const trimmedName = name.trim();
    const trimmedIcsUrl = icsUrl.trim();

    if (!trimmedName) {
      setError('Name is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const onboardingRes = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, timezone, image }),
      });

      if (!onboardingRes.ok) {
        const data = (await onboardingRes.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? 'Could not save profile - please try again');
        return;
      }

      if (includeCalendar && trimmedIcsUrl) {
        const calendarRes = await fetch('/api/calendar/subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: calendarName.trim() || 'Imported calendar',
            icsUrl: trimmedIcsUrl,
            color: calendarColor,
            autoSync,
          }),
        });

        if (!calendarRes.ok) {
          const data = (await calendarRes.json().catch(() => null)) as {
            error?: string;
          } | null;
          setError(
            data?.error ??
              'Profile saved, but the calendar could not be connected. Fix the link or skip this step for now.'
          );
          return;
        }
      }

      router.replace('/dashboard');
      router.refresh();
    } catch {
      setError('Network error - please try again');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await saveOnboarding(true);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-brand-100 via-white to-mint-400/40 px-5 py-8 sm:px-6 lg:px-10">
      <form
        onSubmit={handleSubmit}
        className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-2xl border border-white/70 bg-white/95 shadow-xl backdrop-blur lg:grid-cols-[1.05fr_0.95fr]"
      >
        <section className="p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
            Welcome to StudyPet+
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">
            Set up your study space
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Name, time zone, and avatar are required so due dates and your
            profile feel right from day one.
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
                className="theme-input"
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
                className="theme-input"
              >
                {zones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-slate-400">
                Defaulted to your device zone ({browserZone.replace(/_/g, ' ')}
                ).
              </p>
            </div>

            <div>
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Avatar
              </span>
              <div className="grid grid-cols-5 gap-3 sm:flex sm:flex-wrap">
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
          </div>
        </section>

        <section className="border-t border-slate-200 bg-slate-50/80 p-6 sm:p-8 lg:border-l lg:border-t-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Optional
              </p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">
                Connect your calendar
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Paste a Canvas or ICS feed to create synced tasks in your
                account immediately.
              </p>
            </div>
            <button
              type="button"
              onClick={prefillCanvas}
              className="btn-secondary shrink-0 text-sm"
            >
              Canvas
            </button>
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="onboarding-calendar-name"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Calendar name
              </label>
              <input
                id="onboarding-calendar-name"
                value={calendarName}
                onChange={(event) => setCalendarName(event.target.value)}
                className="theme-input bg-white"
                placeholder="Canvas"
              />
            </div>

            <div>
              <label
                htmlFor="onboarding-ics-url"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                ICS URL
              </label>
              <input
                id="onboarding-ics-url"
                ref={icsInputRef}
                value={icsUrl}
                onChange={(event) => setIcsUrl(event.target.value)}
                className="theme-input bg-white"
                placeholder="https://example.com/calendar.ics"
                inputMode="url"
              />
            </div>

            <div className="grid grid-cols-[5rem_1fr] gap-3">
              <div>
                <label
                  htmlFor="onboarding-calendar-color"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Color
                </label>
                <input
                  id="onboarding-calendar-color"
                  type="color"
                  value={calendarColor}
                  onChange={(event) => setCalendarColor(event.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white p-1"
                />
              </div>
              <label className="mt-7 flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={(event) => setAutoSync(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm">
                  <span className="font-semibold text-slate-800">
                    Sync into tasks
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Feed events become trackable assignments.
                  </span>
                </span>
              </label>
            </div>

            <button
              type="button"
              onClick={() => setShowCanvasGuide((value) => !value)}
              className="text-sm font-semibold text-brand-600 hover:text-brand-700"
              aria-expanded={showCanvasGuide}
            >
              {showCanvasGuide
                ? 'Hide Canvas steps'
                : 'Where is my Canvas link?'}
            </button>

            {showCanvasGuide && (
              <ol className="list-decimal space-y-1.5 rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-600">
                <li>Open Canvas Calendar from the left navigation.</li>
                <li>Click Calendar Feed near the bottom-right of the page.</li>
                <li>Copy the .ics or webcal link and paste it above.</li>
              </ol>
            )}
          </div>

          {error && (
            <p className="mt-5 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => saveOnboarding(false)}
              disabled={submitting}
              className="btn-secondary"
            >
              Skip calendar
            </button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting
                ? 'Saving...'
                : icsUrl.trim()
                  ? 'Save and sync'
                  : 'Start studying'}
            </button>
          </div>
        </section>
      </form>
    </main>
  );
}
