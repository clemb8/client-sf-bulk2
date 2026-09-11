import { defineConfig } from "vitest/config";

/**
 * End-to-end configuration, deliberately separate from vitest.config.mts.
 *
 * The default `npm test` must never reach a real Salesforce org: it runs in
 * `test/` with nock intercepting everything and `nock.disableNetConnect()` on.
 * This config is the opt-in that talks to a live org, and it is not wired into
 * `prepublishOnly`.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["e2e/**/*.e2e.ts"],
    // Runs before each test file is imported. helpers/suite.ts resolves the
    // configuration at import time, so a globalSetup would be too late.
    setupFiles: ["e2e/helpers/load-env.ts"],
    // Bulk jobs are queued server-side; a single test can legitimately wait
    // minutes. Each test also sets its own timeout.
    testTimeout: 300000,
    hookTimeout: 180000,
    // Jobs share org-level Bulk API limits and the suite writes records, so
    // serial execution keeps failures interpretable.
    fileParallelism: false,
    sequence: { concurrent: false },
    // No coverage thresholds here: coverage is the unit suite's job, and
    // counting network-dependent runs would make the figure unreproducible.
    coverage: { enabled: false },
    retry: 0,
  },
});
