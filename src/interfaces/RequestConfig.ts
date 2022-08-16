import { AxiosRequestConfig } from "axios";

export interface RequestConfig {
  headers: AxiosRequestConfig,
  endpoint: string
}