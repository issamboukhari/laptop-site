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
    testTimeout: 30000, // 30s default — benchmarks may take longer
  },
});
