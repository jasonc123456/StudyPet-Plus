// PostCSS runs Tailwind (which generates the utility CSS) and Autoprefixer
// (which adds vendor prefixes). Next.js picks this file up automatically.
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
