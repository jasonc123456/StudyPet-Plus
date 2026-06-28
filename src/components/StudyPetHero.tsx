"use client";

import { useState } from "react";

// The pet evolves through these stages as XP grows.
const STAGES = [
  { emoji: "🥚", name: "Mystery Egg" },
  { emoji: "🐣", name: "Hatchling" },
  { emoji: "🐤", name: "Chick" },
  { emoji: "🦉", name: "Scholar Owl" },
  { emoji: "🐉", name: "Study Dragon" },
] as const;

// XP required to REACH each stage (index-aligned with STAGES).
const THRESHOLDS = [0, 90, 200, 500, 1000];

// Things a student can do, and the XP each grants.
const ACTIONS = [
  { label: "📖 Study", xp: 10 },
  { label: "🃏 Review card", xp: 6 },
  { label: "❓ Take quiz", xp: 15 },
];

type Gain = { id: number; amount: number };

export default function StudyPetHero() {
  const [xp, setXp] = useState(0);
  const [sessions, setSessions] = useState(0);
  const [pop, setPop] = useState(false);
  const [leveledUp, setLeveledUp] = useState(false);
  const [gains, setGains] = useState<Gain[]>([]);

  // Derive the current stage from XP — no need to store it in state.
  let stageIndex = 0;
  for (let i = 0; i < THRESHOLDS.length; i++) {
    if (xp >= THRESHOLDS[i]) stageIndex = i;
  }
  const stage = STAGES[stageIndex];
  const base = THRESHOLDS[stageIndex];
  const nextAt = THRESHOLDS[stageIndex + 1]; // undefined when maxed out
  const pct = nextAt
    ? Math.min(100, Math.round(((xp - base) / (nextAt - base)) * 100))
    : 100;

  function gainXp(amount: number) {
    setXp((prev) => {
      const next = prev + amount;
      // Did we cross into a new stage? Celebrate.
      const before = THRESHOLDS.filter((t) => prev >= t).length;
      const after = THRESHOLDS.filter((t) => next >= t).length;
      if (after > before) {
        setLeveledUp(true);
        setTimeout(() => setLeveledUp(false), 1300);
      }
      return next;
    });
    setSessions((s) => s + 1);

    // Trigger the pop wiggle.
    setPop(true);
    setTimeout(() => setPop(false), 250);

    // Spawn a floating "+XP" that removes itself after the animation.
    const id = Date.now() + Math.random();
    setGains((g) => [...g, { id, amount }]);
    setTimeout(() => setGains((g) => g.filter((x) => x.id !== id)), 900);
  }

  return (
    <div className="card relative mx-auto w-full max-w-sm p-6 text-center">
      {leveledUp && (
        <div className="absolute inset-x-0 -top-3 z-10 mx-auto w-max rounded-full bg-mint-500 px-3 py-1 text-xs font-bold text-white shadow">
          ✨ Evolved to {stage.name}!
        </div>
      )}

      {/* The pet itself — poke it for a small bonus. */}
      <button
        type="button"
        onClick={() => gainXp(4)}
        aria-label="Poke your study pet"
        className="relative mx-auto block select-none"
      >
        <span
          className={`block text-7xl transition-transform ${
            pop ? "animate-pet-pop" : ""
          }`}
        >
          {stage.emoji}
        </span>
        {gains.map((g) => (
          <span
            key={g.id}
            className="animate-float-up pointer-events-none absolute left-1/2 top-0 text-sm font-bold text-mint-600"
          >
            +{g.amount}
          </span>
        ))}
      </button>

      <div className="mt-2 text-sm font-semibold text-slate-500">
        Lv {stageIndex + 1} · {stage.name}
      </div>

      {/* XP progress bar */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-slate-400">
          <span>{xp} XP</span>
          <span>{nextAt ? `next: ${nextAt}` : "MAX LEVEL"}</span>
        </div>
        <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Study actions */}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {ACTIONS.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={() => gainXp(a.xp)}
            className="btn-secondary px-3 py-1.5 text-sm transition active:scale-95"
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-center gap-4 text-sm text-slate-500">
        <span>🔥 {sessions} study sessions</span>
        {xp > 0 && (
          <button
            type="button"
            onClick={() => {
              setXp(0);
              setSessions(0);
            }}
            className="text-xs text-slate-400 underline hover:text-slate-600"
          >
            reset
          </button>
        )}
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Try it — tap the pet or an action to earn XP.
      </p>
    </div>
  );
}
