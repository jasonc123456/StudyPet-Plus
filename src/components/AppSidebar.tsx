'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

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
  { href: '/settings', label: 'Settings', Icon: SettingsIcon },
];

// ---------------------------------------------------------------------------
// Sidebar — desktop persistent drawer
// ---------------------------------------------------------------------------

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col bg-brand-700">
      {/* Brand mark */}
      <div className="flex items-center gap-2.5 border-b border-brand-600 px-6 py-5">
        <span className="text-xl">🐾</span>
        <span className="text-lg font-bold tracking-tight text-white">
          StudyPet<span className="text-mint-500">+</span>
        </span>
      </div>

      {/* Primary navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Main navigation">
        {NAV_LINKS.map(({ href, label, Icon }) => {
          const isActive =
            href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'border-l-2 border-mint-500 bg-white/10 pl-[10px] text-white'
                  : 'text-blue-100 hover:bg-white/10 hover:text-white',
              ].join(' ')}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Sign-out action */}
      <div className="border-t border-brand-600 p-3">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-blue-100 transition-colors hover:bg-white/10 hover:text-white"
        >
          <SignOutIcon className="h-5 w-5 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Mobile top bar — shown below md breakpoint
// ---------------------------------------------------------------------------

export function AppTopBar() {
  const pathname = usePathname();

  return (
    <header className="flex items-center justify-between border-b border-brand-600 bg-brand-700 px-4 py-3">
      {/* Brand */}
      <div className="flex items-center gap-2">
        <span className="text-base">🐾</span>
        <span className="font-bold tracking-tight text-white">
          StudyPet<span className="text-mint-500">+</span>
        </span>
      </div>

      {/* Nav links (compact) */}
      <nav className="flex items-center gap-1" aria-label="Main navigation">
        {NAV_LINKS.map(({ href, label, Icon }) => {
          const isActive =
            href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-white/20 text-white'
                  : 'text-blue-100 hover:bg-white/10 hover:text-white',
              ].join(' ')}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden xs:inline">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Sign out (icon only on mobile) */}
      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        title="Sign out"
        className="rounded-md p-1.5 text-blue-100 transition-colors hover:bg-white/10 hover:text-white"
      >
        <SignOutIcon className="h-5 w-5" />
      </button>
    </header>
  );
}
