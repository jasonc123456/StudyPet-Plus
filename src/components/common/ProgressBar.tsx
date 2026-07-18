export type ProgressBarProps = {
  /** Completed units. */
  value: number;
  /** Total units; a zero or negative total renders an empty bar. */
  max: number;
  /** Show a "value / max" counter above the bar. */
  showCounter?: boolean;
  /** Optional label shown next to the counter. */
  label?: string;
};

/**
 * Gradient progress bar with an optional counter. Uses the `.progress-track` /
 * `.progress-fill` helpers so it stays theme-aware.
 */
export function ProgressBar({
  value,
  max,
  showCounter = false,
  label,
}: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div>
      {(showCounter || label) && (
        <div className="mb-1.5 flex items-center justify-between text-sm">
          {label ? <span className="theme-muted">{label}</span> : <span />}
          {showCounter && (
            <span className="font-medium tabular-nums">
              {value} / {max}
            </span>
          )}
        </div>
      )}
      <div
        className="progress-track h-2.5"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
