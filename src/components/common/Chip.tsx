import type { ReactNode } from 'react';

export type ChipProps = {
  children: ReactNode;
  /** When set, tint the chip with a course/custom colour instead of neutral. */
  color?: string | null;
  /** Renders as a button with pressed styling for filter/selector use. */
  selected?: boolean;
  onClick?: () => void;
  /** Optional leading node (dot, emoji, count). */
  leading?: ReactNode;
  title?: string;
};

/**
 * Pill/tag used for course filters, source-note tags, and mode markers.
 * A `color` produces a soft tinted background; otherwise it's neutral. When
 * `onClick` is provided it renders as a real button with a selected state.
 */
export function Chip({
  children,
  color,
  selected = false,
  onClick,
  leading,
  title,
}: ChipProps) {
  const base =
    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap transition';

  const style: React.CSSProperties = color
    ? {
        background: selected
          ? color
          : `color-mix(in srgb, ${color} 16%, var(--card-bg))`,
        color: selected ? '#fff' : color,
        borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
      }
    : {
        background: selected ? 'var(--accent)' : 'var(--btn-secondary-hover)',
        color: selected ? 'var(--accent-text)' : 'var(--card-muted)',
        borderColor: 'var(--card-border)',
      };

  const className = `${base} border`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        aria-pressed={selected}
        className={`${className} focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500`}
        style={style}
      >
        {leading}
        {children}
      </button>
    );
  }

  return (
    <span className={className} style={style} title={title}>
      {leading}
      {children}
    </span>
  );
}
