import { defineConfig } from "vitest/config";
import path from "node:path";

// Config standalone — não estende vite.config.ts pra evitar carregar
// os plugins do TanStack Start (que exigem contexto de dev server).
export default defineConfig({
  plugins: [],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "happy-dom",
    globals: false,
    include: ["src/**/*.test.ts"],
    server: {
      deps: {
        inline: [],
      },
    },
  },
});