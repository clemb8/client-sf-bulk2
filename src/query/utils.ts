import { QueryConfig } from "../interfaces/QueryConfig";

export function includeParametersQueryJobsInfos(configInput: QueryConfig, endpoint: string) {
  endpoint += '/?';
  let i = 0;
  let key: keyof QueryConfig;
  for (key in configInput) {
    if (configInput.hasOwnProperty(key)) {
      endpoint += key + '=' + configInput[key];
      if (i < (Object.keys(configInput).length - 1)) endpoint += '&';
      i++;
    }
  }

  return endpoint;
}

export function includeParametersQueryResults(endpoint: string, locator: string | undefined, maxRecords: number | undefined) {
  endpoint += '?';

  if (locator) {
    endpoint += 'locator=' + locator;
    if (maxRecords) endpoint += '&';
  }

  if (maxRecords) endpoint += 'maxRecords=' + maxRecords;

  return endpoint;
}

export function handleQueryNotComplete(jobFinalState: string) {
  if(jobFinalState === 'Aborted') {
    throw 'The query has been aborted';
  } else if (jobFinalState === 'Failed') {
    throw 'The query failed';
  } else {
    throw 'Something went wrong while getting query information';
  }
}