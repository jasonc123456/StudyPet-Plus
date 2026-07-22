'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type CalendarFeedExportProps = {
  /** Whether a link has ever been generated. The URL itself is never readable again. */
  hasFeedToken: boolean;
};

export function CalendarFeedExport({ hasFeedToken }: CalendarFeedExportProps) {
  const router = useRouter();
  // Only ever set from the POST response — the server stores a hash, so an
  // existing link cannot be shown again after a reload.
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSteps, setShowSteps] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setCopied(false);

    try {
      const response = await fetch('/api/calendar/feed', { method: 'POST' });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? 'Unable to create a calendar link');
        return;
      }

      const data = (await response.json()) as { feedUrl: string };
      setFeedUrl(data.feedUrl);
      setShowSteps(true);
      router.refresh();
    } catch {
      setError('Network error while creating the calendar link');
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke() {
    setRevoking(true);
    setError(null);

    try {
      const response = await fetch('/api/calendar/feed', { method: 'DELETE' });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? 'Unable to turn off the calendar link');
        return;
      }

      setFeedUrl(null);
      router.refresh();
    } catch {
      setError('Network error while turning off the calendar link');
    } finally {
      setRevoking(false);
    }
  }

  async function handleCopy() {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy — select the link and copy it manually.');
    }
  }

  return (
    <div className="card p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Subscribe from another calendar
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Publish your tasks, quests, and personal events as a private feed
            you can add to Outlook, Google Calendar, or Apple Calendar. It stays
            up to date automatically.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="btn-primary text-sm"
          >
            {generating
              ? 'Generating…'
              : hasFeedToken
                ? 'Generate new link'
                : 'Create link'}
          </button>
          {hasFeedToken && (
            <button
              type="button"
              onClick={handleRevoke}
              disabled={revoking}
              className="btn-secondary text-sm"
            >
              {revoking ? 'Turning off…' : 'Turn off'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {feedUrl ? (
        <div className="mt-4 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            Copy this now — it won&rsquo;t be shown again
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              readOnly
              value={feedUrl}
              onFocus={(event) => event.currentTarget.select()}
              className="theme-input flex-1 font-mono text-xs"
              aria-label="Your private calendar feed URL"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="btn-secondary shrink-0 text-sm"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="mt-2 text-xs text-brand-700">
            Anyone with this link can see your calendar. Generate a new link to
            revoke it.
          </p>
        </div>
      ) : (
        hasFeedToken && (
          <p className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
            A calendar link is active. For your security it can&rsquo;t be shown
            again — generate a new one if you need the URL (this stops the old
            link from working).
          </p>
        )
      )}

      <button
        type="button"
        onClick={() => setShowSteps((value) => !value)}
        className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700"
        aria-expanded={showSteps}
      >
        {showSteps ? 'Hide setup steps' : 'How do I add this to my calendar?'}
      </button>

      {showSteps && (
        <div className="mt-3 grid gap-4 rounded-2xl border border-slate-200 px-5 py-4 text-sm text-slate-600 sm:grid-cols-3">
          <div>
            <p className="font-semibold text-slate-800">Outlook</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-4">
              <li>Open Outlook Calendar.</li>
              <li>
                Click <strong>Add calendar</strong> →{' '}
                <strong>Subscribe from web</strong>.
              </li>
              <li>Paste the link, name it, and click Import.</li>
            </ol>
          </div>
          <div>
            <p className="font-semibold text-slate-800">Google Calendar</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-4">
              <li>Open Google Calendar on the web.</li>
              <li>
                Next to <strong>Other calendars</strong>, click{' '}
                <strong>+</strong> → <strong>From URL</strong>.
              </li>
              <li>Paste the link and click Add calendar.</li>
            </ol>
          </div>
          <div>
            <p className="font-semibold text-slate-800">Apple Calendar</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-4">
              <li>
                Choose <strong>File</strong> →{' '}
                <strong>New Calendar Subscription</strong>.
              </li>
              <li>Paste the link and click Subscribe.</li>
              <li>Set auto-refresh to every hour.</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
