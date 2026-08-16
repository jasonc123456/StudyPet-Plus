// The page the "cancel this change" link in the old address's security alert
// opens. Read-only for the same reason as the confirm page next door: Safe
// Links scanners and prefetchers only ever GET, so nothing may be spent on a
// GET. The revocation happens when the user submits the form, which POSTs the
// token to /api/profile/email/cancel.

import Link from 'next/link';

import { hashEmailChangeToken } from '@/lib/email-change';
import { prisma } from '@/lib/prisma';

// Reads the DB per request; never static.
export const dynamic = 'force-dynamic';

const FLOATERS = [
  { e: '🛡️', pos: 'left-[12%] top-[18%]', delay: '0s' },
  { e: '✉️', pos: 'right-[14%] top-[22%]', delay: '1.2s' },
  { e: '🔒', pos: 'left-[18%] bottom-[20%]', delay: '0.6s' },
  { e: '✨', pos: 'right-[16%] bottom-[24%]', delay: '1.8s' },
  { e: '🐾', pos: 'left-[44%] top-[10%]', delay: '2.4s' },
];

type CancelState =
  | { kind: 'cancel'; newEmail: string }
  // Expired and already-consumed both mean the same thing to the reader: there
  // is nothing left to revoke.
  | { kind: 'gone' };

async function resolveState(token: string | undefined): Promise<CancelState> {
  if (!token) return { kind: 'gone' };

  const changeRequest = await prisma.emailChangeRequest.findUnique({
    where: { tokenHash: hashEmailChangeToken(token) },
  });

  if (!changeRequest) return { kind: 'gone' };
  if (changeRequest.expires.getTime() < Date.now()) return { kind: 'gone' };

  return { kind: 'cancel', newEmail: changeRequest.newEmail };
}

export default async function EmailChangeCancelPage({
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
        {state.kind === 'cancel' ? (
          <>
            <span className="animate-pet-pop mx-auto block text-6xl">🛡️</span>
            <h1 className="bg-gradient-to-r from-brand-600 to-mint-500 bg-clip-text text-2xl font-extrabold text-transparent">
              Cancel this email change
            </h1>
            <p className="text-sm text-slate-500">
              Someone asked to move your StudyPet+ account to{' '}
              <strong className="text-slate-700">{state.newEmail}</strong>. If
              that wasn&rsquo;t you, cancel it below — your account will stay on
              this address and the confirmation link will stop working.
            </p>
            <form method="post" action="/api/profile/email/cancel">
              <input type="hidden" name="token" value={token} />
              <button
                type="submit"
                className="mt-2 w-full rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700"
              >
                Cancel email change
              </button>
            </form>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-brand-600 underline-offset-4 transition hover:text-brand-700 hover:underline"
            >
              Back to StudyPet+
            </Link>
          </>
        ) : (
          <>
            <span className="animate-pet-pop mx-auto block text-6xl">✅</span>
            <h1 className="bg-gradient-to-r from-brand-600 to-mint-500 bg-clip-text text-2xl font-extrabold text-transparent">
              Nothing to cancel
            </h1>
            <p className="text-sm text-slate-500">
              This email change has already expired, been confirmed, or been
              cancelled. If you still think something is wrong, sign in and
              check your address in Settings.
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
