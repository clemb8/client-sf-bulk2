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
Or use the one line implementation :

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
## Project Status

Project is: _in progress_.


## Acknowledgements

- This project was inspired by https://github.com/msrivastav13/node-sf-bulk2#node-sf-bulk2 ;
