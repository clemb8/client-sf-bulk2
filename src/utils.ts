import { AxiosRequestConfig } from "axios";
import BulkAPI from "./BulkAPI";
import { JobInfoResponse } from "./interfaces/JobInfoResponse";
import { QueryResponse } from "./interfaces/QueryResponse";

export function createAxiosHeader(contentType: string, accept: string, connection: string) {
  const headers = {
    'Content-Type': contentType,
    Authorization: 'Bearer ' + connection,
    accept
  };
  const axiosRequestConfig: AxiosRequestConfig = {
    headers,
    maxBodyLength: Infinity,
    maxContentLength: Infinity
  }

  return axiosRequestConfig;
}

export async function getFinalQueryState(client: BulkAPI, jobId: string, delay: number): Promise<string> {
  return await getFinalBulkState(client, jobId, delay, 'query');
}

export async function getFinalJobState(client: BulkAPI, jobId: string, delay: number): Promise<string> {
  return await getFinalBulkState(client, jobId, delay, 'ingest');
}

async function getFinalBulkState(client: BulkAPI, jobId: string, delay: number, type: string): Promise<string> {
  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      let result : QueryResponse | JobInfoResponse;
      type === 'query' ? result = await client.getQueryJob(jobId) : result = await client.getIngestJobInfo(jobId);
      if (result.state !== 'UploadComplete' && result.state !== 'InProgress') {
        clearInterval(interval);
        resolve(result.state);
      }
    }, delay);
  })
}