'use client';

import { useEffect, useRef, useState } from 'react';

import { DashboardPanel } from '@/components/dashboard/DashboardPanel';
import { DashboardSectionHeader } from '@/components/dashboard/DashboardSectionHeader';

const DEFAULT_MINUTES = 25;

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function PomodoroTimer() {
  const [customMinutes, setCustomMinutes] = useState(String(DEFAULT_MINUTES));
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_MINUTES * 60);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setIsRunning(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning]);

  function applyCustomTime() {
    const parsed = Number(customMinutes);
    const nextMinutes = Number.isFinite(parsed)
      ? Math.min(180, Math.max(1, Math.floor(parsed)))
      : DEFAULT_MINUTES;

    setCustomMinutes(String(nextMinutes));
    setSecondsLeft(nextMinutes * 60);
    setIsRunning(false);
  }

  function resetTimer() {
    const parsed = Number(customMinutes);
    const nextMinutes = Number.isFinite(parsed)
      ? Math.min(180, Math.max(1, Math.floor(parsed)))
      : DEFAULT_MINUTES;

    setSecondsLeft(nextMinutes * 60);
    setIsRunning(false);
  }

  const progressBase = Math.max(1, Number(customMinutes) || DEFAULT_MINUTES);
  const progressPercent = Math.max(
    0,
    Math.min(100, (secondsLeft / (progressBase * 60)) * 100)
  );
  const circleRadius = 72;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const circleOffset =
    circleCircumference - (progressPercent / 100) * circleCircumference;

  return (
    <section>
      <DashboardSectionHeader title="Pomodoro Timer" />
      <DashboardPanel>
        <p className="text-sm font-normal text-slate-500">
          Choose a focus length and let the countdown run while you study.
        </p>

        <div className="mt-5 flex items-center justify-center">
          <div className="relative flex h-44 w-44 items-center justify-center">
            <svg
              viewBox="0 0 180 180"
              className="absolute inset-0 h-full w-full -rotate-90"
              aria-hidden="true"
            >
              <circle
                cx="90"
                cy="90"
                r={circleRadius}
                fill="none"
                stroke="rgb(255 255 255 / 1)"
                strokeWidth="12"
              />
              <circle
                cx="90"
                cy="90"
                r={circleRadius}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circleCircumference}
                strokeDashoffset={circleOffset}
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            <div className="flex h-36 w-36 items-center justify-center rounded-full bg-white shadow-inner">
              <div className="text-center">
                <p className="text-[11px] font-medium uppercase tracking-widest text-neutral-400">
                  Focus
                </p>
                <p className="mt-2 text-4xl font-semibold tabular-nums tracking-tight text-slate-900">
                  {formatTime(secondsLeft)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <label
            htmlFor="pomodoro-minutes"
            className="mb-2 block text-[11px] font-medium uppercase tracking-widest text-neutral-400"
          >
            Custom minutes
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="pomodoro-minutes"
              type="number"
              min="1"
              max="180"
              value={customMinutes}
              onChange={(event) => setCustomMinutes(event.target.value)}
              className="theme-input"
            />
            <button
              type="button"
              onClick={applyCustomTime}
              className="btn-secondary shrink-0 text-sm sm:min-w-[5rem]"
            >
              Set
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsRunning((current) => !current)}
            className="btn-primary text-sm"
          >
            {isRunning ? 'Pause' : secondsLeft === 0 ? 'Start again' : 'Start'}
          </button>
          <button
            type="button"
            onClick={resetTimer}
            className="btn-secondary text-sm"
          >
            Reset
          </button>
        </div>
      </DashboardPanel>
    </section>
  );
}
