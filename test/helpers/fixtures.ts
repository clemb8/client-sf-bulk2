import type { Parameters } from "../../src/interfaces/Parameters";

export const INSTANCE_URL = "https://example.my.salesforce.com";
export const API_VERSION = "57.0";

/** A connection that points at a host nock intercepts rather than Salesforce. */
export function testConnection(overrides: Partial<Parameters> = {}): Parameters {
  return {
    accessToken: "test-access-token",
    apiVersion: API_VERSION,
    instanceUrl: INSTANCE_URL,
    ...overrides,
  };
}

export const QUERY_BASE = `/services/data/v${API_VERSION}/jobs/query`;
export const INGEST_BASE = `/services/data/v${API_VERSION}/jobs/ingest`;
export const TOOLING_QUERY_BASE = `/services/data/v${API_VERSION}/tooling/jobs/query`;

import type { QueryResponse } from "../../src/interfaces/QueryResponse";
import type { JobInfoResponse } from "../../src/interfaces/JobInfoResponse";
import type { JobUploadResponse } from "../../src/interfaces/JobUploadResponse";

export function queryResponse(overrides: Partial<QueryResponse> = {}): QueryResponse {
  return {
    id: "750xx0000000001AAA",
    operation: "query",
    object: "Account",
    createdById: "005xx0000000001AAA",
    createdDate: "2026-01-01T00:00:00.000+0000",
    systemModstamp: "2026-01-01T00:00:10.000+0000",
    state: "JobComplete",
    concurrencyMode: "Parallel",
    contentType: "CSV",
    apiVersion: "57.0",
    lineEnding: "LF",
    columnDelimiter: "COMMA",
    ...overrides,
  };
}

export function jobUploadResponse(overrides: Partial<JobUploadResponse> = {}): JobUploadResponse {
  return {
    ...queryResponse(),
    operation: "insert",
    state: "Open",
    assignmentRuleId: "",
    contentUrl: "services/data/v57.0/jobs/ingest/750xx0000000001AAA/batches",
    externalIdFieldName: "",
    jobType: "V2Ingest",
    ...overrides,
  };
}

export function jobInfoResponse(overrides: Partial<JobInfoResponse> = {}): JobInfoResponse {
  return {
    ...jobUploadResponse(),
    state: "JobComplete",
    apexProcessingTime: 0,
    apiActiveProcessingTime: 0,
    numberRecordsFailed: 0,
    numberRecordsProcessed: 2,
    retries: 0,
    totalProcessingTime: 12,
    ...overrides,
  };
}
