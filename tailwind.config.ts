import type { Config } from "tailwindcss";

// Tailwind v4 is configured via CSS @theme in src/styles.css.
// This file exists only so editor/lov tooling can resolve a config path.
const config: Config = {
  content: ["./src/**/*.{ts,tsx,js,jsx,html}"],
  theme: { extend: {} },
  plugins: [],
};

export default config;
