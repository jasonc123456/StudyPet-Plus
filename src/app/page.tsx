import Link from "next/link";
import StudyPetHero from "@/components/StudyPetHero";
import FlashcardDemo from "@/components/FlashcardDemo";
// TODO(Sprint 1 auth): once auth.ts exists, redirect logged-in users to /dashboard:
//   import { auth } from "@/auth";
//   const session = await auth();
//   if (session?.user) redirect("/dashboard");

const FEATURES = [
  { icon: "🗓️", title: "Planner & Quests", desc: "Turn assignments into quests with due dates and XP rewards." },
  { icon: "🃏", title: "AI Flashcards", desc: "Generate flashcards from your notes in one click." },
  { icon: "❓", title: "AI Quizzes", desc: "Auto-create quizzes with explanations to test yourself." },
  { icon: "🎯", title: "Weak-Topic Tracker", desc: "See exactly which topics need work and drill them." },
  { icon: "🐾", title: "Study Pet", desc: "Earn XP, keep streaks, and evolve your pet as you learn." },
  { icon: "✨", title: "Smart Recommendations", desc: "Always know what to study next." },
];

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-3xl">🐾</span>
          <span className="text-2xl font-extrabold text-brand-700">
            StudyPet<span className="text-mint-500">+</span>
          </span>
        </div>
        <Link href="/login/" className="btn-secondary">
          Log in
        </Link>
      </header>

      <section className="mt-16 grid items-center gap-12 lg:grid-cols-2">
        <div className="text-center lg:text-left">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Study smarter with your own{" "}
            <span className="text-brand-600">study pet</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600 lg:mx-0">
            AI Study Planner, Quiz Generator, and Weak Topic Tracker. Paste your
            notes, generate flashcards and quizzes, track your weak topics, and
            level up a virtual pet as you learn.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <Link href="/login?demo=1" className="btn-primary px-6 py-3 text-base">
              🚀 Try the demo
            </Link>
            <Link href="/login" className="btn-secondary px-6 py-3 text-base">
              Log in / Sign up
            </Link>
          </div>
          <p className="mt-3 text-sm text-slate-400">
            Demo login: demo@studypet.local / demo1234
          </p>
        </div>

        {/* Interactive client component: poke the pet, earn XP, watch it evolve. */}
        <StudyPetHero />
      </section>

      <section className="mt-24 text-center">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          AI flashcards from your notes
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-slate-500">
          A taste of what StudyPet+ generates. Click the card to flip it.
        </p>
        <div className="mt-8">
          <FlashcardDemo />
        </div>
      </section>

      <section className="mt-24 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="card p-5 transition duration-200 hover:-translate-y-1"
          >
            <div className="text-3xl">{f.icon}</div>
            <h3 className="mt-3 font-bold text-slate-800">{f.title}</h3>
            <p className="mt-1 text-sm text-slate-500">{f.desc}</p>
          </div>
        ))}
      </section>

      <footer className="mt-20 text-center text-sm text-slate-400">
        StudyPet+ AI Study Planner
      </footer>
    </main>
  );
}
