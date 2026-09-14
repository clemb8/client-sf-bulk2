import jsforce from 'jsforce';
import { BulkAPI, Parameters, QueryInput } from 'client-sf-bulk2';

async function submitBulkQueryJob() {
  const conn = new jsforce.Connection({});
  await conn.login(process.env.USERNAME!, process.env.PASSWORD!);
  const bulkParameters: Parameters = {
    accessToken: conn.accessToken!,
    apiVersion: '55.0',
    instanceUrl: conn.instanceUrl
  };
  try {
    const bulkAPI = new BulkAPI(bulkParameters);
    const queryInput: QueryInput = {
      query: 'Select Id, Name from Account',
      operation: 'query'
    };
    const response = await bulkAPI.submitAndGetQueryResults(queryInput, 10);
    console.log(response);
  } catch (ex) {
    // Do not log the raw axios error: it carries config.headers.Authorization,
    // which is your live Salesforce access token.
    console.log(ex instanceof Error ? ex.message : ex);
  }
}

submitBulkQueryJob();