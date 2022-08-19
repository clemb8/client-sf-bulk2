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
    const response = await bulkAPI.createAndStartJob(jobRequest, './accounts.csv');
    console.log(response);

    const finalStateJob = await bulkAPI.waitJobEnd(response.id);

    if(finalStateJob === 'JobComplete') {
      const successfulRecords = await bulkAPI.getJobSuccesfulResults(response.id);
      const failedRecords = await bulkAPI.getJobFailedResults(response.id);
      console.log(successfulRecords);
      console.log(failedRecords);
    }
  } catch (ex: any) {
    console.log(ex);
  }
}

importData();