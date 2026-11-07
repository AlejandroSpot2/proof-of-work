import { defineConfig } from "vitest/config";

/** Opt-in live smoke: real model calls on the EXAMPLE fixture files. Never part of `npm test`. */
export default defineConfig({
  resolve: { alias: { "@": import.meta.dirname } },
  test: { environment: "node", include: ["tests-live/**/*.test.ts"], testTimeout: 300_000 },
});
