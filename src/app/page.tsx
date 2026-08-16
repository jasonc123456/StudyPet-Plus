import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import DemoLoginButton from '@/components/DemoLoginButton';
import FlashcardDemo from '@/components/FlashcardDemo';
import StudyPetHero from '@/components/StudyPetHero';
import ThemeModeToggle from '@/components/ThemeModeToggle';

const AUDIENCES = [
  {
    title: 'Students juggling multiple classes',
    desc: 'Keep courses, assignments, and study tasks in one planner instead of scattered tabs and notes.',
  },
  {
    title: 'Students who need motivation',
    desc: 'Turn consistent studying into visible progress with XP, streaks, and a pet that grows with you.',
  },
  {
    title: 'Students preparing for exams',
    desc: 'Spot weak topics early and turn pasted notes into flashcards and quizzes before crunch time hits.',
  },
];

const WORKFLOW = [
  {
    step: '01',
    title: 'Plan what matters first',
    desc: 'Organize courses, due dates, and quests in a dashboard that surfaces what needs attention next.',
  },
  {
    step: '02',
    title: 'Turn notes into study tools',
    desc: 'Paste class notes and generate flashcards or quizzes tagged by topic so review is faster.',
  },
  {
    step: '03',
    title: 'Catch weak topics early',
    desc: 'Use quiz results and study history to see where confidence is low before the exam shows it.',
  },
  {
    step: '04',
    title: 'Stay motivated longer',
    desc: 'Earn XP, keep your streak alive, and evolve your StudyPet+ as your habits improve.',
  },
];

const FEATURES = [
  {
    icon: '🗓️',
    title: 'Planner & Quests',
    desc: 'Turn assignments into quests with due dates and XP rewards.',
  },
  {
    icon: '🃏',
    title: 'AI Flashcards',
    desc: 'Generate flashcards from your notes in one click.',
  },
  {
    icon: '❓',
    title: 'AI Quizzes',
    desc: 'Auto-create quizzes with explanations to test yourself.',
  },
  {
    icon: '🎯',
    title: 'Weak-Topic Tracker',
    desc: 'See exactly which topics need work and drill them.',
  },
  {
    icon: '🐾',
    title: 'Study Pet',
    desc: 'Earn XP, keep streaks, and evolve your pet as you learn.',
  },
  {
    icon: '✨',
    title: 'Smart Recommendations',
    desc: 'Always know what to study next.',
  },
];

const SMART_SUGGESTIONS = [
  'You have 15 minutes and feel tired. Review flashcards for Biology Unit 3 or finish the easy section of Assignment 2 due tomorrow.',
  'You feel focused and have an hour. Take a quiz on recursion, then review the two topics you missed most often.',
  'You are overwhelmed and deadlines are close. Prioritize the project checkpoint due tonight before starting a new quiz.',
];

const STACK = [
  'Next.js 14 App Router + TypeScript',
  'Auth.js magic-link authentication',
  'Prisma + PostgreSQL data layer',
  'AI-generated flashcards and quizzes',
];

export default async function LandingPage() {
  const session = await auth();

  if (session?.user) {
    redirect('/dashboard');
  }

  return (
    <main className="landing-shell relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-72 bg-[linear-gradient(120deg,rgba(79,70,229,0.06),rgba(16,185,129,0.02),transparent)]" />
      <div className="relative mx-auto max-w-6xl px-6 py-10 sm:py-12">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-3xl">🐾</span>
            <span className="text-2xl font-extrabold text-brand-700">
              StudyPet<span className="text-mint-500">+</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeModeToggle />
            <Link href="/login" className="btn-secondary">
              Log in
            </Link>
          </div>
        </header>

        <section className="mt-14 grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="text-center lg:text-left">
            <span className="inline-flex rounded-full border border-brand-200 bg-white/80 px-3 py-1 text-sm font-semibold text-brand-700 shadow-sm">
              Planner-first studying for real student chaos
            </span>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Keep up with schoolwork, study consistently, and grow a pet while
              you do it.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600 lg:mx-0">
              StudyPet+ helps students who lose track of assignments, struggle
              to stay motivated, or only discover weak topics right before an
              exam. It combines a planner, AI-generated study tools, and a
              gamified pet system so the next best study action feels obvious.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <DemoLoginButton className="btn-primary px-6 py-3 text-base">
                🚀 Try the demo
              </DemoLoginButton>
              <Link href="/login" className="btn-secondary px-6 py-3 text-base">
                Log in / Sign up
              </Link>
            </div>
            <p className="mt-3 text-sm text-slate-400">
              One-click demo for project reviews, class demos, and quick
              testing.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-left shadow-sm">
                <p className="text-2xl font-black text-brand-700">1 app</p>
                <p className="mt-1 text-sm text-slate-600">
                  for planning, studying, and motivation
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-left shadow-sm">
                <p className="text-2xl font-black text-brand-700">3 modes</p>
                <p className="mt-1 text-sm text-slate-600">
                  planner, AI study tools, and pet progression
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-left shadow-sm">
                <p className="text-2xl font-black text-brand-700">
                  0 passwords
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  with secure magic-link sign-in
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <StudyPetHero />
            <div className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-left text-slate-100 shadow-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-mint-400">
                Smart suggestion example
              </p>
              <p className="mt-3 text-lg font-semibold">
                You have 15 minutes and feel tired.
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Review Biology flashcards or start the easy section of
                Assignment 2 due tomorrow. Short session, low energy, urgent
                deadline.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-20">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-600">
              Who it helps
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              Built for students who want structure without losing momentum.
            </h2>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {AUDIENCES.map((audience) => (
              <div
                key={audience.title}
                className="rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-sm"
              >
                <h3 className="text-lg font-bold text-slate-900">
                  {audience.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {audience.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-24 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-600">
              Why it matters
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              StudyPet+ is designed around the moment students usually fall off.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
              Most tools handle only one part of the problem. Calendars manage
              deadlines. Quiz apps test memory. Notes apps store information.
              StudyPet+ connects all three so students can plan work, generate
              review material, and stay engaged long enough to build a habit.
            </p>
            <div className="mt-8 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Product promise
              </p>
              <p className="mt-3 text-lg font-semibold text-slate-900">
                Help students know what to do next before stress decides for
                them.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {WORKFLOW.map((item) => (
              <div
                key={item.step}
                className="rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-sm"
              >
                <p className="text-sm font-black tracking-[0.2em] text-brand-500">
                  {item.step}
                </p>
                <h3 className="mt-3 text-lg font-bold text-slate-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-24 text-center">
          <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            AI flashcards from your notes
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-slate-500">
            A quick preview of the study tools layer. Click the card to flip it.
          </p>
          <div className="mt-8">
            <FlashcardDemo />
          </div>
        </section>

        <section className="mt-24">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-600">
                Core features
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                One system, not a pile of disconnected tools.
              </h2>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-sm text-slate-600 shadow-sm">
              Secure stack: {STACK.join(' • ')}
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="card rounded-3xl p-5 transition duration-200 hover:-translate-y-1"
              >
                <div className="text-3xl">{f.icon}</div>
                <h3 className="mt-3 font-bold text-slate-800">{f.title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-24 rounded-[2rem] border border-slate-200 bg-slate-900 px-6 py-8 text-white shadow-2xl sm:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-mint-400">
                Smart recommendations
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Suggestions that respect your mood, time, and deadlines.
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                The goal is not just to list tasks. It is to recommend the best
                next move when a student feels tired, focused, overwhelmed, or
                pressed for time.
              </p>
            </div>

            <div className="space-y-3">
              {SMART_SUGGESTIONS.map((suggestion, index) => (
                <div
                  key={suggestion}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-200"
                >
                  <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-mint-300">
                    {index + 1}
                  </span>
                  {suggestion}
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="mt-20 text-center text-sm text-slate-400">
          StudyPet+ blends planning, AI study support, and gamified momentum for
          students who need all three.
        </footer>
      </div>
    </main>
  );
}
