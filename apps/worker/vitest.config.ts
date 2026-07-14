import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration test touches Redis + Postgres; allow generous timeouts.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    environment: "node",
  },
});
