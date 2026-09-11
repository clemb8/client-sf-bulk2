import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import type { QueryResponse } from "../src/interfaces/QueryResponse";
import { MonitorJob } from "../src/utils";
import { createContext, describeE2e, disposeContext, type E2eContext } from "./helpers/suite";

/**
 * The MonitorJob emitter against a real org.
 *
 * `MonitorJob` is a module-level EventEmitter singleton shared across every
 * BulkAPI instance in a process, and it is part of the public surface. The unit
 * tests drive it with fake timers; this proves it fires on real poll cycles.
 */
describeE2e("MonitorJob against a real Salesforce org", () => {
  let ctx: E2eContext;

  beforeAll(async () => {
    ctx = await createContext();
  }, 60000);

  afterEach(() => {
    MonitorJob.removeAllListeners();
  });

  afterAll(() => {
    MonitorJob.removeAllListeners();
    disposeContext(ctx);
  });

  it(
    "emits a monitoring event for every poll, ending on a terminal state",
    async () => {
      const { client, config } = ctx;
      const states: string[] = [];
      MonitorJob.on("monitoring", (response: QueryResponse) => {
        states.push(response.state);
      });

      const job = await client.submitQueryJob({
        operation: "query",
        query: `SELECT Id FROM ${config.object} LIMIT 1`,
      });
      const final = await client.waitQueryEnd(job.id, config.pollDelayMs);

      expect(states.length).toBeGreaterThan(0);
      expect(states.at(-1)).toBe(final);
      // Every state before the last must be non-terminal, or polling stopped
      // early and the promise resolved on the wrong event.
      for (const state of states.slice(0, -1)) {
        expect(["UploadComplete", "InProgress"]).toContain(state);
      }
    },
    240000,
  );

  it(
    "stops emitting once the awaited call has settled",
    async () => {
      const { client, config } = ctx;
      let count = 0;
      MonitorJob.on("monitoring", () => {
        count++;
      });

      const job = await client.submitQueryJob({
        operation: "query",
        query: `SELECT Id FROM ${config.object} LIMIT 1`,
      });
      await client.waitQueryEnd(job.id, config.pollDelayMs);
      const atSettle = count;

      // The interval must have been cleared. Wait several poll periods and
      // confirm nothing more arrives — this is the leak the fix closed.
      await new Promise((resolve) => setTimeout(resolve, config.pollDelayMs * 3));
      expect(count).toBe(atSettle);
    },
    240000,
  );
});
