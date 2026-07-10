'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { UpdatedAt } from '@/components/UpdatedAt';
import type { CalendarSubscriptionWithError } from '@/lib/calendar';

type CalendarSubscriptionManagerProps = {
  subscriptions: CalendarSubscriptionWithError[];
};

const DEFAULT_COLOR = '#0ea5e9';
const CANVAS_COLOR = '#e2483d';

export function CalendarSubscriptionManager({
  subscriptions,
}: CalendarSubscriptionManagerProps) {
  const router = useRouter();
  const icsInputRef = useRef<HTMLInputElement>(null);
  const hasAutoSync = subscriptions.some(
    (subscription) => subscription.autoSync
  );
  const [name, setName] = useState('');
  const [icsUrl, setIcsUrl] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [autoSync, setAutoSync] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCanvasGuide, setShowCanvasGuide] = useState(false);

  // Quick-fill the form for a Canvas feed: Canvas is just an ICS URL, so this
  // pre-names it, sets the Canvas brand color, opens the guide, and drops the
  // cursor in the URL field so the only thing left is pasting the link.
  function prefillCanvas() {
    setName('Canvas');
    setColor(CANVAS_COLOR);
    setShowCanvasGuide(true);
    setError(null);
    icsInputRef.current?.focus();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/calendar/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, icsUrl, color, autoSync }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? 'Unable to add calendar');
        return;
      }

      setName('');
      setIcsUrl('');
      setColor(DEFAULT_COLOR);
      router.refresh();
    } catch {
      setError('Network error while saving the calendar link');
    } finally {
      setSaving(false);
    }
  }

  // Turning this on backfills assignments immediately; turning it off deletes
  // the ones auto-sync created that the student never started.
  async function handleAutoSyncToggle(
    subscriptionId: string,
    nextValue: boolean
  ) {
    setTogglingId(subscriptionId);
    setError(null);

    try {
      const response = await fetch(
        `/api/calendar/subscriptions/${subscriptionId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ autoSync: nextValue }),
        }
      );

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? 'Unable to update auto-sync');
        return;
      }

      router.refresh();
    } catch {
      setError('Network error while updating auto-sync');
    } finally {
      setTogglingId(null);
    }
  }

  async function handleSyncNow() {
    setSyncing(true);
    setError(null);

    try {
      const response = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? 'Unable to sync calendars');
        return;
      }

      router.refresh();
    } catch {
      setError('Network error while syncing calendars');
    } finally {
      setSyncing(false);
    }
  }

  async function handleDelete(subscriptionId: string) {
    setDeletingId(subscriptionId);
    setError(null);

    try {
      const response = await fetch(
        `/api/calendar/subscriptions/${subscriptionId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? 'Unable to remove calendar');
        return;
      }

      router.refresh();
    } catch {
      setError('Network error while removing the calendar link');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Connected calendars
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Link your Canvas feed — or any ICS calendar — and it appears
            alongside assignments and quests, staying in sync until you remove
            it.
          </p>
        </div>
        {hasAutoSync && (
          <button
            type="button"
            onClick={handleSyncNow}
            disabled={syncing}
            className="btn-secondary shrink-0 text-sm"
          >
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        )}
      </div>

      {/* Canvas quick-connect: pre-fills the form below and reveals the guide. */}
      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base font-bold text-white"
          style={{ backgroundColor: CANVAS_COLOR }}
          aria-hidden
        >
          C
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800">Using Canvas?</p>
          <p className="text-xs text-slate-500">
            Import every course assignment from your Canvas calendar feed.
          </p>
        </div>
        <button
          type="button"
          onClick={prefillCanvas}
          className="btn-secondary shrink-0 text-sm"
        >
          Connect Canvas
        </button>
        <button
          type="button"
          onClick={() => setShowCanvasGuide((value) => !value)}
          className="shrink-0 text-sm font-medium text-brand-600 hover:text-brand-700"
          aria-expanded={showCanvasGuide}
        >
          {showCanvasGuide ? 'Hide steps' : 'Where do I find my link?'}
        </button>
      </div>

      {showCanvasGuide && (
        <ol className="mt-3 list-decimal space-y-1.5 rounded-2xl border border-slate-200 px-6 py-4 text-sm text-slate-600">
          <li>
            In Canvas, open <strong>Calendar</strong> from the left navigation.
          </li>
          <li>
            Scroll to the bottom-right and click <strong>Calendar Feed</strong>.
          </li>
          <li>
            Copy the <code>.ics</code> link it shows (it may start with{' '}
            <code>webcal://</code> — that&rsquo;s fine, paste it as-is).
          </li>
          <li>Paste it into the ICS URL field below and click Add calendar.</li>
        </ol>
      )}

      <form onSubmit={handleSubmit} className="mt-5 grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Calendar name
          </label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="theme-input"
            placeholder="Class schedule"
          />
        </div>
        <div className="lg:col-span-6">
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            ICS URL
          </label>
          <input
            ref={icsInputRef}
            value={icsUrl}
            onChange={(event) => setIcsUrl(event.target.value)}
            className="theme-input"
            placeholder="https://example.com/calendar.ics"
            inputMode="url"
          />
        </div>
        <div className="lg:col-span-1">
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Color
          </label>
          <input
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            className="h-12 w-full rounded-xl border border-[var(--card-border)] bg-white p-1"
          />
        </div>
        <div className="lg:col-span-2 lg:self-end">
          <button
            type="submit"
            className="btn-primary w-full"
            disabled={saving}
          >
            {saving ? 'Adding…' : 'Add calendar'}
          </button>
        </div>

        <label className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3 lg:col-span-12">
          <input
            type="checkbox"
            checked={autoSync}
            onChange={(event) => setAutoSync(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm">
            <span className="font-semibold text-slate-800">
              Auto-sync to my assignments
            </span>
            <span className="mt-0.5 block text-xs text-slate-500">
              Turn each calendar event into a trackable assignment, filed under
              a course matching its code. Meetings and exams can be excluded one
              by one from the calendar.
            </span>
          </span>
        </label>
      </form>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {subscriptions.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
          No ICS calendars connected yet.
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {subscriptions.map((subscription) => (
            <div
              key={subscription.id}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 px-4 py-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: subscription.color }}
                    aria-hidden
                  />
                  <p className="truncate font-medium text-slate-900">
                    {subscription.name}
                  </p>
                  {subscription.autoSync && (
                    <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-600">
                      Auto-sync
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">
                  {subscription.icsUrl}
                </p>

                {subscription.autoSync && (
                  <p className="mt-1.5 text-xs text-slate-500">
                    {subscription.syncedCount} assignment
                    {subscription.syncedCount === 1 ? '' : 's'} synced
                    {subscription.ignoredCount > 0 &&
                      ` · ${subscription.ignoredCount} ignored`}
                    {subscription.lastSyncedAt && (
                      <>
                        {' · last synced '}
                        <UpdatedAt updatedAt={subscription.lastSyncedAt} />
                      </>
                    )}
                  </p>
                )}

                {subscription.syncError && (
                  <p className="mt-2 text-xs font-medium text-amber-700">
                    Sync warning: {subscription.syncError}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={subscription.autoSync}
                    disabled={togglingId === subscription.id}
                    onChange={(event) =>
                      handleAutoSyncToggle(
                        subscription.id,
                        event.target.checked
                      )
                    }
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:cursor-wait"
                  />
                  <span className="text-xs font-semibold text-slate-600">
                    {togglingId === subscription.id
                      ? 'Saving…'
                      : 'Sync assignments'}
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => handleDelete(subscription.id)}
                  disabled={deletingId === subscription.id}
                  className="btn-secondary shrink-0 text-sm"
                >
                  {deletingId === subscription.id ? 'Removing…' : 'Remove'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
