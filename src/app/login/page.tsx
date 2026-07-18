// Login route — a thin server component so it can read whether Google OAuth is
// configured (server-only env) and pass it to the client sign-in form.

import { googleOAuthEnabled } from '@/auth';
import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return <LoginForm googleEnabled={googleOAuthEnabled} />;
}
