import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      /** Next resolves "server-only" itself; tests run on the server side, so it is the empty module there too. */
      "server-only": path.resolve(__dirname, "node_modules/next/dist/compiled/server-only/empty.js"),
    },
  },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
