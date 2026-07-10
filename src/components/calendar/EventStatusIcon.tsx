// Compact status glyph for calendar entries: an empty ring (not started), a
// half-filled ring (in progress), or a check (done). Group tasks store status as
// an uppercase enum, so everything is normalized before lookup.

type EventStatusIconProps = {
  status: string;
  className?: string;
};

type StatusVisual = {
  label: string;
  className: string;
  path: React.ReactNode;
};

const STATUS_VISUALS: Record<string, StatusVisual> = {
  todo: {
    label: 'Not started',
    className: 'text-slate-400',
    path: (
      <circle
        cx="8"
        cy="8"
        r="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    ),
  },
  in_progress: {
    label: 'In progress',
    className: 'text-amber-500',
    path: (
      <>
        <circle
          cx="8"
          cy="8"
          r="6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        {/* Right half filled — reads as "partly done" at 16px. */}
        <path d="M8 2a6 6 0 0 1 0 12Z" fill="currentColor" />
      </>
    ),
  },
  done: {
    label: 'Completed',
    className: 'text-emerald-500',
    path: (
      <>
        <circle cx="8" cy="8" r="6" fill="currentColor" />
        <path
          d="m5.4 8.2 1.8 1.8 3.4-3.6"
          fill="none"
          stroke="white"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
  },
};

export function statusVisualLabel(status: string) {
  return STATUS_VISUALS[status.toLowerCase()]?.label ?? 'Not started';
}

export function EventStatusIcon({
  status,
  className = '',
}: EventStatusIconProps) {
  const visual = STATUS_VISUALS[status.toLowerCase()] ?? STATUS_VISUALS.todo;

  return (
    <svg
      viewBox="0 0 16 16"
      className={`h-4 w-4 shrink-0 ${visual.className} ${className}`}
      role="img"
      aria-label={visual.label}
    >
      <title>{visual.label}</title>
      {visual.path}
    </svg>
  );
}
