import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppSidebar, AppTopBar } from '@/components/AppSidebar';
import { prisma } from '@/lib/prisma';

/**
 * App Shell Layout — wraps every route under /dashboard.
 *
 * Desktop (md+): persistent left sidebar + scrollable content area.
 * Mobile (<md):  sticky top bar + full-width content area.
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

  const userProfile = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      image: true,
      pet: {
        select: {
          name: true,
        },
      },
    },
  });

  return (
    <div className="app-shell flex h-screen overflow-hidden">
      {/* ── Desktop sidebar ──────────────────────────────────────────────── */}
      <div className="hidden md:flex md:shrink-0">
        <AppSidebar
          user={{
            name: userProfile?.name ?? session.user.name,
            email: userProfile?.email ?? session.user.email,
            image: userProfile?.image ?? session.user.image,
            petName: userProfile?.pet?.name ?? 'StudyPet',
          }}
        />
      </div>

      {/* ── Right-hand panel (top bar + page content) ────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden">
          <AppTopBar
            user={{
              name: userProfile?.name ?? session.user.name,
              email: userProfile?.email ?? session.user.email,
              image: userProfile?.image ?? session.user.image,
              petName: userProfile?.pet?.name ?? 'StudyPet',
            }}
          />
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
