import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import nock from "nock";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import BulkAPI from "../src/BulkAPI";
import {
  INGEST_BASE,
  INSTANCE_URL,
  jobInfoResponse,
  jobUploadResponse,
  QUERY_BASE,
  queryResponse,
  testConnection,
  TOOLING_QUERY_BASE,
} from "./helpers/fixtures";

let dir: string;
let csv: string;

beforeAll(() => {
  nock.disableNetConnect();
  dir = mkdtempSync(join(tmpdir(), "client-sf-bulk2-api-"));
  csv = join(dir, "accounts.csv");
  writeFileSync(csv, "Name,Type\nAcme,Customer\n", "utf8");
});

afterEach(() => {
  nock.cleanAll();
});

afterAll(() => {
  nock.enableNetConnect();
  rmSync(dir, { recursive: true, force: true });
});

describe("endpoint construction", () => {
  it("builds the query endpoint from instance URL and API version", async () => {
    const scope = nock(INSTANCE_URL).get(`${QUERY_BASE}/750xx`).reply(200, queryResponse());
    await new BulkAPI(testConnection()).getQueryJob("750xx");
    expect(scope.isDone()).toBe(true);
  });

  it("builds the ingest endpoint from the same root", async () => {
    const scope = nock(INSTANCE_URL).get(`${INGEST_BASE}/750xx`).reply(200, jobInfoResponse());
    await new BulkAPI(testConnection()).getIngestJobInfo("750xx");
    expect(scope.isDone()).toBe(true);
  });

  it("inserts /tooling when isTooling is set", async () => {
    const scope = nock(INSTANCE_URL).get(`${TOOLING_QUERY_BASE}/750xx`).reply(200, queryResponse());
    await new BulkAPI(testConnection({ isTooling: true })).getQueryJob("750xx");
    expect(scope.isDone()).toBe(true);
  });

  it("omits /tooling when isTooling is absent", async () => {
    const tooling = nock(INSTANCE_URL).get(`${TOOLING_QUERY_BASE}/750xx`).reply(200, queryResponse());
    nock(INSTANCE_URL).get(`${QUERY_BASE}/750xx`).reply(200, queryResponse());
    await new BulkAPI(testConnection()).getQueryJob("750xx");
    expect(tooling.isDone()).toBe(false);
  });
});

describe("getAllQueryResults", () => {
  it("returns the first page when the locator is already 'null'", async () => {
    nock(INSTANCE_URL)
      .get(`${QUERY_BASE}/750xx/results`)
      .reply(200, "Id\n001\n", { "sforce-locator": "null" });
    await expect(new BulkAPI(testConnection()).getAllQueryResults("750xx")).resolves.toBe("Id\n001\n");
  });

  it("follows the locator and strips the repeated header row from later pages", async () => {
    nock(INSTANCE_URL)
      .get(`${QUERY_BASE}/750xx/results`)
      .reply(200, "Id\n001\n", { "sforce-locator": "PAGE2" });
    nock(INSTANCE_URL)
      .get(`${QUERY_BASE}/750xx/results`)
      .query({ locator: "PAGE2" })
      .reply(200, "Id\n002\n", { "sforce-locator": "null" });
    await expect(new BulkAPI(testConnection()).getAllQueryResults("750xx")).resolves.toBe("Id\n001\n002\n");
  });

  it("walks more than two pages", async () => {
    nock(INSTANCE_URL)
      .get(`${QUERY_BASE}/750xx/results`)
      .reply(200, "Id\n001\n", { "sforce-locator": "P2" });
    nock(INSTANCE_URL)
      .get(`${QUERY_BASE}/750xx/results`)
      .query({ locator: "P2" })
      .reply(200, "Id\n002\n", { "sforce-locator": "P3" });
    nock(INSTANCE_URL)
      .get(`${QUERY_BASE}/750xx/results`)
      .query({ locator: "P3" })
      .reply(200, "Id\n003\n", { "sforce-locator": "null" });
    await expect(new BulkAPI(testConnection()).getAllQueryResults("750xx")).resolves.toBe(
      "Id\n001\n002\n003\n",
    );
  });

  it("does not stack locator parameters across pages", async () => {
    // The regression this locks in: the transport used to write the
    // parameterised URL back into the caller-owned RequestConfig, which turned
    // page three's URL into ...?locator=P2?locator=P3 once the config was reused.
    const requested: string[] = [];
    nock(INSTANCE_URL)
      .get(`${QUERY_BASE}/750xx/results`)
      .reply(200, "Id\n001\n", { "sforce-locator": "P2" });
    nock(INSTANCE_URL)
      .get(new RegExp(`${QUERY_BASE}/750xx/results\\?.*`))
      .times(2)
      .reply(function reply(uri: string) {
        requested.push(uri);
        return [200, "Id\nx\n", { "sforce-locator": requested.length === 1 ? "P3" : "null" }];
      });
    await new BulkAPI(testConnection()).getAllQueryResults("750xx");
    expect(requested.every((uri) => uri.split("locator=").length === 2)).toBe(true);
  });

  it("passes maxRecords through to every page request", async () => {
    nock(INSTANCE_URL)
      .get(`${QUERY_BASE}/750xx/results`)
      .query({ maxRecords: "50" })
      .reply(200, "Id\n001\n", { "sforce-locator": "null" });
    await expect(new BulkAPI(testConnection()).getAllQueryResults("750xx", 50)).resolves.toBe("Id\n001\n");
  });
});

describe("getQueryFinalResults", () => {
  it("throws the abort-specific message when the job aborted", async () => {
    nock(INSTANCE_URL).get(`${QUERY_BASE}/750xx`).reply(200, queryResponse({ state: "Aborted" }));
    await expect(new BulkAPI(testConnection()).getQueryFinalResults("750xx")).rejects.toThrow(
      "The query has been aborted",
    );
  }, 10000);

  it("throws the failure-specific message when the job failed", async () => {
    nock(INSTANCE_URL).get(`${QUERY_BASE}/750xx`).reply(200, queryResponse({ state: "Failed" }));
    await expect(new BulkAPI(testConnection()).getQueryFinalResults("750xx")).rejects.toThrow(
      "The query failed",
    );
  }, 10000);

  it("returns the assembled CSV when the job completed", async () => {
    nock(INSTANCE_URL).get(`${QUERY_BASE}/750xx`).reply(200, queryResponse({ state: "JobComplete" }));
    nock(INSTANCE_URL)
      .get(`${QUERY_BASE}/750xx/results`)
      .query({ maxRecords: "200" })
      .reply(200, "Id\n001\n", { "sforce-locator": "null" });
    await expect(new BulkAPI(testConnection()).getQueryFinalResults("750xx")).resolves.toBe("Id\n001\n");
  }, 10000);
});

describe("createAndStartJob", () => {
  it("creates, uploads and starts in order", async () => {
    nock(INSTANCE_URL).post(INGEST_BASE).reply(200, jobUploadResponse({ state: "Open" }));
    nock(INSTANCE_URL).put(`${INGEST_BASE}/750xx0000000001AAA/batches`).reply(201, "");
    nock(INSTANCE_URL)
      .patch(`${INGEST_BASE}/750xx0000000001AAA`)
      .reply(200, jobUploadResponse({ state: "UploadComplete" }));
    await expect(
      new BulkAPI(testConnection()).createAndStartJob({ object: "Account", operation: "insert" }, csv),
    ).resolves.toMatchObject({ state: "UploadComplete" });
  });

  it("throws 'Upload Failed' when the upload does not return 201", async () => {
    nock(INSTANCE_URL).post(INGEST_BASE).reply(200, jobUploadResponse({ state: "Open" }));
    nock(INSTANCE_URL).put(`${INGEST_BASE}/750xx0000000001AAA/batches`).reply(200, "");
    await expect(
      new BulkAPI(testConnection()).createAndStartJob({ object: "Account", operation: "insert" }, csv),
    ).rejects.toThrow("Upload Failed");
  });

  it("does not start the job when the upload failed", async () => {
    nock(INSTANCE_URL).post(INGEST_BASE).reply(200, jobUploadResponse({ state: "Open" }));
    nock(INSTANCE_URL).put(`${INGEST_BASE}/750xx0000000001AAA/batches`).reply(200, "");
    const start = nock(INSTANCE_URL)
      .patch(`${INGEST_BASE}/750xx0000000001AAA`)
      .reply(200, jobUploadResponse());
    await expect(
      new BulkAPI(testConnection()).createAndStartJob({ object: "Account", operation: "insert" }, csv),
    ).rejects.toThrow("Upload Failed");
    expect(start.isDone()).toBe(false);
  });
});

describe("job result accessors", () => {
  it.each([
    ["getJobSuccesfulResults", "successfulResults"],
    ["getJobFailedResults", "failedResults"],
    ["getJobUnprocessedResults", "unprocessedrecords"],
  ] as const)("%s reads the %s endpoint", async (method, path) => {
    nock(INSTANCE_URL).get(`${INGEST_BASE}/750xx/${path}`).reply(200, "sf__Id\n001\n");
    await expect(new BulkAPI(testConnection())[method]("750xx")).resolves.toBe("sf__Id\n001\n");
  });
});

describe("abortJob", () => {
  it("PATCHes the ingest job to Aborted", async () => {
    nock(INSTANCE_URL)
      .patch(`${INGEST_BASE}/750xx`)
      .reply(200, jobUploadResponse({ state: "Aborted" }));
    await expect(new BulkAPI(testConnection()).abortJob("750xx")).resolves.toMatchObject({
      state: "Aborted",
    });
  });
});

describe("submitQueryJob / submitAndGetQueryResults", () => {
  it("submits a query job and returns it", async () => {
    nock(INSTANCE_URL).post(QUERY_BASE).reply(200, queryResponse({ state: "UploadComplete" }));
    await expect(
      new BulkAPI(testConnection()).submitQueryJob({ operation: "query", query: "SELECT Id FROM Account" }),
    ).resolves.toMatchObject({ state: "UploadComplete" });
  });

  it("submits, waits and returns the assembled CSV", async () => {
    nock(INSTANCE_URL).post(QUERY_BASE).reply(200, queryResponse({ state: "UploadComplete" }));
    nock(INSTANCE_URL)
      .get(`${QUERY_BASE}/750xx0000000001AAA`)
      .reply(200, queryResponse({ state: "JobComplete" }));
    nock(INSTANCE_URL)
      .get(`${QUERY_BASE}/750xx0000000001AAA/results`)
      .query({ maxRecords: "200" })
      .reply(200, "Id\n001\n", { "sforce-locator": "null" });
    await expect(
      new BulkAPI(testConnection()).submitAndGetQueryResults({
        operation: "query",
        query: "SELECT Id FROM Account",
      }),
    ).resolves.toBe("Id\n001\n");
  }, 10000);
});

describe("getAllQueryJobInfo", () => {
  it("lists jobs with no filter", async () => {
    nock(INSTANCE_URL)
      .get(QUERY_BASE)
      .reply(200, { done: true, records: [queryResponse()], nextRecordsUrl: "" });
    await expect(new BulkAPI(testConnection()).getAllQueryJobInfo()).resolves.toMatchObject({
      done: true,
    });
  });

  it("passes filters through to the query string", async () => {
    nock(INSTANCE_URL)
      .get(`${QUERY_BASE}/`)
      .query({ jobType: "V2Query" })
      .reply(200, { done: true, records: [], nextRecordsUrl: "" });
    await expect(
      new BulkAPI(testConnection()).getAllQueryJobInfo({ jobType: "V2Query" }),
    ).resolves.toMatchObject({ done: true });
  });
});

describe("abortQueryJob", () => {
  it("PATCHes the query job to Aborted", async () => {
    nock(INSTANCE_URL).patch(`${QUERY_BASE}/750xx`).reply(200, queryResponse({ state: "Aborted" }));
    await expect(new BulkAPI(testConnection()).abortQueryJob("750xx")).resolves.toMatchObject({
      state: "Aborted",
    });
  });
});

describe("waitQueryEnd / waitJobEnd", () => {
  it("honours an explicit delay", async () => {
    nock(INSTANCE_URL).get(`${QUERY_BASE}/750xx`).reply(200, queryResponse({ state: "JobComplete" }));
    const started = Date.now();
    await expect(new BulkAPI(testConnection()).waitQueryEnd("750xx", 50)).resolves.toBe("JobComplete");
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("falls back to the 3000ms default when no delay is given", async () => {
    nock(INSTANCE_URL).get(`${INGEST_BASE}/750xx`).reply(200, jobInfoResponse({ state: "JobComplete" }));
    const started = Date.now();
    await expect(new BulkAPI(testConnection()).waitJobEnd("750xx")).resolves.toBe("JobComplete");
    expect(Date.now() - started).toBeGreaterThanOrEqual(2900);
  }, 10000);

  it("treats a delay of 0 as absent and uses the default", async () => {
    nock(INSTANCE_URL).get(`${QUERY_BASE}/750xx`).reply(200, queryResponse({ state: "JobComplete" }));
    const started = Date.now();
    await expect(new BulkAPI(testConnection()).waitQueryEnd("750xx", 0)).resolves.toBe("JobComplete");
    expect(Date.now() - started).toBeGreaterThanOrEqual(2900);
  }, 10000);
});

describe("createAndWaitJobResult", () => {
  it("creates, uploads, starts, waits and returns the job info", async () => {
    nock(INSTANCE_URL).post(INGEST_BASE).reply(200, jobUploadResponse({ state: "Open" }));
    nock(INSTANCE_URL).put(`${INGEST_BASE}/750xx0000000001AAA/batches`).reply(201, "");
    nock(INSTANCE_URL)
      .patch(`${INGEST_BASE}/750xx0000000001AAA`)
      .reply(200, jobUploadResponse({ state: "UploadComplete" }));
    nock(INSTANCE_URL)
      .get(`${INGEST_BASE}/750xx0000000001AAA`)
      .twice()
      .reply(200, jobInfoResponse({ state: "JobComplete", numberRecordsProcessed: 2 }));
    await expect(
      new BulkAPI(testConnection()).createAndWaitJobResult({ object: "Account", operation: "insert" }, csv),
    ).resolves.toMatchObject({ numberRecordsProcessed: 2 });
  }, 15000);

  it("throws when the job does not reach JobComplete", async () => {
    nock(INSTANCE_URL).post(INGEST_BASE).reply(200, jobUploadResponse({ state: "Open" }));
    nock(INSTANCE_URL).put(`${INGEST_BASE}/750xx0000000001AAA/batches`).reply(201, "");
    nock(INSTANCE_URL)
      .patch(`${INGEST_BASE}/750xx0000000001AAA`)
      .reply(200, jobUploadResponse({ state: "UploadComplete" }));
    nock(INSTANCE_URL)
      .get(`${INGEST_BASE}/750xx0000000001AAA`)
      .reply(200, jobInfoResponse({ state: "Failed" }));
    await expect(
      new BulkAPI(testConnection()).createAndWaitJobResult({ object: "Account", operation: "insert" }, csv),
    ).rejects.toThrow("didn't complete");
  }, 15000);
});
