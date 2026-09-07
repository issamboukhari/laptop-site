import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    globals: false,
    reporters: ["verbose"],
    testTimeout: 60000, // 60s default — semantic retrieval build may take ~35s
  },
});
