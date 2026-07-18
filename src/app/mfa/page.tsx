// Second-factor gate (US-4.S1). A user with MFA enabled lands here right after
// signing in; they must clear TOTP or a passkey before the dashboard layout
// lets them through. Users without MFA (or an already-verified session) are
// bounced straight to their destination.

import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { MfaGate } from '@/components/auth/MfaGate';
import {
  getMfaFactors,
  getSessionToken,
  isSessionMfaVerified,
} from '@/lib/mfa';

function safeCallback(raw: string | undefined): string {
  // Only allow same-app relative paths to avoid an open redirect.
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return '/dashboard';
}

export default async function MfaPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const callbackUrl = safeCallback(searchParams.callbackUrl);
  const factors = await getMfaFactors(session.user.id);
  const mfaActive = factors.totpActivated || factors.passkeys.length > 0;

  // Nothing to prove, or already proven this session → go where they were headed.
  if (!mfaActive) {
    redirect(callbackUrl);
  }
  const token = getSessionToken();
  if (token && (await isSessionMfaVerified(token))) {
    redirect(callbackUrl);
  }

  return (
    <MfaGate
      hasTotp={factors.totpActivated}
      hasPasskey={factors.passkeys.length > 0}
      callbackUrl={callbackUrl}
    />
  );
}
