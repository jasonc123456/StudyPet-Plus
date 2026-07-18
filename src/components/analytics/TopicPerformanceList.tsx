import type { TopicPerformance } from '@/lib/quiz-analytics';

type TopicPerformanceListProps = {
  topics: TopicPerformance[];
};

/** Colour ramp: red (weak) → amber → emerald (strong). */
function accuracyTone(accuracy: number): {
  bar: string;
  text: string;
  chip: string;
} {
  if (accuracy < 50) {
    return {
      bar: 'bg-red-500',
      text: 'text-red-700',
      chip: 'bg-red-50 text-red-700',
    };
  }
  if (accuracy < 75) {
    return {
      bar: 'bg-amber-500',
      text: 'text-amber-700',
      chip: 'bg-amber-50 text-amber-700',
    };
  }
  return {
    bar: 'bg-emerald-500',
    text: 'text-emerald-700',
    chip: 'bg-emerald-50 text-emerald-700',
  };
}

export function TopicPerformanceList({ topics }: TopicPerformanceListProps) {
  if (topics.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
        <p className="text-sm font-medium text-slate-800">No topic data yet</p>
        <p className="mt-1 text-sm text-slate-500">
          Take a quiz and your per-topic accuracy will show up here.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3" aria-label="Per-topic accuracy">
      {topics.map((topic, index) => {
        const tone = accuracyTone(topic.accuracy);
        // The single weakest topic (first in the sorted list) is surfaced
        // prominently as the "focus here" item.
        const isWeakest = index === 0;
        return (
          <li
            key={topic.topic}
            className={`rounded-xl border px-4 py-3 ${
              isWeakest
                ? 'border-brand-300 bg-brand-50/40 ring-1 ring-brand-200'
                : 'border-slate-200 bg-white'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-semibold text-slate-900">
                  {topic.topic}
                </span>
                {isWeakest ? (
                  <span className="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                    Focus here
                  </span>
                ) : null}
              </div>
              <span
                className={`text-sm font-semibold tabular-nums ${tone.text}`}
              >
                {topic.accuracy}%
              </span>
            </div>

            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${tone.bar}`}
                style={{ width: `${topic.accuracy}%` }}
                role="progressbar"
                aria-valuenow={topic.accuracy}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${topic.topic} accuracy`}
              />
            </div>

            <p className="mt-1.5 text-xs text-slate-500">
              {topic.correct} of {topic.total} correct
            </p>
          </li>
        );
      })}
    </ul>
  );
}
