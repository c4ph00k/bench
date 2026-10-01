import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Each file boots its own Postgres container; running them one at a time keeps a burst of
    // containers from starving the slower boots into hook timeouts.
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 15_000,
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: ["src/index.ts"],
      thresholds: { statements: 80 },
    },
  },
});
