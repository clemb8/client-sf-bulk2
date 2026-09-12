# client-sf-bulk2

**Typed Salesforce Bulk API 2.0 client for Node.js.** Run a SOQL query or a CSV
ingest job in one line, and follow long-running jobs with an event emitter —
without hand-rolling the create / upload / start / poll / paginate dance.

[![npm version](https://img.shields.io/npm/v/client-sf-bulk2.svg)](https://www.npmjs.com/package/client-sf-bulk2)
[![downloads](https://img.shields.io/npm/dm/client-sf-bulk2.svg)](https://www.npmjs.com/package/client-sf-bulk2)
[![types](https://img.shields.io/npm/types/client-sf-bulk2.svg)](https://www.npmjs.com/package/client-sf-bulk2)
[![license](https://img.shields.io/npm/l/client-sf-bulk2.svg)](./License.txt)

## Install

```bash
npm install client-sf-bulk2
```

TypeScript declarations are bundled — no `@types/` package needed.

## Quick start

Export a full Salesforce object to CSV in one call:

```typescript
import { BulkAPI, Parameters, QueryInput } from 'client-sf-bulk2';

const parameters: Parameters = {
  accessToken: '<your access token>',
  apiVersion: '55.0',
  instanceUrl: 'https://your-org.my.salesforce.com',
};

const bulkAPI = new BulkAPI(parameters);

const queryInput: QueryInput = {
  operation: 'query',
  query: 'SELECT Id, Name FROM Account',
};

// Submits the job, waits for it to finish, follows every locator page,
// and returns the whole result set as CSV.
const csv = await bulkAPI.submitAndGetQueryResults(queryInput, 10000);
```

And insert a CSV file in one call:

```typescript
import { BulkAPI, JobUploadRequest } from 'client-sf-bulk2';

const jobRequest: JobUploadRequest = { object: 'Account', operation: 'insert' };

// Creates the job, uploads the file, starts it, waits for completion.
const jobInfo = await bulkAPI.createAndWaitJobResult(jobRequest, './accounts.csv');
console.log(jobInfo.numberRecordsProcessed, jobInfo.numberRecordsFailed);
```

## Why this library

Salesforce's Bulk API 2.0 is a multi-step protocol: create a job, upload the
data, start it, poll until it leaves `InProgress`, then walk `Sforce-Locator`
pages to collect results. Doing that by hand is where most of the code goes.

- **One-line happy paths.** `submitAndGetQueryResults` and
  `createAndWaitJobResult` collapse the whole sequence into a single `await`.
- **Pagination handled.** `getAllQueryResults` follows `Sforce-Locator` until
  exhausted and stitches the CSV, stripping repeated headers.
- **Job monitoring built in.** Subscribe to `MonitorJob` for state on every
  poll instead of writing your own loop.
- **Typed end to end.** Every request and response shape is an exported
  interface; `strict` TypeScript throughout.
- **Small surface.** One runtime dependency (`axios`).

It is not an ORM and it does not do authentication — bring your own token (see
below). If you need the full Salesforce API surface, use `jsforce`; if you need
Bulk 2.0 specifically and want it terse, use this.

## Authenticating

This library takes an access token; it does not obtain one. Any Salesforce auth
flow works. Two common options:

```typescript
// With jsforce
import jsforce from 'jsforce';

const conn = new jsforce.Connection({});
await conn.login(process.env.SF_USERNAME!, process.env.SF_PASSWORD!);

const bulkAPI = new BulkAPI({
  accessToken: conn.accessToken,
  apiVersion: '55.0',
  instanceUrl: conn.instanceUrl,
});
```

```typescript
// With client-sf-oauth (username-password flow)
import { SF_PassConnect } from 'client-sf-oauth';

const connection = new SF_PassConnect({
  clientId: process.env.SF_CLIENT_ID!,
  clientSecret: process.env.SF_CLIENT_SECRET!,
  username: process.env.SF_USERNAME!,
  password: process.env.SF_PASSWORD!,
  usertoken: process.env.SF_USER_TOKEN!,
  host: process.env.SF_HOST!,
});

const result = await connection.requestAccessToken();

const bulkAPI = new BulkAPI({
  accessToken: result.data.access_token,
  apiVersion: '55.0',
  instanceUrl: result.data.instance_url,
});
```

Set `isTooling: true` in `Parameters` to target the Tooling API instead.

## Error handling

Errors are not caught for you — axios rejections propagate unchanged, so you
wrap calls yourself.

> **Never log a raw axios error.** It carries
> `error.config.headers.Authorization`, which is your live Salesforce access
> token. Log `error.message`, or redact before logging.

```typescript
try {
  const csv = await bulkAPI.submitAndGetQueryResults(queryInput);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
}
```

## Monitoring a long-running job

`MonitorJob` is a module-level `EventEmitter` shared by every `BulkAPI`
instance in the process. It emits `monitoring` on each poll while
`waitJobEnd` or `waitQueryEnd` is running.

```typescript
import { BulkAPI, MonitorJob, JobUploadRequest } from 'client-sf-bulk2';

MonitorJob.on('monitoring', (state) => console.log('job state:', state));

const jobRequest: JobUploadRequest = { object: 'Account', operation: 'insert' };
const job = await bulkAPI.createAndStartJob(jobRequest, './accounts.csv');

if (await bulkAPI.waitJobEnd(job.id) === 'JobComplete') {
  const succeeded = await bulkAPI.getJobSuccesfulResults(job.id);
  const failed = await bulkAPI.getJobFailedResults(job.id);
}
```

## API reference

Construct with `new BulkAPI(parameters: Parameters)`.

### Query jobs

| Method | Returns | Description |
| --- | --- | --- |
| `submitQueryJob(query)` | `QueryResponse` | Submit a SOQL query job. |
| `getQueryJob(jobId)` | `QueryResponse` | Current state of one query job. |
| `getAllQueryJobInfo(config?)` | `AllQueryJobsInfoResponse` | List query jobs in the org. |
| `abortQueryJob(jobId)` | `QueryResponse` | Abort a running query job. |
| `getQueryResults(jobId, maxRecords?, locator?)` | `AxiosResponse<string>` | One page of CSV results, headers included. |
| `getAllQueryResults(jobId, maxRecords?)` | `string` | Every page, concatenated. |
| `waitQueryEnd(jobId, delay?)` | `string` | Poll until the job reaches a final state. Default delay 3000 ms. |
| `getQueryFinalResults(jobId, maxRecordsByRequest?)` | `string` | Wait, then fetch all results. Default 200 per request. |
| `submitAndGetQueryResults(query, maxRecordsByRequest?)` | `string` | Submit, wait, and fetch all results. |

### Ingest jobs

| Method | Returns | Description |
| --- | --- | --- |
| `createDataUploadJob(request)` | `JobUploadResponse` | Create an ingest job. |
| `uploadJobData(jobId, filename)` | `number` | Upload a CSV file; resolves to the HTTP status. |
| `startJob(jobId)` | `JobUploadResponse` | Move the job to `UploadComplete`. |
| `createAndStartJob(request, filename)` | `JobUploadResponse` | Create, upload, and start. |
| `abortJob(jobId)` | `JobUploadResponse` | Abort a running ingest job. |
| `getIngestJobInfo(jobId)` | `JobInfoResponse` | Job state plus processing counters. |
| `waitJobEnd(jobId, delay?)` | `string` | Poll until the job reaches a final state. Default delay 3000 ms. |
| `createAndWaitJobResult(request, filename)` | `JobInfoResponse` | Create, upload, start, and wait. |
| `getJobSuccesfulResults(jobId)` | `string` | CSV of records that succeeded. |
| `getJobFailedResults(jobId)` | `string` | CSV of records that failed. |
| `getJobUnprocessedResults(jobId)` | `string` | CSV of records never processed. |

### Exported types

`Parameters`, `QueryInput`, `QueryConfig`, `QueryResponse`,
`AllQueryJobsInfoResponse`, `JobUploadRequest`, `JobUploadResponse`,
`JobInfoResponse`, and the `MonitorJob` emitter.

Key shapes:

```typescript
interface Parameters {
  accessToken: string;
  apiVersion: string;   // e.g. '55.0'
  instanceUrl: string;
  isTooling?: boolean;
}

interface QueryInput {
  operation: string;    // 'query' | 'queryAll'
  query: string;
  contentType?: string;
  columnDelimiter?: string;
  lineEnding?: string;
}

interface JobUploadRequest {
  object: string;       // e.g. 'Account'
  operation: string;    // 'insert' | 'update' | 'upsert' | 'delete' | 'hardDelete'
  externalIdFieldName?: string;   // required for 'upsert'
  assignmentRuleId?: string;
  columnDelimiter?: string;
  contentType?: string;
  lineEnding?: string;
}
```

## Requirements

- Node.js >= 20.19.0
- A Salesforce access token and instance URL

## Reference

- [Salesforce Bulk API 2.0 documentation](https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/bulk_api_2_0.htm)
- [Changelog](./CHANGELOG.md)
- [Issues](https://github.com/clemb8/client-sf-bulk2/issues)

## Acknowledgements

Inspired by [node-sf-bulk2](https://github.com/msrivastav13/node-sf-bulk2).

## License

MIT
