import { QueryResponse } from "./QueryResponse";

export interface QueryInfoResponse extends QueryResponse {
  numberRecordsProcessed: number,
  retries: number,
  totalProcessingTime: number
}