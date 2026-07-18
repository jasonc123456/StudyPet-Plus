'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import {
  FlashcardReviewFramework,
  type ReviewCard,
} from '@/components/flashcards/FlashcardReviewFramework';

export type StudyCard = ReviewCard;

export type StudySettings = {
  shuffle: boolean;
  /** 0 = all cards. */
  cardsPerSession: number;
  /** Seconds per card; 0 = off. */
  timerPerCard: number;
  /** When the per-card timer expires, flip to the answer instead of advancing. */
  autoFlip: boolean;
};

const DEFAULT_SETTINGS: StudySettings = {
  shuffle: false,
  cardsPerSession: 0,
  timerPerCard: 0,
  autoFlip: false,
};

const STORAGE_KEY = 'studypet:flashcard-study-settings';
const CARDS_PER_SESSION_OPTIONS = [0, 10, 20, 30, 50];
const TIMER_OPTIONS = [0, 10, 20, 30, 60];

function loadSettings(): StudySettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return {
      ...DEFAULT_SETTINGS,
      ...(JSON.parse(raw) as Partial<StudySettings>),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

type FlashcardStudySessionProps = {
  deckTitle: string;
  cards: StudyCard[];
};

export function FlashcardStudySession({
  deckTitle,
  cards,
}: FlashcardStudySessionProps) {
  const [settings, setSettings] = useState<StudySettings>(DEFAULT_SETTINGS);
  const [started, setStarted] = useState(false);
  // A key that changes each "Start" so the framework remounts with a fresh run.
  const [runKey, setRunKey] = useState(0);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  function update<K extends keyof StudySettings>(
    key: K,
    value: StudySettings[K]
  ) {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage failures (private mode); settings still apply this run.
      }
      return next;
    });
  }

  const runCards = useMemo(() => {
    let list = settings.shuffle ? shuffled(cards) : cards;
    if (settings.cardsPerSession > 0) {
      list = list.slice(0, settings.cardsPerSession);
    }
    return list;
    // Recompute only when a run starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey]);

  if (started) {
    return (
      <FlashcardReviewFramework
        key={runKey}
        deckTitle={deckTitle}
        cards={runCards}
        timerPerCard={settings.timerPerCard}
        autoFlip={settings.autoFlip}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <Link
        href="/dashboard/flashcards"
        className="self-start text-sm font-medium text-brand-600 hover:underline"
      >
        ← Back to flashcards
      </Link>

      <div className="card flex flex-col gap-5 p-6">
        <div>
          <h1 className="text-xl font-semibold">{deckTitle}</h1>
          <p className="theme-muted mt-1 text-sm">
            {cards.length} card{cards.length === 1 ? '' : 's'} · set your study
            options.
          </p>
        </div>

        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium">Shuffle cards</span>
          <input
            type="checkbox"
            checked={settings.shuffle}
            onChange={(e) => update('shuffle', e.target.checked)}
            className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
        </label>

        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium">Cards per session</span>
          <select
            value={settings.cardsPerSession}
            onChange={(e) => update('cardsPerSession', Number(e.target.value))}
            className="theme-input max-w-[10rem] text-sm"
          >
            {CARDS_PER_SESSION_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n === 0 ? 'All cards' : `${n} cards`}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium">Timer per card</span>
          <select
            value={settings.timerPerCard}
            onChange={(e) => update('timerPerCard', Number(e.target.value))}
            className="theme-input max-w-[10rem] text-sm"
          >
            {TIMER_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n === 0 ? 'Off' : `${n}s`}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium">
            Auto-flip when timer ends
            <span className="theme-muted block text-xs font-normal">
              Otherwise the card advances automatically.
            </span>
          </span>
          <input
            type="checkbox"
            checked={settings.autoFlip}
            disabled={settings.timerPerCard === 0}
            onChange={(e) => update('autoFlip', e.target.checked)}
            className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:opacity-50"
          />
        </label>

        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setRunKey((k) => k + 1);
            setStarted(true);
          }}
        >
          Start studying
        </button>
      </div>
    </div>
  );
}
