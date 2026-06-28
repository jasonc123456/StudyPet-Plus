/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // These tokens will satisfy the compiler immediately; you can adjust hex values if needed
        brand: {
          500: "#3b82f6", 
          600: "#2563eb", 
          700: "#1d4ed8", 
        },
        mint: {
          500: "#10b981",
          600: "#059669",
        },
      },
    },
  },
  plugins: [],
}