import { AxiosResponse } from "axios";
import { requestCreateJob, requestGetJobInfo, requestGetJobResults, requestJobAbort, requestJobStart, requestJobUploadData } from "./ingest/ingest";
import { AllQueryJobsInfoResponse } from "./interfaces/AllQueryJobsInfoResponse";
import { JobInfoResponse } from "./interfaces/JobInfoResponse";
import { JobUploadRequest } from "./interfaces/JobUploadRequest";
import { JobUploadResponse } from "./interfaces/JobUploadResponse";
import { Parameters } from "./interfaces/Parameters";
import { QueryConfig } from "./interfaces/QueryConfig";
import { QueryInput } from "./interfaces/QueryInput";
import { QueryResponse } from "./interfaces/QueryResponse";
import { RequestConfig } from "./interfaces/RequestConfig";
import { requestAbortQueryJob, requestGetAllQueryJobInfo, requestGetQueryJobInfo, requestGetQueryResults, requestSubmitQueryJob } from "./query/query";
import { handleQueryNotComplete } from "./query/utils";
import { createAxiosHeader, getFinalJobState, getFinalQueryState } from "./utils";

/**
 * Client for the Salesforce Bulk API 2.0.
 *
 * Wraps both halves of the API: query jobs (export records with SOQL) and
 * ingest jobs (insert, update, upsert or delete records from a CSV file).
 * The `submitAndGetQueryResults` and `createAndWaitJobResult` methods collapse
 * the whole create / upload / start / poll / paginate sequence into one call.
 *
 * Errors are never caught here — axios rejections propagate to the caller.
 * Never log a raw axios error: it carries `config.headers.Authorization`,
 * which is the live Salesforce access token.
 *
 * @example
 * ```typescript
 * const bulkAPI = new BulkAPI({ accessToken, apiVersion: "55.0", instanceUrl });
 * const csv = await bulkAPI.submitAndGetQueryResults({
 *   operation: "query",
 *   query: "SELECT Id, Name FROM Account",
 * });
 * ```
 *
 * @see {@link https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/bulk_api_2_0.htm | Bulk API 2.0 documentation}
 */
export default class BulkAPI {

  private connection: Parameters;
  private endpoint: string;
  private endpointQuery: string;
  private endpointIngest: string;

  /**
   * @param connection Access token, API version (for example `"55.0"`) and
   * instance URL of the target org. Set `isTooling` to target the Tooling API.
   */
  constructor(connection: Parameters) {
    this.connection = connection;
    this.endpoint = connection.instanceUrl + "/services/data/v" + connection.apiVersion;
    if (this.connection.isTooling) { this.endpoint += "/tooling"; }
    this.endpoint += "/jobs";
    this.endpointQuery = this.endpoint + "/query";
    this.endpointIngest = this.endpoint + "/ingest";
  }

  /**
   * Submit a SOQL query job. Returns as soon as Salesforce accepts the job —
   * it will still be `UploadComplete` or `InProgress`.
   *
   * @param query The SOQL statement and `operation` (`"query"` or `"queryAll"`).
   * @returns The created job, including the `id` needed to poll and fetch results.
   */
  public async submitQueryJob(query: QueryInput): Promise<QueryResponse> {
    const requestConfig: RequestConfig = this.getRequestConfig("application/json", "application/json", this.endpointQuery);
    return await requestSubmitQueryJob(query, requestConfig);
  }

  /**
   * Fetch the current state of one query job.
   *
   * @param jobId Id returned by {@link submitQueryJob}.
   */
  public async getQueryJob(jobId: string): Promise<QueryResponse> {
    const endpoint = `${this.endpointQuery}/${jobId}`;
    const requestConfig: RequestConfig = this.getRequestConfig("application/json", "application/json", endpoint);
    return await requestGetQueryJobInfo(requestConfig);
  }

  /**
   * List the query jobs in the org.
   *
   * @param configInput Optional filters (PK chunking, job type, concurrency
   * mode, query locator).
   */
  public async getAllQueryJobInfo(configInput?: QueryConfig): Promise<AllQueryJobsInfoResponse> {
    const requestConfig: RequestConfig = this.getRequestConfig("application/json", "application/json", this.endpointQuery);
    return await requestGetAllQueryJobInfo(requestConfig, configInput);
  }

  /**
   * Abort a running query job.
   *
   * @param jobId Id of the job to abort.
   */
  public async abortQueryJob(jobId: string): Promise<QueryResponse> {
    const endpoint = `${this.endpointQuery}/${jobId}`;
    const requestConfig: RequestConfig = this.getRequestConfig("application/json", "application/json", endpoint);
    return await requestAbortQueryJob(requestConfig);
  }

  /**
   * Fetch a single page of query results as CSV, header row included.
   *
   * Prefer {@link getAllQueryResults} unless you want to drive pagination
   * yourself; the `Sforce-Locator` response header carries the cursor for the
   * next page.
   *
   * @param jobId Id of a completed query job.
   * @param maxRecords Maximum records in this page.
   * @param locator Cursor from a previous response's `Sforce-Locator` header.
   * @returns The raw axios response, so the locator header stays reachable.
   */
  public async getQueryResults(jobId: string, maxRecords?: number, locator?: string): Promise<AxiosResponse<string>> {
    const endpoint = `${this.endpointQuery}/${jobId}/results`;
    const requestConfig: RequestConfig = this.getRequestConfig("application/json", "application/json", endpoint);
    return await requestGetQueryResults(requestConfig, maxRecords, locator);
  }

  /**
   * Fetch every page of query results and concatenate them, following
   * `Sforce-Locator` until it is exhausted. Header rows of follow-up pages are
   * stripped, so the result is one well-formed CSV document.
   *
   * @param jobId Id of a completed query job.
   * @param maxRecords Maximum records per request.
   */
  public async getAllQueryResults(jobId: string, maxRecords?: number): Promise<string> {
    let data: string = "";
    const result = await this.getQueryResults(jobId, maxRecords);
    data = result.data;
    if (BulkAPI.readLocator(result.headers) !== "null") { data += await this.iterateThroughResults(result.headers, jobId, maxRecords); }
    return data;
  }

  /**
   * Poll a query job until it reaches a final state, emitting `monitoring` on
   * the shared `MonitorJob` emitter at every poll.
   *
   * @param jobId Id of the job to watch.
   * @param delay Milliseconds between polls. Defaults to 3000.
   * @returns The final state, for example `"JobComplete"`, `"Failed"` or `"Aborted"`.
   */
  public async waitQueryEnd(jobId: string, delay?: number): Promise<string> {
    if (!delay) { delay = 3000; }
    return await getFinalQueryState(this, jobId, delay);
  }

  /**
   * Wait for a query job to finish, then fetch all of its results.
   *
   * @param jobId Id of the job to watch.
   * @param maxRecordsByRequest Maximum records per request. Defaults to 200.
   * @returns The complete CSV result set.
   * @throws If the job ends in any state other than `JobComplete`.
   */
  public async getQueryFinalResults(jobId: string, maxRecordsByRequest?: number) {
    if (!maxRecordsByRequest) { maxRecordsByRequest = 200; }
    const jobFinalState = await this.waitQueryEnd(jobId, 3000);
    if (jobFinalState === "JobComplete") {
      const result = await this.getAllQueryResults(jobId, maxRecordsByRequest);
      return result;
    } else {
      handleQueryNotComplete(jobFinalState);
    }
  }

  /**
   * Submit a query job, wait for it to finish, and return every result page as
   * one CSV document. The one-line path for exporting data.
   *
   * @param query The SOQL statement and `operation`.
   * @param maxRecordsByRequest Maximum records per request. Defaults to 200.
   * @throws If the job ends in any state other than `JobComplete`.
   *
   * @example
   * ```typescript
   * const csv = await bulkAPI.submitAndGetQueryResults(
   *   { operation: "query", query: "SELECT Id, Name FROM Account" },
   *   10000,
   * );
   * ```
   */
  public async submitAndGetQueryResults(query: QueryInput, maxRecordsByRequest?: number) {
    const queryJob = await this.submitQueryJob(query);
    return await this.getQueryFinalResults(queryJob.id, maxRecordsByRequest);
  }

  /**
   * Create an ingest job. The job is `Open` and accepts data until
   * {@link startJob} is called.
   *
   * @param jobUploadRequest Target `object` and `operation` (`insert`,
   * `update`, `upsert`, `delete` or `hardDelete`). `upsert` also requires
   * `externalIdFieldName`.
   */
  public async createDataUploadJob(jobUploadRequest: JobUploadRequest): Promise<JobUploadResponse> {
    const requestConfig: RequestConfig = this.getRequestConfig("application/json; charset=UTF-8", "application/json", this.endpointIngest);
    return await requestCreateJob(jobUploadRequest, requestConfig);
  }

  /**
   * Upload a CSV file to an open ingest job.
   *
   * @param jobId Id of an open job.
   * @param filename Path to the CSV file to upload.
   * @returns The HTTP status code; `201` means the upload was accepted.
   */
  public async uploadJobData(jobId: string, filename: string): Promise<number> {
    const endpoint = `${this.endpointIngest}/${jobId}/batches`;
    const requestConfig: RequestConfig = this.getRequestConfig("text/csv", "application/json", endpoint);
    return await requestJobUploadData(filename, requestConfig);
  }

  /**
   * Close an ingest job to further uploads and queue it for processing.
   *
   * @param jobId Id of the job to start.
   */
  public async startJob(jobId: string): Promise<JobUploadResponse> {
    const endpoint = `${this.endpointIngest}/${jobId}`;
    const requestConfig: RequestConfig = this.getRequestConfig("application/json", "application/json", endpoint);
    return await requestJobStart(requestConfig);
  }

  /**
   * Create an ingest job, upload a CSV file to it, and start it. Returns as
   * soon as the job is queued — use {@link waitJobEnd} to follow it.
   *
   * @param jobUploadRequest Target `object` and `operation`.
   * @param filename Path to the CSV file to upload.
   * @throws If the upload is not accepted.
   */
  public async createAndStartJob(jobUploadRequest: JobUploadRequest, filename: string) {
    const job = await this.createDataUploadJob(jobUploadRequest);
    const statusUpload = await this.uploadJobData(job.id, filename);
    if (statusUpload === 201) { return await this.startJob(job.id); }
    throw new Error("Upload Failed");
  }

  /**
   * Abort a running ingest job.
   *
   * @param jobId Id of the job to abort.
   */
  public async abortJob(jobId: string): Promise<JobUploadResponse> {
    const endpoint = `${this.endpointIngest}/${jobId}`;
    const requestConfig: RequestConfig = this.getRequestConfig("application/json", "application/json", endpoint);
    return await requestJobAbort(requestConfig);
  }

  /**
   * Fetch the state of an ingest job together with its processing counters
   * (`numberRecordsProcessed`, `numberRecordsFailed`, timings, retries).
   *
   * @param jobId Id of the job to inspect.
   */
  public async getIngestJobInfo(jobId: string): Promise<JobInfoResponse> {
    const endpoint = `${this.endpointIngest}/${jobId}`;
    const requestConfig: RequestConfig = this.getRequestConfig("application/json", "application/json", endpoint);
    return await requestGetJobInfo(requestConfig);
  }

  /**
   * Poll an ingest job until it reaches a final state, emitting `monitoring` on
   * the shared `MonitorJob` emitter at every poll.
   *
   * @param jobId Id of the job to watch.
   * @param delay Milliseconds between polls. Defaults to 3000.
   * @returns The final state, for example `"JobComplete"`, `"Failed"` or `"Aborted"`.
   */
  public async waitJobEnd(jobId: string, delay?: number): Promise<string> {
    if (!delay) { delay = 3000; }
    return await getFinalJobState(this, jobId, delay);
  }

  /**
   * Create an ingest job, upload a CSV file, start it, and wait for it to
   * finish. The one-line path for importing data.
   *
   * @param jobUploadRequest Target `object` and `operation`.
   * @param filename Path to the CSV file to upload.
   * @returns The finished job, including its processing counters.
   * @throws If the job ends in any state other than `JobComplete`.
   *
   * @example
   * ```typescript
   * const jobInfo = await bulkAPI.createAndWaitJobResult(
   *   { object: "Account", operation: "insert" },
   *   "./accounts.csv",
   * );
   * ```
   */
  public async createAndWaitJobResult(jobUploadRequest: JobUploadRequest, filename: string) {
    const job = await this.createAndStartJob(jobUploadRequest, filename);
    const finalJobState = await this.waitJobEnd(job.id);
    if (finalJobState === "JobComplete") { return await this.getIngestJobInfo(job.id); }
    throw new Error(`The Job ${job.id} didn't complete`);
  }

  /**
   * Fetch the records an ingest job processed successfully, as CSV.
   *
   * @param jobId Id of a completed ingest job.
   */
  public async getJobSuccesfulResults(jobId: string): Promise<string> {
    return await this.getJobResults(jobId, "successfulResults");
  }

  /**
   * Fetch the records an ingest job failed to process, as CSV. Each row
   * carries the error Salesforce reported for it.
   *
   * @param jobId Id of a completed ingest job.
   */
  public async getJobFailedResults(jobId: string): Promise<string> {
    return await this.getJobResults(jobId, "failedResults");
  }

  /**
   * Fetch the records an ingest job never processed, as CSV — typically
   * because the job was aborted or failed partway through.
   *
   * @param jobId Id of a completed ingest job.
   */
  public async getJobUnprocessedResults(jobId: string): Promise<string> {
    return await this.getJobResults(jobId, "unprocessedrecords");
  }

  private getRequestConfig(contentType: string, accept: string, endpoint: string): RequestConfig {
    const headers = createAxiosHeader(contentType, accept, this.connection.accessToken);
    const requestConfig = { headers, endpoint };
    return requestConfig;
  }

  private static readLocator(headers: AxiosResponse["headers"]): string | undefined {
    const locator: unknown = headers["sforce-locator"];
    return typeof locator === "string" ? locator : undefined;
  }

  private async iterateThroughResults(headers: AxiosResponse["headers"], jobId: string, maxRecords?: number): Promise<string> {
    let restData = "";
    let locator = BulkAPI.readLocator(headers);
    while (locator !== "null") {
      const followingResult = await this.getQueryResults(jobId, maxRecords, locator);
      restData += followingResult.data.split("\n").slice(1).join("\n");
      locator = BulkAPI.readLocator(followingResult.headers);
    }
    return restData;
  }

  private async getJobResults(jobId: string, resultType: string) {
    const endpoint = `${this.endpointIngest}/${jobId}/${resultType}`;
    const requestConfig: RequestConfig = this.getRequestConfig("application/json", "text/csv", endpoint);
    return await requestGetJobResults(requestConfig);
  }
}
