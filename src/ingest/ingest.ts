import axios, { AxiosResponse } from "axios";
import { JobInfoResponse } from "../interfaces/JobInfoResponse";
import { JobUploadRequest } from "../interfaces/JobUploadRequest";
import { JobUploadResponse } from "../interfaces/JobUploadResponse";
import { RequestConfig } from "../interfaces/RequestConfig";

export async function requestCreateJob(jobUploadRequest: JobUploadRequest, requestConfig: RequestConfig) {
  const axiosresponse: AxiosResponse = await axios.post(requestConfig.endpoint, JSON.stringify(jobUploadRequest), requestConfig.headers);
  const jobuploadresponse: JobUploadResponse = axiosresponse.data;
  return jobuploadresponse;
}

export async function requestJobUploadData(data: string, requestConfig: RequestConfig) {
  const axiosresponse: AxiosResponse = await axios.put(requestConfig.endpoint, data, requestConfig.headers);
  return axiosresponse.status;
}

async function modifyStateJob(state: string, requestConfig: RequestConfig) {
  const body = JSON.stringify({ state });
  const axiosresponse: AxiosResponse = await axios.patch(requestConfig.endpoint, body, requestConfig.headers);
  const jobuploadresponse: JobUploadResponse = axiosresponse.data;
  return jobuploadresponse;
}

export async function requestJobStart(requestConfig: RequestConfig) {
  return await modifyStateJob('UploadComplete', requestConfig);
}

export async function requestJobAbort(requestConfig: RequestConfig) {
  return await modifyStateJob('Aborted', requestConfig);
}

export async function requestGetJobInfo(requestConfig: RequestConfig) {
  const axiosresponse: AxiosResponse = await axios.get(requestConfig.endpoint, requestConfig.headers);
  const queryResponse = axiosresponse.data as JobInfoResponse;
  return queryResponse;
}

export async function requestGetJobResults(requestConfig: RequestConfig): Promise <string> {
  const axiosresponse: AxiosResponse = await axios.get(requestConfig.endpoint, requestConfig.headers);
  return axiosresponse.data;
}