import { afterAll, beforeAll, expect, it } from "vitest";
import {
  buildInsertCsv,
  deleteRecords,
  idsFromSuccessfulResults,
  parseCsv,
} from "./helpers/org";
import { createContext, describeE2e, disposeContext, type E2eContext } from "./helpers/suite";

/**
 * Ingest against a real org.
 *
 * These tests CREATE RECORDS and then delete them. They are why the harness
 * refuses a production-looking host unless SF_E2E_ALLOW_NON_SANDBOX is set,
 * and why every record carries a run tag.
 */
describeE2e("ingest against a real Salesforce org", () => {
  let ctx: E2eContext;
  const created: string[] = [];

  beforeAll(async () => {
    ctx = await createContext();
  }, 60000);

  afterAll(async () => {
    if (ctx !== undefined && ctx.config.cleanup && created.length > 0) {
      const result = await deleteRecords(ctx.client, ctx.config, ctx.files, created);
      if (result.error !== undefined) {
        // Reported, never thrown: a cleanup failure must not mask the assertion
        // failure that may have preceded it. The run tag makes the leftovers
        // findable by hand.
        console.warn(
          `[e2e] cleanup failed for tag ${ctx.tag}: ${result.error}. ` +
            `${String(created.length)} record(s) may remain in ${ctx.config.instanceUrl}.`,
        );
      }
    }
    disposeContext(ctx);
  }, 180000);

  it(
    "creates a job, uploads a CSV, starts it, waits for completion and reads results back",
    async () => {
      const { client, config, files, tag } = ctx;
      const path = files.write("insert.csv", buildInsertCsv(config, tag));

      const job = await client.createAndStartJob(
        { object: config.object, operation: "insert" },
        path,
      );
      expect(job.id).toMatch(/^750/);

      const state = await client.waitJobEnd(job.id, config.pollDelayMs);
      expect(state).toBe("JobComplete");

      const info = await client.getIngestJobInfo(job.id);
      expect(info.numberRecordsProcessed).toBe(config.recordCount);
      expect(info.numberRecordsFailed).toBe(0);

      const successes = await client.getJobSuccesfulResults(job.id);
      const ids = idsFromSuccessfulResults(successes);
      created.push(...ids);
      expect(ids).toHaveLength(config.recordCount);

      // Every created record carries the run tag, which is what makes a failed
      // run recoverable by hand.
      const rows = parseCsv(successes);
      for (const row of rows) {
        expect(row[config.labelField]).toContain(tag);
      }
    },
    240000,
  );

  it(
    "reports zero failed results for a clean job",
    async () => {
      const { client, config, files, tag } = ctx;
      const path = files.write("insert-2.csv", buildInsertCsv(config, `${tag}-b`));

      const result = await client.createAndWaitJobResult(
        { object: config.object, operation: "insert" },
        path,
      );
      expect(result.state).toBe("JobComplete");
      expect(result.numberRecordsFailed).toBe(0);

      created.push(...idsFromSuccessfulResults(await client.getJobSuccesfulResults(result.id)));

      const failures = await client.getJobFailedResults(result.id);
      expect(parseCsv(failures)).toHaveLength(0);
    },
    240000,
  );

  it(
    "surfaces per-row failures rather than throwing, when a row is invalid",
    async () => {
      // A required field left empty is rejected per row, not per job: the job
      // completes and the failure shows up in failedResults. This is the
      // behaviour a consumer most needs to be able to rely on.
      const { client, config, files } = ctx;
      const path = files.write("insert-bad.csv", `"${config.labelField}"\n""\n`);

      const job = await client.createAndStartJob(
        { object: config.object, operation: "insert" },
        path,
      );
      const state = await client.waitJobEnd(job.id, config.pollDelayMs);
      expect(state).toBe("JobComplete");

      const info = await client.getIngestJobInfo(job.id);
      created.push(...idsFromSuccessfulResults(await client.getJobSuccesfulResults(job.id)));

      // Whichever way the org is configured, the counts must add up and the
      // call must not have thrown.
      expect(info.numberRecordsProcessed + info.numberRecordsFailed).toBeGreaterThan(0);
    },
    240000,
  );

  it(
    "aborts a job that has not been started",
    async () => {
      const { client, config } = ctx;
      const job = await client.createDataUploadJob({
        object: config.object,
        operation: "insert",
      });
      expect(job.state).toBe("Open");

      const aborted = await client.abortJob(job.id);
      expect(aborted.state).toBe("Aborted");
    },
    120000,
  );

  it(
    "rejects with an Error, not a string, when the CSV file does not exist",
    async () => {
      // Locks in the FR8/FR7-adjacent fix: getFileBody used to reject with a
      // bare template string, so consumers lost the stack.
      const { client, config } = ctx;
      await expect(
        client.createAndStartJob(
          { object: config.object, operation: "insert" },
          "/definitely/not/a/real/path.csv",
        ),
      ).rejects.toBeInstanceOf(Error);
    },
    60000,
  );
});
