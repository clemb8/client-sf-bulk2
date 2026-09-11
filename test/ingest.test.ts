import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import nock from "nock";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  requestCreateJob,
  requestGetJobInfo,
  requestGetJobResults,
  requestJobAbort,
  requestJobStart,
  requestJobUploadData,
} from "../src/ingest/ingest";
import type { RequestConfig } from "../src/interfaces/RequestConfig";
import { createAxiosHeader } from "../src/utils";
import { INGEST_BASE, INSTANCE_URL, jobInfoResponse, jobUploadResponse } from "./helpers/fixtures";

function config(path: string, accept = "application/json"): RequestConfig {
  return {
    headers: createAxiosHeader("application/json", accept, "TOKEN"),
    endpoint: `${INSTANCE_URL}${path}`,
  };
}

let dir: string;
let csv: string;

beforeAll(() => {
  nock.disableNetConnect();
  dir = mkdtempSync(join(tmpdir(), "client-sf-bulk2-ingest-"));
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

describe("requestCreateJob", () => {
  it("POSTs the job request and returns the created job", async () => {
    nock(INSTANCE_URL).post(INGEST_BASE).reply(200, jobUploadResponse({ state: "Open" }));
    await expect(
      requestCreateJob({ object: "Account", operation: "insert" }, config(INGEST_BASE)),
    ).resolves.toMatchObject({ state: "Open", jobType: "V2Ingest" });
  });

  it("serialises the job request as the JSON body", async () => {
    let body: unknown;
    nock(INSTANCE_URL)
      .post(INGEST_BASE, (received: unknown) => {
        body = received;
        return true;
      })
      .reply(200, jobUploadResponse());
    await requestCreateJob({ object: "Contact", operation: "upsert", externalIdFieldName: "Ext__c" }, config(INGEST_BASE));
    expect(body).toEqual({ object: "Contact", operation: "upsert", externalIdFieldName: "Ext__c" });
  });

  it("propagates a rejected create", async () => {
    nock(INSTANCE_URL).post(INGEST_BASE).reply(400, { message: "InvalidJob" });
    await expect(
      requestCreateJob({ object: "Account", operation: "insert" }, config(INGEST_BASE)),
    ).rejects.toThrow();
  });
});

describe("requestJobUploadData", () => {
  it("PUTs the file contents and returns the status code", async () => {
    let uploaded = "";
    nock(INSTANCE_URL)
      .put(`${INGEST_BASE}/750xx/batches`, (body: string) => {
        uploaded = body;
        return true;
      })
      .reply(201, "");
    await expect(requestJobUploadData(csv, config(`${INGEST_BASE}/750xx/batches`))).resolves.toBe(201);
    expect(uploaded).toContain("Acme,Customer");
  });

  it("rejects with an Error when the file does not exist", async () => {
    await expect(
      requestJobUploadData(join(dir, "nope.csv"), config(`${INGEST_BASE}/750xx/batches`)),
    ).rejects.toBeInstanceOf(Error);
  });

  it("does not issue a request when reading the file fails", async () => {
    const scope = nock(INSTANCE_URL).put(`${INGEST_BASE}/750xx/batches`).reply(201, "");
    await expect(
      requestJobUploadData(join(dir, "nope.csv"), config(`${INGEST_BASE}/750xx/batches`)),
    ).rejects.toBeInstanceOf(Error);
    expect(scope.isDone()).toBe(false);
  });
});

describe("requestJobStart / requestJobAbort", () => {
  it("PATCHes state UploadComplete to start a job", async () => {
    let body: unknown;
    nock(INSTANCE_URL)
      .patch(`${INGEST_BASE}/750xx`, (received: unknown) => {
        body = received;
        return true;
      })
      .reply(200, jobUploadResponse({ state: "UploadComplete" }));
    await expect(requestJobStart(config(`${INGEST_BASE}/750xx`))).resolves.toMatchObject({
      state: "UploadComplete",
    });
    expect(body).toEqual({ state: "UploadComplete" });
  });

  it("PATCHes state Aborted to abort a job", async () => {
    let body: unknown;
    nock(INSTANCE_URL)
      .patch(`${INGEST_BASE}/750xx`, (received: unknown) => {
        body = received;
        return true;
      })
      .reply(200, jobUploadResponse({ state: "Aborted" }));
    await expect(requestJobAbort(config(`${INGEST_BASE}/750xx`))).resolves.toMatchObject({
      state: "Aborted",
    });
    expect(body).toEqual({ state: "Aborted" });
  });
});

describe("requestGetJobInfo", () => {
  it("returns the parsed job info", async () => {
    nock(INSTANCE_URL)
      .get(`${INGEST_BASE}/750xx`)
      .reply(200, jobInfoResponse({ numberRecordsProcessed: 7 }));
    await expect(requestGetJobInfo(config(`${INGEST_BASE}/750xx`))).resolves.toMatchObject({
      numberRecordsProcessed: 7,
    });
  });
});

describe("requestGetJobResults", () => {
  it("returns the CSV body as a string", async () => {
    nock(INSTANCE_URL)
      .get(`${INGEST_BASE}/750xx/successfulResults`)
      .reply(200, '"sf__Id","Name"\n"001","Acme"\n');
    await expect(
      requestGetJobResults(config(`${INGEST_BASE}/750xx/successfulResults`, "text/csv")),
    ).resolves.toBe('"sf__Id","Name"\n"001","Acme"\n');
  });

  it("propagates a transport failure", async () => {
    nock(INSTANCE_URL).get(`${INGEST_BASE}/750xx/failedResults`).reply(500, "boom");
    await expect(
      requestGetJobResults(config(`${INGEST_BASE}/750xx/failedResults`, "text/csv")),
    ).rejects.toThrow();
  });
});
