import './globals.css';

import type { Metadata } from 'next';

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
              function studypetContrastText(hex) {
                return studypetIsLightColor(hex) ? '#111111' : '#ffffff';
              }
              (function () {
                try {
                  var mode = localStorage.getItem('studypet-theme-mode') || 'light';
                  var accent = localStorage.getItem('studypet-theme-accent') || '#4f46e5';
                  var textMode = localStorage.getItem('studypet-theme-text-mode') || 'auto';
                  var savedTextColor = localStorage.getItem('studypet-theme-text-color') || '#ffffff';
                  var accentText = textMode === 'custom' ? savedTextColor : studypetContrastText(accent);
                  document.documentElement.setAttribute('data-theme', mode);
                  document.documentElement.style.setProperty('--accent', accent);
                  document.documentElement.style.setProperty('--accent-strong', accent);
                  document.documentElement.style.setProperty('--accent-soft', accent + '18');
                  document.documentElement.style.setProperty('--accent-text', accentText);
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
