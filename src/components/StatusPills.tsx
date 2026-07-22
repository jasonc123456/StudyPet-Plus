'use client';

/**
 * Presentational segmented to-do / in-progress / done picker, with no opinion
 * about where the write goes — each caller passes its own `onSelect`.
 * `CalendarEventStatusControl` owns the assignment fetch, the group workspace
 * PATCHes the group-task API, quests PUT their own route. Keeping the visuals
 * in one place is what stops those screens from drifting apart.
 *
 * `value` is matched case-insensitively so a group task's uppercase enum
 * (`TODO`) and an assignment's lowercase status (`todo`) light up the same way.
 */

// Only the active option is filled, so switching is always one click. Keyed by
// the lowercased value so both status vocabularies resolve.
const STATUS_ACTIVE_CLASSES: Record<string, string> = {
  todo: 'bg-slate-600 text-white shadow-sm',
  in_progress: 'bg-amber-500 text-white shadow-sm',
  done: 'bg-emerald-600 text-white shadow-sm',
};

type StatusOption = {
  value: string;
  label: string;
};

type StatusPillsProps = {
  options: readonly StatusOption[];
  value: string;
  onSelect: (value: string) => void;
  ariaLabel: string;
  disabled?: boolean;
  saving?: boolean;
};

export function StatusPills({
  options,
  value,
  onSelect,
  ariaLabel,
  disabled = false,
  saving = false,
}: StatusPillsProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-slate-50 p-0.5"
    >
      {options.map((option) => {
        const active = option.value.toLowerCase() === value.toLowerCase();
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled || saving || active}
            onClick={() => onSelect(option.value)}
            className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
              active
                ? (STATUS_ACTIVE_CLASSES[option.value.toLowerCase()] ??
                  'bg-slate-600 text-white shadow-sm')
                : `text-slate-500 hover:text-slate-800 ${
                    saving ? 'cursor-wait opacity-60' : ''
                  }`
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
