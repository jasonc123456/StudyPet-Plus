// Small presentational helpers shared by the admin views.
//
// Timestamps here are rendered in the *viewer's* locale rather than the target
// user's time zone. An operator reading a log is comparing it against their own
// clock ("did this happen in the last hour?"), so their local time is the one
// that makes the log legible; the account's own time zone is shown separately
// on the user detail page where it is a fact about them, not about the reading.

import type { AdminActionType, AuthEventType } from '@prisma/client';

export function formatDateTime(
  value: Date | string | null | undefined
): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "3 minutes ago" / "in 2 days" — coarse on purpose; the table has exact times. */
export function formatRelative(
  value: Date | string | null | undefined
): string {
  if (!value) return 'never';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'never';

  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];

  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const [unit, secondsPerUnit] of units) {
    if (Math.abs(seconds) >= secondsPerUnit) {
      return formatter.format(Math.round(seconds / secondsPerUnit), unit);
    }
  }
  return formatter.format(seconds, 'second');
}

const AUTH_EVENT_LABEL: Record<AuthEventType, string> = {
  SIGN_IN: 'Signed in',
  SIGN_IN_FAILED: 'Sign-in refused',
  SIGN_OUT: 'Signed out',
  MFA_SUCCESS: 'Second factor passed',
  MFA_FAILED: 'Second factor failed',
  IMPERSONATION_START: 'Impersonation started',
  IMPERSONATION_END: 'Impersonation ended',
};

const ADMIN_ACTION_LABEL: Record<AdminActionType, string> = {
  ROLE_GRANTED: 'Granted admin',
  ROLE_REVOKED: 'Revoked admin',
  USER_SUSPENDED: 'Suspended account',
  USER_UNSUSPENDED: 'Reinstated account',
  USER_DELETED: 'Deleted account',
  SESSIONS_REVOKED: 'Revoked sessions',
  MFA_RESET: 'Reset second factor',
  AI_LIMIT_OVERRIDDEN: 'Changed AI limit',
  IMPERSONATION_START: 'Started impersonation',
  IMPERSONATION_END: 'Ended impersonation',
};

export function authEventLabel(type: AuthEventType): string {
  return AUTH_EVENT_LABEL[type] ?? type;
}

export function adminActionLabel(action: AdminActionType): string {
  return ADMIN_ACTION_LABEL[action] ?? action;
}

export type BadgeTone = 'neutral' | 'success' | 'danger' | 'warning' | 'accent';

const TONE_VAR: Record<BadgeTone, string> = {
  neutral: 'var(--muted-fg, #64748b)',
  success: 'var(--success)',
  danger: 'var(--danger)',
  warning: 'var(--warning)',
  accent: 'var(--accent)',
};

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
}) {
  const color = TONE_VAR[tone];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
      }}
    >
      {children}
    </span>
  );
}

export function authEventTone(type: AuthEventType): BadgeTone {
  if (type === 'SIGN_IN_FAILED' || type === 'MFA_FAILED') return 'danger';
  if (type === 'IMPERSONATION_START' || type === 'IMPERSONATION_END')
    return 'warning';
  if (type === 'SIGN_IN' || type === 'MFA_SUCCESS') return 'success';
  return 'neutral';
}

/**
 * A user agent trimmed to the part an operator actually reads.
 *
 * Full UA strings are 150+ characters of boilerplate that blow the table
 * layout apart; the browser and platform are what distinguishes one session
 * from another.
 */
export function shortUserAgent(value: string | null | undefined): string {
  if (!value) return '—';

  const browser =
    /(Edg|OPR|Chrome|Firefox|Safari)\/[\d.]+/.exec(value)?.[0] ?? null;
  const platform = /\((?:[^;)]*;\s*)?([^;)]+)/.exec(value)?.[1]?.trim() ?? null;

  if (!browser && !platform) return value.slice(0, 40);
  return [browser?.replace('OPR', 'Opera').replace('Edg', 'Edge'), platform]
    .filter(Boolean)
    .join(' · ');
}
