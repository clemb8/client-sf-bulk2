import { AxiosRequestConfig } from "axios";
import BulkAPI from "./BulkAPI";

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

export function getFinalQueryState(client: BulkAPI, jobId: string, delay: number): Promise<string> {
  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      const result = await client.getQueryJob(jobId);
      if (result.state !== 'UploadComplete' && result.state !== 'InProgress') {
        clearInterval(interval);
        resolve(result.state);
      }
    }, delay);
  })
}