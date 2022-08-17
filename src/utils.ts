import { AxiosRequestConfig, AxiosResponseHeaders } from "axios";

export function createAxiosHeader(contentType: string, connection: string, accept: string) {
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

export async function iterateThroughResults(headers: AxiosResponseHeaders, getMoreResult: any, jobId: string): Promise<string> {
  let restData = '';
  let locator = headers['sforce-locator'];
  while (locator) {
    const followingResult = await getMoreResult(jobId, locator);
    restData += followingResult.data;
    locator = followingResult.headers['sforce-locator'];
  }
  return restData;
}