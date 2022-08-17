import { AxiosRequestConfig } from "axios";

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