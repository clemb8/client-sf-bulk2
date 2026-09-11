import { afterAll, beforeAll, expect, it } from "vitest";
import { parseCsv } from "./helpers/org";
import { createContext, describeE2e, disposeContext, type E2eContext } from "./helpers/suite";

/**
 * Query against a real org. Read-only — these tests create nothing.
 */
describeE2e("query against a real Salesforce org", () => {
  let ctx: E2eContext;

  beforeAll(async () => {
    ctx = await createContext();
  }, 60000);

  afterAll(() => {
    disposeContext(ctx);
  });

  it(
    "submits a query job, waits for it and returns CSV",
    async () => {
      const { client, config } = ctx;
      const job = await client.submitQueryJob({
        operation: "query",
        query: `SELECT Id, ${config.labelField} FROM ${config.object} LIMIT 5`,
      });
      expect(job.id).toMatch(/^750/);

      const state = await client.waitQueryEnd(job.id, config.pollDelayMs);
      expect(state).toBe("JobComplete");

      const csv = await client.getAllQueryResults(job.id);
      expect(typeof csv).toBe("string");
      expect(csv).toContain("Id");
    },
    240000,
  );

  it(
    "returns results in one call via submitAndGetQueryResults",
    async () => {
      const { client, config } = ctx;
      const csv = await client.submitAndGetQueryResults({
        operation: "query",
        query: `SELECT Id FROM ${config.object} LIMIT 5`,
      });
      expect(typeof csv).toBe("string");
      expect(parseCsv(csv ?? "").length).toBeLessThanOrEqual(5);
    },
    240000,
  );

  it(
    "paginates without stacking locator parameters",
    async () => {
      // The regression this locks in end-to-end: the transport used to write
      // its parameterised URL back into the caller-owned RequestConfig, which
      // turned page three's URL into ...?locator=A?locator=B. A small
      // maxRecords forces real pagination against the org.
      const { client, config } = ctx;
      const job = await client.submitQueryJob({
        operation: "query",
        query: `SELECT Id FROM ${config.object} LIMIT 25`,
      });
      const state = await client.waitQueryEnd(job.id, config.pollDelayMs);
      expect(state).toBe("JobComplete");

      // maxRecords of 1 forces a page per row, so pagination engages whenever
      // the org holds at least two records. An earlier version used 10 and
      // quietly exercised nothing on a small org.
      const paginated = await client.getAllQueryResults(job.id, 1);
      const single = await client.getAllQueryResults(job.id);

      // The strong property, and the one the defect would break: paging through
      // must produce exactly what one unpaginated fetch produces. Stacked
      // locators (...?locator=A?locator=B) either error or drop rows.
      expect(parseCsv(paginated)).toEqual(parseCsv(single));

      // The header must survive exactly once: later pages have theirs stripped.
      // Salesforce quotes it, so compare on the unquoted value rather than a
      // prefix — `startsWith("Id")` matches nothing against `"Id"`.
      const headerRows = paginated
        .split("\n")
        .filter((line) => line.replace(/"/g, "").trim() === "Id");
      expect(headerRows).toHaveLength(1);

      const rows = parseCsv(paginated);
      expect(rows.every((row) => (row.Id ?? "").length > 0)).toBe(true);
      if (rows.length < 2) {
        console.warn(
          `[e2e] only ${String(rows.length)} ${config.object} record(s) in this org, ` +
            "so pagination was not exercised. Add records to make this test meaningful.",
        );
      }
    },
    300000,
  );

  it(
    "reads job info for a submitted query",
    async () => {
      const { client, config } = ctx;
      const job = await client.submitQueryJob({
        operation: "query",
        query: `SELECT Id FROM ${config.object} LIMIT 1`,
      });
      const info = await client.getQueryJob(job.id);
      expect(info.id).toBe(job.id);
      expect(info.object).toBe(config.object);
    },
    120000,
  );

  it(
    "lists query jobs",
    async () => {
      const { client } = ctx;
      const all = await client.getAllQueryJobInfo();
      expect(Array.isArray(all.records)).toBe(true);
    },
    120000,
  );

  it(
    "aborts a query job",
    async () => {
      const { client, config } = ctx;
      const job = await client.submitQueryJob({
        operation: "query",
        query: `SELECT Id FROM ${config.object}`,
      });
      const aborted = await client.abortQueryJob(job.id);
      expect(aborted.state).toBe("Aborted");
    },
    120000,
  );

  it(
    "propagates a Salesforce error to the caller instead of hanging",
    async () => {
      // The poller used to have no rejection path: a failure mid-poll became an
      // unhandled rejection, the interval was never cleared, and the awaiting
      // call never settled. An invalid SOQL is the cheapest way to prove a
      // failure now reaches the caller against a live org.
      const { client } = ctx;
      await expect(
        client.submitQueryJob({
          operation: "query",
          query: "SELECT Id FROM ThisObjectDoesNotExist__c",
        }),
      ).rejects.toBeInstanceOf(Error);
    },
    120000,
  );
});
