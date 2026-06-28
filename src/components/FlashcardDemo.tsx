"use client";

import { useState } from "react";

// Sample cards — stands in for AI-generated flashcards until Sprint 3.
const CARDS = [
  {
    topic: "Biology",
    front: "What is photosynthesis?",
    back: "How plants convert light energy into chemical energy (glucose).",
  },
  {
    topic: "Computer Science",
    front: "Big-O of binary search?",
    back: "O(log n) — it halves the search space on every step.",
  },
  {
    topic: "History",
    front: "When did World War II end?",
    back: "1945.",
  },
];

export default function FlashcardDemo() {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = CARDS[index];

  function nextCard() {
    setFlipped(false); // flip back to the front first…
    // …then swap the text once it's mid-flip, so you never see the answer change.
    setTimeout(() => setIndex((n) => (n + 1) % CARDS.length), 150);
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="perspective">
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          className={`preserve-3d relative h-44 w-full transition-transform duration-500 ${
            flipped ? "rotate-y-180" : ""
          }`}
        >
          {/* Front face */}
          <div className="backface-hidden card absolute inset-0 flex flex-col items-center justify-center gap-2 p-5">
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-600">
              {card.topic}
            </span>
            <p className="text-lg font-semibold text-slate-800">{card.front}</p>
            <span className="text-xs text-slate-400">click to flip</span>
          </div>

          {/* Back face — pre-rotated so it reads correctly once flipped */}
          <div className="backface-hidden rotate-y-180 absolute inset-0 flex items-center justify-center rounded-xl bg-brand-600 p-5 text-center text-white shadow-sm">
            <p className="text-base">{card.back}</p>
          </div>
        </button>
      </div>

      <div className="mt-4 flex items-center justify-center gap-3 text-sm">
        <button
          type="button"
          onClick={nextCard}
          className="btn-secondary px-3 py-1.5 text-sm"
        >
          Next card →
        </button>
        <span className="text-slate-400">
          {index + 1} / {CARDS.length}
        </span>
      </div>
    </div>
  );
}
