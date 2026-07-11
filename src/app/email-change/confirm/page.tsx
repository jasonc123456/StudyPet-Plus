// The page the "confirm your new email" link opens. It is deliberately
// READ-ONLY: it looks up the pending request and renders a button. Nothing is
// mutated until the user submits the form, which POSTs the token to
// /api/profile/email/verify. This is what makes the flow safe against Office 365
// "Safe Links" scanning and browser prefetchers, which only ever GET the link.

import Link from 'next/link';

import { hashEmailChangeToken } from '@/lib/email-change';
import { prisma } from '@/lib/prisma';

// Reads the DB per request; never static.
export const dynamic = 'force-dynamic';

const FLOATERS = [
  { e: '📬', pos: 'left-[12%] top-[18%]', delay: '0s' },
  { e: '✉️', pos: 'right-[14%] top-[22%]', delay: '1.2s' },
  { e: '🔗', pos: 'left-[18%] bottom-[20%]', delay: '0.6s' },
  { e: '✨', pos: 'right-[16%] bottom-[24%]', delay: '1.8s' },
  { e: '🐾', pos: 'left-[44%] top-[10%]', delay: '2.4s' },
];

type ConfirmState =
  | { kind: 'confirm'; newEmail: string }
  | { kind: 'expired' }
  | { kind: 'conflict' }
  | { kind: 'invalid' };

async function resolveState(token: string | undefined): Promise<ConfirmState> {
  if (!token) return { kind: 'invalid' };

  const changeRequest = await prisma.emailChangeRequest.findUnique({
    where: { tokenHash: hashEmailChangeToken(token) },
  });

  if (!changeRequest) return { kind: 'invalid' };
  if (changeRequest.expires.getTime() < Date.now()) return { kind: 'expired' };

  const emailOwner = await prisma.user.findFirst({
    where: {
      email: changeRequest.newEmail,
      id: { not: changeRequest.userId },
    },
    select: { id: true },
  });

  if (emailOwner) return { kind: 'conflict' };

  return { kind: 'confirm', newEmail: changeRequest.newEmail };
}

export default async function EmailChangeConfirmPage({
  searchParams,
}: {
  searchParams: { token?: string | string[] };
}) {
  const token = Array.isArray(searchParams.token)
    ? searchParams.token[0]
    : searchParams.token;
  const state = await resolveState(token);

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
        {state.kind === 'confirm' ? (
          <>
            <span className="animate-pet-pop mx-auto block text-6xl">✉️</span>
            <h1 className="bg-gradient-to-r from-brand-600 to-mint-500 bg-clip-text text-2xl font-extrabold text-transparent">
              Confirm your new email
            </h1>
            <p className="text-sm text-slate-500">
              Change your StudyPet+ account email to{' '}
              <strong className="text-slate-700">{state.newEmail}</strong>?
              Click below to finish — your old address stops working after this.
            </p>
            <form method="post" action="/api/profile/email/verify">
              <input type="hidden" name="token" value={token} />
              <button
                type="submit"
                className="mt-2 w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                Confirm email change
              </button>
            </form>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-brand-600 underline-offset-4 transition hover:text-brand-700 hover:underline"
            >
              Cancel
            </Link>
          </>
        ) : (
          <>
            <span className="animate-pet-pop mx-auto block text-6xl">
              {state.kind === 'expired'
                ? '⏰'
                : state.kind === 'conflict'
                  ? '🚫'
                  : '🔒'}
            </span>
            <h1 className="bg-gradient-to-r from-brand-600 to-mint-500 bg-clip-text text-2xl font-extrabold text-transparent">
              {state.kind === 'expired'
                ? 'Link expired'
                : state.kind === 'conflict'
                  ? 'Address already in use'
                  : 'Link not valid'}
            </h1>
            <p className="text-sm text-slate-500">
              {state.kind === 'expired'
                ? 'This confirmation link has expired. Open Settings and request the email change again to get a fresh link.'
                : state.kind === 'conflict'
                  ? 'That email address now belongs to another account. Try a different address from Settings.'
                  : 'This confirmation link is invalid or has already been used. Open Settings and request the email change again if you still need to.'}
            </p>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-brand-600 underline-offset-4 transition hover:text-brand-700 hover:underline"
            >
              Back to StudyPet+
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
