import type { Config } from "tailwindcss";

const config: Config = {
  // Tailwind scans these files for class names and generates only the CSS
  // that's actually used. If a file isn't listed here, its classes won't work.
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Custom palettes the UI references (text-brand-600, text-mint-500, …).
      colors: {
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
        },
        mint: {
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
        },
      },
    },
  },
  plugins: [],
};

export default config;
