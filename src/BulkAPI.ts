import { AxiosResponse, AxiosResponseHeaders } from "axios";
import { requestJobAbort, requestCreateJob, requestJobStart, requestJobUploadData, requestGetJobInfo, requestGetJobResults } from "./ingest/ingest";
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

export default class BulkAPI {

  private connection: Parameters;
  private endpoint: string;
  private endpointQuery: string;
  private endpointIngest: string;

  constructor(connection: Parameters) {
    this.connection = connection;
    this.endpoint = connection.instanceUrl + '/services/data/v' + connection.apiVersion;
    if (this.connection.isTooling) this.endpoint += '/tooling';
    this.endpoint += '/jobs';
    this.endpointQuery = this.endpoint + '/query';
    this.endpointIngest = this.endpoint + '/ingest';
  }

  private getRequestConfig(contentType: string, accept: string, endpoint: string): RequestConfig {
    const headers = createAxiosHeader(contentType, accept, this.connection.accessToken);
    const requestConfig = { headers, endpoint }
    return requestConfig;
  }

  private async iterateThroughResults(headers: AxiosResponseHeaders, jobId: string, maxRecords?: number): Promise<string> {
    let restData = '';
    let locator = headers['sforce-locator'];
    while (locator !== 'null') {
      const followingResult = await this.getQueryResults(jobId, maxRecords, locator);
      restData += followingResult.data.split("\n").slice(1).join("\n");
      locator = followingResult.headers['sforce-locator'];
    }
    return restData;
  }

  public async submitQueryJob(query: QueryInput): Promise<QueryResponse> {
    const requestConfig: RequestConfig = this.getRequestConfig('application/json', 'application/json', this.endpointQuery);
    return await requestSubmitQueryJob(query, requestConfig);
  }

  public async getQueryJob(jobId: string): Promise<QueryResponse> {
    const endpoint = `${this.endpointQuery}/${jobId}`
    const requestConfig: RequestConfig = this.getRequestConfig('application/json', 'application/json', endpoint);
    return await requestGetQueryJobInfo(requestConfig);
  }

  public async getAllQueryJobInfo(configInput?: QueryConfig): Promise<AllQueryJobsInfoResponse> {
    const requestConfig: RequestConfig = this.getRequestConfig('application/json', 'application/json', this.endpointQuery);
    return await requestGetAllQueryJobInfo(requestConfig, configInput);
  }

  public async abortQueryJob(jobId: string): Promise<QueryResponse> {
    const endpoint = `${this.endpointQuery}/${jobId}`
    const requestConfig: RequestConfig = this.getRequestConfig('application/json', 'application/json', endpoint);
    return await requestAbortQueryJob(requestConfig);
  }

  public async getQueryResults(jobId: string, maxRecords?: number, locator?: string): Promise<AxiosResponse> {
    const endpoint = `${this.endpointQuery}/${jobId}/results`;
    const requestConfig: RequestConfig = this.getRequestConfig('application/json', 'application/json', endpoint);
    return await requestGetQueryResults(requestConfig, maxRecords, locator);
  }

  public async getAllQueryResults(jobId: string, maxRecords?: number): Promise<string> {
    let data: string = '';
    const result = await this.getQueryResults(jobId, maxRecords);
    data = result.data;
    if (result.headers['sforce-locator'] !== 'null') data += await this.iterateThroughResults(result.headers, jobId, maxRecords);
    return data;
  }

  public async waitQueryEnd(jobId: string, delay?: number): Promise<string> {
    if(!delay) delay = 3000;
    return await getFinalQueryState(this, jobId, delay);
  }

  public async getQueryFinalResults(jobId: string, maxRecordsByRequest?: number) {
    if(!maxRecordsByRequest) maxRecordsByRequest = 200;
    const jobFinalState = await this.waitQueryEnd(jobId, 3000);
    if (jobFinalState === 'JobComplete') {
      const result = await this.getAllQueryResults(jobId, maxRecordsByRequest);
      return result;
    } else {
      handleQueryNotComplete(jobFinalState);
    }
  }

  public async submitAndGetQueryResults(query: QueryInput, maxRecordsByRequest?: number) {
    const queryJob = await this.submitQueryJob(query);
    return await this.getQueryFinalResults(queryJob.id, maxRecordsByRequest);
  }

  public async createDataUploadJob(jobUploadRequest: JobUploadRequest): Promise<JobUploadResponse> {
    const requestConfig: RequestConfig = this.getRequestConfig('application/json; charset=UTF-8', 'application/json', this.endpointIngest);
    return await requestCreateJob(jobUploadRequest, requestConfig);
  }

  public async uploadJobData(jobId: string, filename: string): Promise<number> {
    const endpoint = `${this.endpointIngest}/${jobId}/batches`;
    const requestConfig: RequestConfig = this.getRequestConfig('text/csv', 'application/json', endpoint);
    return await requestJobUploadData(filename, requestConfig);
  }

  public async startJob(jobId: string): Promise<JobUploadResponse> {
    const endpoint = `${this.endpointIngest}/${jobId}`
    const requestConfig: RequestConfig = this.getRequestConfig('application/json', 'application/json', endpoint);
    return await requestJobStart(requestConfig);
  }

  public async createAndStartJob(jobUploadRequest: JobUploadRequest, filename: string) {
    const job = await this.createDataUploadJob(jobUploadRequest);
    const statusUpload = await this.uploadJobData(job.id, filename);
    if(statusUpload === 201) return await this.startJob(job.id);
    throw new Error('Upload Failed');
  }

  public async abortJob(jobId: string): Promise<JobUploadResponse> {
    const endpoint = `${this.endpointIngest}/${jobId}`;
    const requestConfig: RequestConfig = this.getRequestConfig('application/json', 'application/json', endpoint);
    return await requestJobAbort(requestConfig);
  }

  public async getIngestJobInfo(jobId: string): Promise<JobInfoResponse> {
    const endpoint = `${this.endpointIngest}/${jobId}`;
    const requestConfig: RequestConfig = this.getRequestConfig('application/json', 'application/json', endpoint);
    return await requestGetJobInfo(requestConfig);
  }

  private async getJobResults(jobId: string, resultType: string) {
    const endpoint = `${this.endpointIngest}/${jobId}/${resultType}`;
    const requestConfig: RequestConfig = this.getRequestConfig('application/json', 'text/csv', endpoint);
    return await requestGetJobResults(requestConfig);
  }

  public async waitJobEnd(jobId: string, delay?: number): Promise<string> {
    if (!delay) delay = 3000;
    return await getFinalJobState(this, jobId, delay);
  }

  public async createAndWaitJobResult(jobUploadRequest: JobUploadRequest, filename: string) {
    const job = await this.createAndStartJob(jobUploadRequest, filename);
    const finalJobState = await this.waitJobEnd(job.id);
    if (finalJobState === 'JobComplete') return await this.getIngestJobInfo(job.id);
    throw new Error(`The Job ${job.id} didn't complete`);
  }

  public async getJobSuccesfulResults(jobId: string): Promise<string> {
    return await this.getJobResults(jobId, 'successfulResults');
  }

  public async getJobFailedResults(jobId: string): Promise<string> {
    return await this.getJobResults(jobId, 'failedResults');
  }

  public async getJobUnprocessedResults(jobId: string): Promise<string> {
    return await this.getJobResults(jobId, 'unprocessedrecords');
  }
}