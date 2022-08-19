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
    const response = await bulkAPI.createAndWaitJobResult(jobRequest, './account.csv');
    console.log(response);
  } catch (ex: any) {
    console.log(ex);
  }
}

importData();