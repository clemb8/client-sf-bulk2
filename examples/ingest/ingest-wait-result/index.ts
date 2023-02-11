import { SF_PassConnect, PassParameters } from 'client-sf-oauth';
import { BulkAPI, Parameters, JobUploadRequest, MonitorJob } from 'client-sf-bulk2';

async function importData() {

  const PassParameters: PassParameters = {
    clientId: process.env.clientId!,
    clientSecret: process.env.secret!,
    username: process.env.username!,
    password: process.env.password!,
    usertoken: process.env.usertoken!,
    host: process.env.host!
  };

  const connection = new SF_PassConnect(PassParameters);

  try {
    const result = await connection.requestAccessToken();

    const bulkParameters: Parameters = {
      accessToken: result.data.access_token,
      apiVersion: '55.0',
      instanceUrl: result.data.instance_url
    };

    const bulkAPI = new BulkAPI(bulkParameters);
    const jobRequest: JobUploadRequest = {
      'object': 'Account',
      'operation': 'insert'
    };
    const response = await bulkAPI.createAndStartJob(jobRequest, './accounts.csv');
    console.log(response);

    // Use the MonitorJob Event Emitter to get the status of the job
    MonitorJob.on('monitoring', (state: any) => {
      //Do something with the job state
      console.log(state);
    });

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