// Login route — a thin server component so it can read whether Google OAuth is
// configured (server-only env) and pass it to the client sign-in form.

import { googleOAuthEnabled } from '@/auth';
import { LoginForm } from '@/components/auth/LoginForm';

/**
 * `error` is read here rather than with useSearchParams in the form so the
 * client component doesn't need a Suspense boundary to stay prerenderable.
 * Auth.js sends its own codes (AccessDenied, Verification, ...); the dashboard
 * layout adds AccountSuspended when it bounces a suspended session.
 */
export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <LoginForm
      googleEnabled={googleOAuthEnabled}
      error={searchParams.error ?? null}
    />
  );
}
