import axios, { AxiosResponse } from "axios";
import { AllQueryJobsInfoResponse } from "../interfaces/AllQueryJobsInfoResponse";
import { QueryConfig } from "../interfaces/QueryConfig";
import { QueryInfoResponse } from "../interfaces/QueryInfoResponse";
import { QueryInput } from "../interfaces/QueryInput";
import { QueryResponse } from "../interfaces/QueryResponse";
import { RequestConfig } from "../interfaces/RequestConfig";
import { includeParametersQueryJobsInfos, includeParametersQueryResults } from "./utils";

export async function requestSubmitQueryJob(query: QueryInput, requestConfig: RequestConfig): Promise <QueryResponse> {
  const body = JSON.stringify(query);
  const axiosresponse: AxiosResponse<QueryResponse> = await axios.post(requestConfig.endpoint, body, requestConfig.headers);
  const queryResponse = axiosresponse.data;
  return queryResponse;
}

export async function requestGetQueryJobInfo(requestConfig: RequestConfig): Promise < QueryInfoResponse > {
  const axiosresponse: AxiosResponse<QueryInfoResponse> = await axios.get(requestConfig.endpoint, requestConfig.headers);
  const queryResponse = axiosresponse.data;
  return queryResponse;
}

export async function requestGetAllQueryJobInfo(requestConfig: RequestConfig, configInput?: QueryConfig): Promise < AllQueryJobsInfoResponse > {
  const endpoint = (configInput && Object.keys(configInput).length > 0) ? includeParametersQueryJobsInfos(configInput, requestConfig.endpoint) : requestConfig.endpoint;
  const axiosresponse: AxiosResponse<AllQueryJobsInfoResponse> = await axios.get(endpoint, requestConfig.headers);
  const queryResponse = axiosresponse.data;
  return queryResponse;
}

export async function requestAbortQueryJob(requestConfig: RequestConfig): Promise <QueryResponse> {
  const body = JSON.stringify({ state: "Aborted" });
  const axiosresponse: AxiosResponse<QueryResponse> = await axios.patch(requestConfig.endpoint, body, requestConfig.headers);
  const queryResponse = axiosresponse.data;
  return queryResponse;
}

export async function requestGetQueryResults(requestConfig: RequestConfig, maxRecords?: number, locator?: string): Promise < AxiosResponse<string> > {
  const endpoint = (locator || maxRecords) ? includeParametersQueryResults(requestConfig.endpoint, maxRecords, locator) : requestConfig.endpoint;
  const axiosresponse: AxiosResponse<string> = await axios.get(endpoint, requestConfig.headers);
  return axiosresponse;
}
