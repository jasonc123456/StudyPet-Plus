import type { ReactNode } from 'react';

export type ModeCardProps = {
  icon: ReactNode;
  title: string;
  subtitle: string;
  selected: boolean;
  onSelect: () => void;
};

/**
 * Selectable card for the quiz mode picker (Review / Practice / Exam). Shows an
 * icon, title, and one-line subtitle; the selected card gets an accent ring.
 */
export function ModeCard({
  icon,
  title,
  subtitle,
  selected,
  onSelect,
}: ModeCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="card flex w-full items-start gap-3 p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      style={
        selected
          ? {
              borderColor: 'var(--accent)',
              boxShadow: '0 0 0 1px var(--accent)',
              background: 'var(--accent-soft)',
            }
          : undefined
      }
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
        style={{
          background: 'color-mix(in srgb, var(--accent) 14%, var(--card-bg))',
          color: 'var(--accent)',
        }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="font-semibold">{title}</div>
        <div className="theme-muted text-sm">{subtitle}</div>
      </div>
    </button>
  );
}
