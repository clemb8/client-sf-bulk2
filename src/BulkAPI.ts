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
import { requestAbortBulkQueryJob, requestGetAllBulkQueryJobInfo, requestGetBulkQueryJobInfo, requestGetBulkQueryResults, requestSubmitBulkQueryJob } from "./query/query";
import { handleQueryNotComplete } from "./query/utils";
import { createAxiosHeader } from "./utils";

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

  private async iterateThroughResults(headers: AxiosResponseHeaders, jobId: string): Promise<string> {
    let restData = '';
    let locator = headers['sforce-locator'];
    while (locator) {
      const followingResult = await this.getBulkQueryResults(jobId, locator);
      restData += followingResult.data;
      locator = followingResult.headers['sforce-locator'];
    }
    return restData;
  }

  private async getAllQueryResults(jobId: string): Promise<string> {
    let data: string = '';
    const result = await this.getBulkQueryResults(jobId);
    data = result.data;
    if(result.headers['sforce-locator'] !== 'null') data += await this.iterateThroughResults(result.headers, jobId);
    return data;
  }

  public async submitBulkQueryJob(query: QueryInput): Promise<QueryResponse> {
    const requestConfig: RequestConfig = this.getRequestConfig('application/json', 'application/json', this.endpointQuery);
    return await requestSubmitBulkQueryJob(query, requestConfig);
  }

  public async getBulkQueryJob(jobId: string): Promise<QueryResponse> {
    const endpoint = `${this.endpointQuery}/${jobId}`
    const requestConfig: RequestConfig = this.getRequestConfig('application/json', 'application/json', endpoint);
    return await requestGetBulkQueryJobInfo(requestConfig);
  }

  public async getAllBulkQueryJobInfo(configInput?: QueryConfig): Promise<AllQueryJobsInfoResponse> {
    const requestConfig: RequestConfig = this.getRequestConfig('application/json', 'application/json', this.endpointQuery);
    return await requestGetAllBulkQueryJobInfo(requestConfig, configInput);
  }

  public async abortBulkQueryJob(jobId: string): Promise<QueryResponse> {
    const endpoint = `${this.endpointQuery}/${jobId}`
    const requestConfig: RequestConfig = this.getRequestConfig('application/json', 'application/json', endpoint);
    return await requestAbortBulkQueryJob(requestConfig);
  }

  public async getBulkQueryResults(jobId: string, locator?: string, maxRecords?: number): Promise<AxiosResponse> {
    const endpoint = `${this.endpointQuery}/${jobId}/results`;
    const requestConfig: RequestConfig = this.getRequestConfig('application/json', 'application/json', endpoint);
    return await requestGetBulkQueryResults(requestConfig, locator, maxRecords);
  }

  public async waitBulkQueryEnd(jobId: string, delay?: number): Promise<string> {
    if(!delay) delay = 3000;
    return new Promise((resolve) => {
      const interval = setInterval(async () => {
        const result = await this.getBulkQueryJob(jobId);
        if (result.state !== 'UploadComplete' && result.state !== 'InProgress') {
          clearInterval(interval);
          resolve(result.state);
        }
      }, delay);
    })
  }

  public async getBulkQueryFinalResults(jobId: string, delay?: number) {
    const jobFinalState = await this.waitBulkQueryEnd(jobId, delay);
    if (jobFinalState === 'JobComplete') {
      const result = await this.getAllQueryResults(jobId);
      return result;
    } else {
      handleQueryNotComplete(jobFinalState);
    }
  }

  public async createDataUploadJob(jobUploadRequest: JobUploadRequest): Promise<JobUploadResponse> {
    const requestConfig: RequestConfig = this.getRequestConfig('application/json; charset=UTF-8', 'application/json', this.endpointIngest);
    return await requestCreateJob(jobUploadRequest, requestConfig);
  }

  public async uploadJobData(contenturl: string, data: string): Promise<number> {
    const endpoint = this.connection.instanceUrl + '/' + contenturl;
    const requestConfig: RequestConfig = this.getRequestConfig('text/csv', 'application/json', endpoint);
    return await requestJobUploadData(data, requestConfig);
  }

  public async startJob(jobId: string): Promise<JobUploadResponse> {
    const endpoint = `${this.endpointIngest}/${jobId}`
    const requestConfig: RequestConfig = this.getRequestConfig('application/json', 'application/json', endpoint);
    return await requestJobStart(requestConfig);
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