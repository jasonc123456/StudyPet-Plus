'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';

import { SettingsModal } from '@/components/settings/SettingsModal';

// ---------------------------------------------------------------------------
// Inline SVG icons — no extra dependency required
// ---------------------------------------------------------------------------

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function CoursesIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function AssignmentsIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function QuestsIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l2.4 4.86 5.36.78-3.88 3.78.92 5.34L12 15.9 7.2 18.76l.92-5.34-3.88-3.78 5.36-.78L12 3z" />
    </svg>
  );
}

function FlashcardsIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="6" width="16" height="13" rx="2" />
      <path d="M6 6V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-2" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function SignOutIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Nav link definitions
// ---------------------------------------------------------------------------

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard', Icon: DashboardIcon },
  { href: '/dashboard/courses', label: 'Courses', Icon: CoursesIcon },
  {
    href: '/dashboard/assignments',
    label: 'Assignments',
    Icon: AssignmentsIcon,
  },
  { href: '/dashboard/quests', label: 'Quests', Icon: QuestsIcon },
  { href: '/flashcards', label: 'Flashcards', Icon: FlashcardsIcon },
];

type AppChromeUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  petName?: string | null;
};

function isNavActive(pathname: string, href: string) {
  return href === '/dashboard'
    ? pathname === '/dashboard'
    : pathname === href || pathname.startsWith(href + '/');
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`flex items-center justify-center rounded-xl bg-brand-50 ring-1 ring-inset ring-brand-500/10 ${compact ? 'h-8 w-8 text-base' : 'h-9 w-9 text-lg'}`}
        aria-hidden
      >
        🐾
      </span>
      <span
        className={`font-semibold tracking-tight text-slate-900 ${compact ? 'text-base' : 'text-lg'}`}
      >
        StudyPet<span className="text-brand-600">+</span>
      </span>
    </div>
  );
}

type SidebarNavProps = {
  pathname: string;
  onNavigate?: () => void;
  onOpenSettings: () => void;
};

function SidebarNav({ pathname, onNavigate, onOpenSettings }: SidebarNavProps) {
  const linkClass = (active: boolean) =>
    [
      'app-sidebar-link group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
      active ? 'app-sidebar-link-active' : '',
    ]
      .filter(Boolean)
      .join(' ');

  const iconClass = (active: boolean) =>
    [
      'h-5 w-5 shrink-0 transition-all duration-200',
      active ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600',
    ].join(' ');

  return (
    <>
      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Main navigation">
        {NAV_LINKS.map(({ href, label, Icon }) => {
          const active = isNavActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={linkClass(active)}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className={iconClass(active)} />
              {label}
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => {
            onOpenSettings();
            onNavigate?.();
          }}
          className={linkClass(false)}
        >
          <SettingsIcon className="h-5 w-5 shrink-0 text-slate-400 transition-all duration-200 group-hover:text-slate-600" />
          Settings
        </button>
      </nav>

      <div className="app-sidebar-divider border-t p-3">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="app-sidebar-link group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200"
        >
          <SignOutIcon className="h-5 w-5 shrink-0 text-slate-400 transition-all duration-200 group-hover:text-slate-600" />
          Sign out
        </button>
      </div>
    </>
  );
}

type SidebarShellProps = {
  user: AppChromeUser;
  onNavigate?: () => void;
  showClose?: boolean;
  onClose?: () => void;
};

function SidebarShell({
  user,
  onNavigate,
  showClose = false,
  onClose,
}: SidebarShellProps) {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <div className="flex h-full w-full flex-col">
        <div className="app-sidebar-divider flex items-center justify-between border-b px-5 py-5">
          <BrandMark />
          {showClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-all duration-200 hover:bg-slate-100 hover:text-slate-900"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          )}
        </div>

        <SidebarNav
          pathname={pathname}
          onNavigate={onNavigate}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        user={user}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Desktop sidebar — minimalist persistent panel
// ---------------------------------------------------------------------------

export function AppSidebar({ user }: { user: AppChromeUser }) {
  return (
    <aside className="app-sidebar hidden h-full w-64 shrink-0 flex-col border-r border-[var(--shell-sidebar-border)] md:flex">
      <SidebarShell user={user} />
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Mobile top bar + slide-in drawer
// ---------------------------------------------------------------------------

export function AppTopBar({ user }: { user: AppChromeUser }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <>
      <header className="app-mobile-bar sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition-all duration-200 hover:bg-slate-100 hover:text-slate-900"
        >
          <MenuIcon className="h-5 w-5" />
        </button>

        <BrandMark compact />

        <div className="h-10 w-10" aria-hidden />
      </header>

      <div
        className={[
          'fixed inset-0 z-40 transition-all duration-200 md:hidden',
          menuOpen
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0',
        ].join(' ')}
        aria-hidden={!menuOpen}
      >
        <button
          type="button"
          aria-label="Close menu"
          className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-all duration-200"
          onClick={() => setMenuOpen(false)}
        />
      </div>

      <aside
        className={[
          'app-sidebar fixed inset-y-0 left-0 z-50 w-[min(85vw,18rem)] border-r border-[var(--shell-sidebar-border)] shadow-2xl shadow-slate-900/10 transition-all duration-200 ease-out md:hidden',
          menuOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        aria-hidden={!menuOpen}
      >
        <SidebarShell
          user={user}
          showClose
          onClose={() => setMenuOpen(false)}
          onNavigate={() => setMenuOpen(false)}
        />
      </aside>
    </>
  );
}
