import jsforce from 'jsforce';
import { BulkAPI, Parameters, JobUploadRequest } from 'client-sf-bulk2';

async function importData() {
  const conn = new jsforce.Connection({});
  await conn.login(process.env.USERNAME!, process.env.PASSWORD!);
  const bulkParameters: Parameters = {
    accessToken: conn.accessToken,
    apiVersion: '55.0',
    instanceUrl: conn.instanceUrl
  };
  try {
    const bulkAPI = new BulkAPI(bulkParameters);
    const jobRequest: JobUploadRequest = {
      'object': 'Account',
      'operation': 'insert'
    };
    const response = await bulkAPI.createAndWaitJobResult(jobRequest, './accounts.csv');
    console.log(response);
  } catch (ex) {
    // Do not log the raw axios error: it carries config.headers.Authorization,
    // which is your live Salesforce access token.
    console.log(ex instanceof Error ? ex.message : ex);
  }
}

importData();