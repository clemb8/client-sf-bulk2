import { QueryResponse } from "./QueryResponse";

export interface AllQueryJobsInfoResponse {
  done: boolean,
  records: QueryResponse[],
  nextRecordsUrl: string
}