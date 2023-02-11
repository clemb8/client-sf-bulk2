# client-sf-bulk2

This is a sample client for the Salesforce Bulk API with some abstraction facilitating short implementations. It can be used in JS/TS scripts or in Node Project.

## Table of Contents

- [General Info](#general-information)
- [Technologies Used](#technologies-used)
- [Features](#features)
- [Usage](#usage)
- [Project Status](#project-status)
- [Acknowledgements](#acknowledgements)

## General Information

This project aims to provide :
- An easy to use client to query and import data via the Salesforce Bulk API ;
- Some abstractions on top of the Salesforce Bulk API (ex: query in one line) ;

## Technologies Used

- Node JS - 17.1

## Features

List the ready features here:

- Easily query your Salesforce organization for data with the Salesforce Bulk API ;
- Easily import data in your Salesforce organization with the Salesforce Bulk API ;

## Usage

Check the Salesforce documentation [here](https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/bulk_api_2_0.htm).
Or use the one line implementation for query data :

```typescript
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

    const response = await bulkAPI.submitAndGetQueryResults(queryInput, 10);
    console.log(response);
  } catch (ex: any) {
    console.log(ex);
  }
}

submitBulkQueryJob();

```

For import data :

```typescript
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


```

You can import nd use the MonitorJob Event Emitter to monitor the current job :

``` typescript

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

```
## Project Status

Project is: _in progress_.


## Acknowledgements

- This project was inspired by https://github.com/msrivastav13/node-sf-bulk2#node-sf-bulk2 ;
