import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'StudyPet+',
  description: 'StudyPet+ — AI Study Planner',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `
              function studypetIsLightColor(hex) {
                if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return false;
                var r = parseInt(hex.slice(1, 3), 16);
                var g = parseInt(hex.slice(3, 5), 16);
                var b = parseInt(hex.slice(5, 7), 16);
                var luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                return luminance > 0.72;
              }
              (function () {
                try {
                  var mode = localStorage.getItem('studypet-theme-mode') || 'light';
                  var accent = localStorage.getItem('studypet-theme-accent') || '#4f46e5';
                  var sidebarText = studypetIsLightColor(accent) ? '#111111' : '#f8fafc';
                  var sidebarDivider = studypetIsLightColor(accent)
                    ? 'rgba(17, 17, 17, 0.14)'
                    : 'rgba(255, 255, 255, 0.12)';
                  document.documentElement.setAttribute('data-theme', mode);
                  document.documentElement.style.setProperty('--accent', accent);
                  document.documentElement.style.setProperty('--accent-strong', accent);
                  document.documentElement.style.setProperty('--accent-soft', accent + '18');
                  document.documentElement.style.setProperty('--sidebar-bg', accent);
                  document.documentElement.style.setProperty('--sidebar-active-bg', accent + '33');
                  document.documentElement.style.setProperty('--sidebar-active-border', accent);
                  document.documentElement.style.setProperty('--sidebar-text', sidebarText);
                  document.documentElement.style.setProperty('--sidebar-text-strong', sidebarText);
                  document.documentElement.style.setProperty('--sidebar-divider', sidebarDivider);
                } catch (e) {}
              })();
            `,
          }}
        />
        {children}
      </body>
    </html>
  );
}
