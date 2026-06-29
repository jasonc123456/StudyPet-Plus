import { AppSidebar, AppTopBar } from '@/components/AppSidebar';

/**
 * App Shell Layout — wraps every route under /dashboard.
 *
 * Desktop (md+): persistent left sidebar + scrollable content area.
 * Mobile (<md):  sticky top bar + full-width content area.
 *
 * The root layout.tsx keeps ownership of <html> / <body> and global styles;
 * this layout only adds the navigation chrome for authenticated routes.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* ── Desktop sidebar ──────────────────────────────────────────────── */}
      <div className="hidden md:flex md:shrink-0">
        <AppSidebar />
      </div>

      {/* ── Right-hand panel (top bar + page content) ────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden">
          <AppTopBar />
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
