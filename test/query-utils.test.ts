import { describe, expect, it } from "vitest";
import {
  handleQueryNotComplete,
  includeParametersQueryJobsInfos,
  includeParametersQueryResults,
} from "../src/query/utils";

describe("includeParametersQueryResults", () => {
  it("appends a bare '?' when neither parameter is supplied", () => {
    expect(includeParametersQueryResults("/results", undefined, undefined)).toBe("/results?");
  });

  it("appends only the locator when maxRecords is absent", () => {
    expect(includeParametersQueryResults("/results", undefined, "abc")).toBe("/results?locator=abc");
  });

  it("appends only maxRecords when the locator is absent", () => {
    expect(includeParametersQueryResults("/results", 500, undefined)).toBe("/results?maxRecords=500");
  });

  it("joins both parameters with '&' in locator-first order", () => {
    expect(includeParametersQueryResults("/results", 500, "abc")).toBe(
      "/results?locator=abc&maxRecords=500",
    );
  });

  it("does not mutate the endpoint it is given", () => {
    const endpoint = "/results";
    includeParametersQueryResults(endpoint, 500, "abc");
    expect(endpoint).toBe("/results");
  });
});

describe("includeParametersQueryJobsInfos", () => {
  it("appends a single parameter after '/?'", () => {
    expect(includeParametersQueryJobsInfos({ jobType: "V2Query" }, "/jobs/query")).toBe(
      "/jobs/query/?jobType=V2Query",
    );
  });

  it("separates several parameters with '&' and leaves no trailing separator", () => {
    const endpoint = includeParametersQueryJobsInfos(
      { jobType: "V2Query", concurrencyMode: "Parallel", queryLocator: 42 },
      "/jobs/query",
    );
    expect(endpoint).toBe("/jobs/query/?jobType=V2Query&concurrencyMode=Parallel&queryLocator=42");
    expect(endpoint.endsWith("&")).toBe(false);
  });

  it("yields a bare '/?' for an empty config", () => {
    expect(includeParametersQueryJobsInfos({}, "/jobs/query")).toBe("/jobs/query/?");
  });
});

describe("handleQueryNotComplete", () => {
  it("names an aborted job", () => {
    expect(() => { handleQueryNotComplete("Aborted"); }).toThrow("The query has been aborted");
  });

  it("names a failed job", () => {
    expect(() => { handleQueryNotComplete("Failed"); }).toThrow("The query failed");
  });

  it("falls back to a generic message for any other state", () => {
    expect(() => { handleQueryNotComplete("InProgress"); }).toThrow(
      "Something went wrong while getting query information",
    );
  });

  it("always throws an Error rather than a bare value", () => {
    expect(() => { handleQueryNotComplete("Failed"); }).toThrow(Error);
  });
});
