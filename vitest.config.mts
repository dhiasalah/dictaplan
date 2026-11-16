import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": import.meta.dirname } },
  oxc: { jsx: { runtime: "automatic" } },
  test: { environment: "node", include: ["lib/**/*.test.ts", "components/**/*.test.tsx"], testTimeout: 30_000 },
});
