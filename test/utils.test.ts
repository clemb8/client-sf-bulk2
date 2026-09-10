import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type BulkAPI from "../src/BulkAPI";
import type { JobInfoResponse } from "../src/interfaces/JobInfoResponse";
import type { QueryResponse } from "../src/interfaces/QueryResponse";
import {
  createAxiosHeader,
  getFinalJobState,
  getFinalQueryState,
  MonitorJob,
} from "../src/utils";
import { jobInfoResponse, queryResponse } from "./helpers/fixtures";

describe("createAxiosHeader", () => {
  it("puts the access token in a Bearer Authorization header", () => {
    const config = createAxiosHeader("application/json", "text/csv", "TOKEN");
    expect(config.headers).toMatchObject({ Authorization: "Bearer TOKEN" });
  });

  it("carries the content type and accept values through unchanged", () => {
    const config = createAxiosHeader("application/json", "text/csv", "TOKEN");
    expect(config.headers).toMatchObject({
      "Content-Type": "application/json",
      "accept": "text/csv",
    });
  });

  it("returns a fresh object on every call", () => {
    const a = createAxiosHeader("application/json", "text/csv", "TOKEN");
    const b = createAxiosHeader("application/json", "text/csv", "TOKEN");
    expect(a).not.toBe(b);
    expect(a.headers).not.toBe(b.headers);
  });

  it("opts out of axios's body and content size limits", () => {
    // Recorded rather than endorsed: this is why an axios upgrade does not by
    // itself mitigate the unbounded-size advisory class for this client.
    const config = createAxiosHeader("application/json", "text/csv", "TOKEN");
    expect(config.maxBodyLength).toBe(Infinity);
    expect(config.maxContentLength).toBe(Infinity);
  });
});

/** A BulkAPI stand-in whose poll results the test drives directly. */
function pollingClient(
  queryStates: Array<QueryResponse | Error>,
  jobStates: Array<JobInfoResponse | Error> = [],
) {
  const getQueryJob = vi.fn(() => {
    const next = queryStates.shift();
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next!);
  });
  const getIngestJobInfo = vi.fn(() => {
    const next = jobStates.shift();
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next!);
  });
  return { getQueryJob, getIngestJobInfo } as unknown as BulkAPI;
}

describe("getFinalQueryState / getFinalJobState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MonitorJob.removeAllListeners();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    MonitorJob.removeAllListeners();
  });

  it("resolves with the terminal state once polling reaches it", async () => {
    const client = pollingClient([queryResponse({ state: "JobComplete" })]);
    const pending = getFinalQueryState(client, "750xx", 1000);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toBe("JobComplete");
  });

  it("keeps polling while the job is InProgress", async () => {
    const client = pollingClient([
      queryResponse({ state: "InProgress" }),
      queryResponse({ state: "InProgress" }),
      queryResponse({ state: "JobComplete" }),
    ]);
    const pending = getFinalQueryState(client, "750xx", 1000);
    await vi.advanceTimersByTimeAsync(3000);
    await expect(pending).resolves.toBe("JobComplete");
  });

  it("treats UploadComplete as non-terminal", async () => {
    const client = pollingClient([
      queryResponse({ state: "UploadComplete" }),
      queryResponse({ state: "Aborted" }),
    ]);
    const pending = getFinalQueryState(client, "750xx", 1000);
    await vi.advanceTimersByTimeAsync(2000);
    await expect(pending).resolves.toBe("Aborted");
  });

  it("emits a monitoring event for every poll, terminal one included", async () => {
    const seen: string[] = [];
    MonitorJob.on("monitoring", (r: QueryResponse) => seen.push(r.state));
    const client = pollingClient([
      queryResponse({ state: "InProgress" }),
      queryResponse({ state: "JobComplete" }),
    ]);
    const pending = getFinalQueryState(client, "750xx", 1000);
    await vi.advanceTimersByTimeAsync(2000);
    await pending;
    expect(seen).toEqual(["InProgress", "JobComplete"]);
  });

  it("stops polling once it has resolved", async () => {
    const client = pollingClient([queryResponse({ state: "Failed" })]);
    const pending = getFinalQueryState(client, "750xx", 1000);
    await vi.advanceTimersByTimeAsync(1000);
    await pending;
    const callsAtResolve = vi.mocked(client.getQueryJob).mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(vi.mocked(client.getQueryJob).mock.calls.length).toBe(callsAtResolve);
  });

  it("rejects when a poll fails instead of hanging forever", async () => {
    // The regression this locks in: the poller had no reject path, so a failed
    // poll became an unhandled rejection, the interval was never cleared, and
    // the awaiting call never settled.
    const client = pollingClient([new Error("401 Unauthorized")]);
    // Attach the rejection handler before the timer fires, or the rejection is
    // unhandled for the duration of the advance.
    const settled = expect(getFinalQueryState(client, "750xx", 1000)).rejects.toThrow(
      "401 Unauthorized",
    );
    await vi.advanceTimersByTimeAsync(1000);
    await settled;
  });

  it("clears the interval when a poll fails", async () => {
    const client = pollingClient([new Error("boom")]);
    const settled = expect(getFinalQueryState(client, "750xx", 1000)).rejects.toThrow("boom");
    await vi.advanceTimersByTimeAsync(1000);
    await settled;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("wraps a non-Error rejection so the caller always receives an Error", async () => {
    const getQueryJob = vi.fn(() => Promise.reject("plain string"));
    const client = { getQueryJob } as unknown as BulkAPI;
    const settled = expect(getFinalQueryState(client, "750xx", 1000)).rejects.toBeInstanceOf(Error);
    await vi.advanceTimersByTimeAsync(1000);
    await settled;
  });

  it("polls the ingest endpoint for getFinalJobState", async () => {
    const client = pollingClient([], [jobInfoResponse({ state: "JobComplete" })]);
    const pending = getFinalJobState(client, "750xx", 1000);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toBe("JobComplete");
    expect(vi.mocked(client.getIngestJobInfo)).toHaveBeenCalledWith("750xx");
    expect(vi.mocked(client.getQueryJob)).not.toHaveBeenCalled();
  });
});
