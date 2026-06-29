// Shown right after a user submits their email on /login. Auth.js redirects
// here once the magic link has been emailed. Purely presentational, matching
// the playful login page so the magic-link flow feels consistent.

import Link from "next/link";

// Decorative email-themed emoji that bob around behind the card.
const FLOATERS = [
  { e: "📬", pos: "left-[12%] top-[18%]", delay: "0s" },
  { e: "✉️", pos: "right-[14%] top-[22%]", delay: "1.2s" },
  { e: "🔗", pos: "left-[18%] bottom-[20%]", delay: "0.6s" },
  { e: "✨", pos: "right-[16%] bottom-[24%]", delay: "1.8s" },
  { e: "🐾", pos: "left-[44%] top-[10%]", delay: "2.4s" },
];

export default function VerifyRequestPage() {
  return (
    <main className="animate-gradient relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-brand-100 via-white to-mint-400/40 px-6">
      {FLOATERS.map((f) => (
        <span
          key={f.e}
          aria-hidden
          className={`animate-drift pointer-events-none absolute text-3xl opacity-60 sm:text-4xl ${f.pos}`}
          style={{ animationDelay: f.delay }}
        >
          {f.e}
        </span>
      ))}

      <section className="animate-pop-in relative z-10 flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-white/60 bg-white/80 p-8 text-center shadow-xl backdrop-blur">
        <span className="animate-pet-pop mx-auto block text-6xl">📬</span>

        <h1 className="bg-gradient-to-r from-brand-600 to-mint-500 bg-clip-text text-2xl font-extrabold text-transparent">
          Check your email
        </h1>

        <p className="text-sm text-slate-500">
          We sent you a magic link to sign in to StudyPet+. Open it on this
          device to continue &mdash; you can close this tab.
        </p>

        <Link
          href="/login"
          className="text-sm font-medium text-brand-600 underline-offset-4 transition hover:text-brand-700 hover:underline"
        >
          Use a different email
        </Link>
      </section>
    </main>
  );
}
