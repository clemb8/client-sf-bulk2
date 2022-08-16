import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { AllQueryJobsInfoResponse } from "../interfaces/AllQueryJobsInfoResponse";
import { QueryConfig } from "../interfaces/QueryConfig";
import { QueryInfoResponse } from "../interfaces/QueryInfoResponse";
import { QueryInput } from "../interfaces/QueryInput";
import { QueryResponse } from "../interfaces/QueryResponse";
import { RequestConfig } from "../interfaces/RequestConfig";
import { includeParametersQueryJobsInfos, includeParametersQueryResults } from "./utils";

export async function requestSubmitBulkQueryJob(query: QueryInput, requestConfig: RequestConfig): Promise <QueryResponse> {
  const body = JSON.stringify(query);
  const axiosresponse: AxiosResponse = await axios.post(requestConfig.endpoint, body, requestConfig.headers);
  const queryResponse = axiosresponse.data as QueryResponse;
  return queryResponse;
}

export async function requestGetBulkQueryJobInfo(requestConfig: RequestConfig): Promise < QueryInfoResponse > {
  const axiosresponse: AxiosResponse = await axios.get(requestConfig.endpoint, requestConfig.headers);
  const queryResponse = axiosresponse.data as QueryInfoResponse;
  return queryResponse;
}

export async function requestGetAllBulkQueryJobInfo(requestConfig: RequestConfig, configInput?: QueryConfig): Promise < AllQueryJobsInfoResponse > {
  if (configInput && Object.keys(configInput).length > 0) requestConfig.endpoint = includeParametersQueryJobsInfos(configInput, requestConfig.endpoint);
  const axiosresponse: AxiosResponse = await axios.get(requestConfig.endpoint, requestConfig.headers);
  const queryResponse = axiosresponse.data as AllQueryJobsInfoResponse;
  return queryResponse;
}

export async function requestAbortBulkQueryJob(requestConfig: RequestConfig): Promise <QueryResponse> {
  const body = JSON.stringify({ state: 'Aborted' });
  const axiosresponse: AxiosResponse = await axios.patch(requestConfig.endpoint, body, requestConfig.headers);
  const queryResponse = axiosresponse.data as QueryResponse;
  return queryResponse;
}

export async function requestGetBulkQueryResults(requestConfig: RequestConfig, locator?: string, maxRecords?: number): Promise < AxiosResponse > {
  if(locator || maxRecords) requestConfig.endpoint = includeParametersQueryResults(requestConfig.endpoint, locator, maxRecords);
  const axiosresponse: AxiosResponse = await axios.get(requestConfig.endpoint, requestConfig.headers);
  return axiosresponse;
}