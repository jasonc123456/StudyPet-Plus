'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { AI_USAGE_CHANGED_EVENT } from '@/lib/ai-usage-event';

type Usage = {
  demoOnly: boolean;
  used: number;
  limit: number;
  resetAt: string;
};

function resetLabel(resetAt: string) {
  const remainingMs = new Date(resetAt).getTime() - Date.now();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0)
    return 'Resets shortly';

  const hours = Math.floor(remainingMs / 3_600_000);
  if (hours >= 1) return `Resets in ${hours}h`;

  const minutes = Math.max(1, Math.round(remainingMs / 60_000));
  return `Resets in ${minutes}m`;
}

/**
 * How much of today's AI allowance is left.
 *
 * Reads /api/ai/usage, which reads the AiUsage row the generation routes write
 * — the same counter that enforces the limit, not a second estimate that could
 * drift from it.
 *
 * Refreshed on mount, on navigation, when the tab regains focus, and when a
 * generation finishes (consumeGenerationStream fires AI_USAGE_CHANGED_EVENT),
 * so the bar moves without the user reloading.
 */
export function AiUsageMeter() {
  const pathname = usePathname();
  const [usage, setUsage] = useState<Usage | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/ai/usage', { cache: 'no-store' });
      if (!response.ok) return;
      setUsage((await response.json()) as Usage);
    } catch {
      // A meter is not worth an error state in the sidebar. Keep the last
      // known figure and try again on the next trigger.
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, pathname]);

  useEffect(() => {
    const onChange = () => void refresh();

    window.addEventListener(AI_USAGE_CHANGED_EVENT, onChange);
    window.addEventListener('focus', onChange);
    return () => {
      window.removeEventListener(AI_USAGE_CHANGED_EVENT, onChange);
      window.removeEventListener('focus', onChange);
    };
  }, [refresh]);

  // Nothing until the first response — an empty bar that fills in a moment
  // later reads as "you have used none", which may not be true.
  if (!usage) return null;

  // The demo account never reaches a provider, so it has no allowance to spend
  // and a bar would be meaningless. Say why the AI output looks canned instead.
  if (usage.demoOnly) {
    return (
      <div className="px-3 pb-2 pt-1">
        <p className="ai-usage-note text-xs">
          Demo account — AI answers are pre-written samples.
        </p>
      </div>
    );
  }

  const remaining = Math.max(0, usage.limit - usage.used);
  const fraction = usage.limit > 0 ? usage.used / usage.limit : 0;
  const level = fraction >= 1 ? 'full' : fraction >= 0.8 ? 'high' : 'normal';

  return (
    <div className="px-3 pb-2 pt-1">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="ai-usage-label text-xs font-medium">
          AI generations
        </span>
        <span className="ai-usage-count text-xs tabular-nums">
          {usage.used}/{usage.limit}
        </span>
      </div>

      <div
        className="ai-usage-track h-1.5 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={usage.limit}
        aria-valuenow={usage.used}
        aria-label={`AI generations used today: ${usage.used} of ${usage.limit}`}
      >
        <div
          className="ai-usage-fill h-full rounded-full transition-[width] duration-300"
          data-level={level}
          style={{ width: `${Math.min(100, fraction * 100)}%` }}
        />
      </div>

      <p className="ai-usage-note mt-1.5 text-[0.6875rem]">
        {remaining === 0
          ? resetLabel(usage.resetAt)
          : `${remaining} left · ${resetLabel(usage.resetAt).toLowerCase()}`}
      </p>
    </div>
  );
}
