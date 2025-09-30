import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/e2e/**/*.test.ts"],
    // Run E2E tests sequentially to avoid data conflicts
    fileParallelism: false,
    maxConcurrency: 1,
  },
});
