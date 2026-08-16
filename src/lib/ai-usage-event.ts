/**
 * Browser event announcing that this account's AI usage has changed.
 *
 * Its own module so the sidebar meter and the generation stream can share the
 * name without importing each other — the meter is a client component, the
 * stream helper is imported by several panels, and a shared constant is the
 * smallest coupling that keeps the two in step.
 */
export const AI_USAGE_CHANGED_EVENT = 'studypet:ai-usage-changed';

/** Ask any mounted usage meter to refetch. No-op on the server. */
export function notifyAiUsageChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(AI_USAGE_CHANGED_EVENT));
}
