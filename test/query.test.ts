import nock from "nock";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { RequestConfig } from "../src/interfaces/RequestConfig";
import {
  requestAbortQueryJob,
  requestGetAllQueryJobInfo,
  requestGetQueryJobInfo,
  requestGetQueryResults,
  requestSubmitQueryJob,
} from "../src/query/query";
import { createAxiosHeader } from "../src/utils";
import { INSTANCE_URL, QUERY_BASE, queryResponse } from "./helpers/fixtures";

function config(path: string): RequestConfig {
  return {
    headers: createAxiosHeader("application/json", "application/json", "TOKEN"),
    endpoint: `${INSTANCE_URL}${path}`,
  };
}

beforeAll(() => {
  nock.disableNetConnect();
});

afterEach(() => {
  nock.cleanAll();
});

afterAll(() => {
  nock.enableNetConnect();
});

describe("requestSubmitQueryJob", () => {
  it("POSTs the query and returns the parsed job", async () => {
    const job = queryResponse({ state: "UploadComplete" });
    nock(INSTANCE_URL).post(QUERY_BASE).reply(200, job);
    await expect(
      requestSubmitQueryJob({ operation: "query", query: "SELECT Id FROM Account" }, config(QUERY_BASE)),
    ).resolves.toMatchObject({ id: job.id, state: "UploadComplete" });
  });

  it("sends the access token as a Bearer header", async () => {
    let auth: string | undefined;
    nock(INSTANCE_URL)
      .post(QUERY_BASE)
      .reply(200, function reply() {
        auth = this.req.getHeader("authorization") as string;
        return queryResponse();
      });
    await requestSubmitQueryJob({ operation: "query", query: "SELECT Id FROM Account" }, config(QUERY_BASE));
    expect(auth).toBe("Bearer TOKEN");
  });

  it("serialises the query input as the JSON body", async () => {
    let body: unknown;
    nock(INSTANCE_URL)
      .post(QUERY_BASE, (received: unknown) => {
        body = received;
        return true;
      })
      .reply(200, queryResponse());
    await requestSubmitQueryJob({ operation: "queryAll", query: "SELECT Id FROM Lead" }, config(QUERY_BASE));
    expect(body).toEqual({ operation: "queryAll", query: "SELECT Id FROM Lead" });
  });

  it("propagates a transport failure to the caller", async () => {
    nock(INSTANCE_URL).post(QUERY_BASE).reply(401, { message: "Session expired" });
    await expect(
      requestSubmitQueryJob({ operation: "query", query: "SELECT Id FROM Account" }, config(QUERY_BASE)),
    ).rejects.toThrow();
  });
});

describe("requestGetQueryJobInfo", () => {
  it("GETs the job and returns its info", async () => {
    nock(INSTANCE_URL).get(`${QUERY_BASE}/750xx`).reply(200, queryResponse({ state: "InProgress" }));
    await expect(requestGetQueryJobInfo(config(`${QUERY_BASE}/750xx`))).resolves.toMatchObject({
      state: "InProgress",
    });
  });

  it("propagates a 404 rather than returning undefined", async () => {
    nock(INSTANCE_URL).get(`${QUERY_BASE}/missing`).reply(404, {});
    await expect(requestGetQueryJobInfo(config(`${QUERY_BASE}/missing`))).rejects.toThrow();
  });
});

describe("requestAbortQueryJob", () => {
  it("PATCHes state Aborted", async () => {
    let body: unknown;
    nock(INSTANCE_URL)
      .patch(`${QUERY_BASE}/750xx`, (received: unknown) => {
        body = received;
        return true;
      })
      .reply(200, queryResponse({ state: "Aborted" }));
    await expect(requestAbortQueryJob(config(`${QUERY_BASE}/750xx`))).resolves.toMatchObject({
      state: "Aborted",
    });
    expect(body).toEqual({ state: "Aborted" });
  });
});

describe("requestGetAllQueryJobInfo", () => {
  it("calls the bare endpoint when no config is supplied", async () => {
    nock(INSTANCE_URL).get(QUERY_BASE).reply(200, { done: true, records: [], nextRecordsUrl: "" });
    await expect(requestGetAllQueryJobInfo(config(QUERY_BASE))).resolves.toMatchObject({ done: true });
  });

  it("appends the supplied filters to the query string", async () => {
    nock(INSTANCE_URL)
      .get(`${QUERY_BASE}/`)
      .query({ jobType: "V2Query", concurrencyMode: "Parallel" })
      .reply(200, { done: true, records: [], nextRecordsUrl: "" });
    await expect(
      requestGetAllQueryJobInfo(config(QUERY_BASE), { jobType: "V2Query", concurrencyMode: "Parallel" }),
    ).resolves.toMatchObject({ done: true });
  });

  it("treats an empty config object as no filters", async () => {
    nock(INSTANCE_URL).get(QUERY_BASE).reply(200, { done: true, records: [], nextRecordsUrl: "" });
    await expect(requestGetAllQueryJobInfo(config(QUERY_BASE), {})).resolves.toMatchObject({ done: true });
  });

  it("does not mutate the caller's RequestConfig", async () => {
    // The regression this locks in: this function used to write the
    // parameterised URL back into the RequestConfig its caller owns, so a
    // hoisted or reused config accumulated query strings.
    const requestConfig = config(QUERY_BASE);
    nock(INSTANCE_URL)
      .get(`${QUERY_BASE}/`)
      .query({ jobType: "V2Query" })
      .reply(200, { done: true, records: [], nextRecordsUrl: "" });
    await requestGetAllQueryJobInfo(requestConfig, { jobType: "V2Query" });
    expect(requestConfig.endpoint).toBe(`${INSTANCE_URL}${QUERY_BASE}`);
  });
});

describe("requestGetQueryResults", () => {
  it("returns the whole axios response, not just the body", async () => {
    nock(INSTANCE_URL)
      .get(`${QUERY_BASE}/750xx/results`)
      .reply(200, "Id\n001\n", { "sforce-locator": "null" });
    const response = await requestGetQueryResults(config(`${QUERY_BASE}/750xx/results`));
    expect(response.status).toBe(200);
    expect(response.data).toBe("Id\n001\n");
    expect(response.headers["sforce-locator"]).toBe("null");
  });

  it("appends the locator and maxRecords when supplied", async () => {
    nock(INSTANCE_URL)
      .get(`${QUERY_BASE}/750xx/results`)
      .query({ locator: "abc", maxRecords: "500" })
      .reply(200, "Id\n002\n", { "sforce-locator": "null" });
    const response = await requestGetQueryResults(config(`${QUERY_BASE}/750xx/results`), 500, "abc");
    expect(response.data).toBe("Id\n002\n");
  });

  it("does not mutate the caller's RequestConfig", async () => {
    const requestConfig = config(`${QUERY_BASE}/750xx/results`);
    nock(INSTANCE_URL)
      .get(`${QUERY_BASE}/750xx/results`)
      .query({ locator: "abc" })
      .reply(200, "Id\n", { "sforce-locator": "null" });
    await requestGetQueryResults(requestConfig, undefined, "abc");
    expect(requestConfig.endpoint).toBe(`${INSTANCE_URL}${QUERY_BASE}/750xx/results`);
  });

  it("can be called twice with the same config without stacking parameters", async () => {
    const requestConfig = config(`${QUERY_BASE}/750xx/results`);
    nock(INSTANCE_URL)
      .get(`${QUERY_BASE}/750xx/results`)
      .query({ locator: "A" })
      .reply(200, "a", { "sforce-locator": "B" });
    nock(INSTANCE_URL)
      .get(`${QUERY_BASE}/750xx/results`)
      .query({ locator: "B" })
      .reply(200, "b", { "sforce-locator": "null" });
    await requestGetQueryResults(requestConfig, undefined, "A");
    await expect(requestGetQueryResults(requestConfig, undefined, "B")).resolves.toMatchObject({
      data: "b",
    });
  });
});
