'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/dashboard/admin', label: 'Overview' },
  { href: '/dashboard/admin/users', label: 'Users' },
  { href: '/dashboard/admin/activity', label: 'Sign-in activity' },
  { href: '/dashboard/admin/ai', label: 'AI usage' },
  { href: '/dashboard/admin/audit', label: 'Audit log' },
];

function isActive(pathname: string, href: string) {
  return href === '/dashboard/admin'
    ? pathname === '/dashboard/admin'
    : pathname === href || pathname.startsWith(href + '/');
}

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin sections"
      className="-mx-1 flex gap-1 overflow-x-auto pb-1"
    >
      {TABS.map((tab) => {
        const active = isActive(pathname, tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={[
              'whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-brand-50 text-brand-700'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
            ].join(' ')}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
