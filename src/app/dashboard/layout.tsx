import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppSidebar, AppTopBar } from '@/components/AppSidebar';
import { ImpersonationBanner } from '@/components/admin/ImpersonationBanner';
import { getImpersonationState } from '@/lib/impersonation';
import { TimezoneProvider } from '@/components/TimezoneProvider';
import { requiresMfaChallenge } from '@/lib/mfa';
import { prisma } from '@/lib/prisma';

/**
 * App Shell Layout — wraps every route under /dashboard.
 *
 * Desktop (md+): minimalist left sidebar + scrollable content area.
 * Mobile (<md):  floating top bar with hamburger + slide-in drawer.
 *
 * The root layout.tsx keeps ownership of <html> / <body> and global styles;
 * this layout only adds the navigation chrome for authenticated routes.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Non-null only while an admin is signed in as someone else. Read before the
  // gates below so the banner is present on every dashboard page they land on.
  const impersonation = await getImpersonationState();

  // Second-factor gate (US-4.S1): a user with MFA enabled whose current session
  // hasn't cleared the challenge is sent to /mfa before reaching any app page.
  if (await requiresMfaChallenge(session.user.id)) {
    redirect('/mfa');
  }

  const userProfile = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      image: true,
      timezone: true,
      onboardedAt: true,
      role: true,
      suspendedAt: true,
      pet: {
        select: {
          name: true,
        },
      },
    },
  });

  // A suspended account keeps its data but loses access. Checked before the
  // onboarding gate so a suspended half-onboarded user isn't looped through
  // /onboarding instead of being told what happened.
  if (userProfile?.suspendedAt) {
    redirect('/login?error=AccountSuspended');
  }

  // First-run gate: send users who haven't finished onboarding to pick a name,
  // time zone, and avatar before they reach the app.
  if (!userProfile?.onboardedAt) {
    redirect('/onboarding');
  }

  const user = {
    name: userProfile?.name ?? session.user.name,
    email: userProfile?.email ?? session.user.email,
    image: userProfile?.image ?? session.user.image,
    petName: userProfile?.pet?.name ?? 'StudyPet',
    timezone: userProfile?.timezone ?? null,
    // Drives the Admin link in the sidebar — absent for everyone else, so the
    // console isn't advertised to users who would only get a 404 from it.
    isAdmin: userProfile?.role === 'ADMIN',
  };

  return (
    <TimezoneProvider timezone={user.timezone}>
      <div className="app-shell flex h-screen flex-col overflow-hidden">
        {impersonation && (
          <ImpersonationBanner email={user.email ?? 'this account'} />
        )}

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <AppSidebar user={user} />

          <div className="app-shell-content flex min-w-0 flex-1 flex-col overflow-hidden">
            <AppTopBar user={user} />

            <main className="app-shell-main flex-1 overflow-y-auto">
              <div className="px-4 py-6 sm:px-6 sm:py-8">{children}</div>
            </main>
          </div>
        </div>
      </div>
    </TimezoneProvider>
  );
}
