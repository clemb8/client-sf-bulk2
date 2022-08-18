import jsforce from 'jsforce';
import { BulkAPI, Parameters, QueryInput } from 'client-sf-bulk2';

async function submitBulkQueryJob() {
  const conn = new jsforce.Connection({});
  await conn.login(process.env.USERNAME!, process.env.PASSWORD!);
  const bulkParameters: Parameters = {
    accessToken: conn.accessToken,
    apiVersion: '55.0',
    instanceUrl: conn.instanceUrl
  };
  try {
    const bulkAPI = new BulkAPI(bulkParameters);
    const queryInput: QueryInput = {
      query: 'Select Id, Name from Account',
      operation: 'query'
    };
    const response = await bulkAPI.submitQueryJob(queryInput);
    console.log(response);

    const jobFinalState = bulkAPI.waitQueryEnd(response.id);
    console.log(jobFinalState);

    //then you can get the results
    const results = bulkAPI.getQueryResults(response.id);

    //In Case of a big query you may want to retrieve by chunk (here by chunk of 200 records)
    const prudentResumts = bulkAPI.getAllQueryResults(response.id, 200);
  } catch (ex: any) {
    console.log(ex);
  }
}

submitBulkQueryJob();