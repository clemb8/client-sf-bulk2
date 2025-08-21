import { QueryResponse } from "./QueryResponse";

export interface JobUploadResponse extends QueryResponse {
  assignmentRuleId: string;
  contentUrl: string;
  externalIdFieldName: string;
  jobType: string;
}
