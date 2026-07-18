import type { ReactNode } from 'react';

export type StatTileProps = {
  /** Emoji or icon node shown in the tinted badge. */
  icon: ReactNode;
  /** The prominent value, e.g. a number or "82%". */
  value: ReactNode;
  /** Short caption under the value. */
  label: string;
  /** Optional accent for the icon badge; defaults to the app accent. */
  tone?: 'accent' | 'success' | 'danger' | 'warning';
};

const TONE_VAR: Record<NonNullable<StatTileProps['tone']>, string> = {
  accent: 'var(--accent)',
  success: 'var(--success)',
  danger: 'var(--danger)',
  warning: 'var(--warning)',
};

/**
 * Icon badge + big number + label. Used across analytics and flashcard stats.
 * Painted with theme variables so it works in light and dark.
 */
export function StatTile({
  icon,
  value,
  label,
  tone = 'accent',
}: StatTileProps) {
  const color = TONE_VAR[tone];
  return (
    <div className="card flex items-center gap-4 p-4">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
        style={{
          background: `color-mix(in srgb, ${color} 14%, var(--card-bg))`,
          color,
        }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold leading-tight">{value}</div>
        <div className="theme-muted text-sm">{label}</div>
      </div>
    </div>
  );
}
