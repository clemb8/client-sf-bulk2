# End-to-end tests

These run against a **real Salesforce org**. The unit suite in `test/` stubs
Salesforce at the HTTP layer with `nock.disableNetConnect()` and proves the
library's own control flow; it cannot prove the library still talks to
Salesforce correctly. That is what this suite is for.

## Quick start

```bash
cp .env.example .env      # fill it in — see "What you need" below
npm run test:e2e
```

With no `.env`, the suite **skips**. It does not fail, so a contributor without
an org still gets a green run.

## Safety

These tests **create and delete records**. Three controls bound that:

1. **Sandbox check.** The suite refuses to run when `SF_INSTANCE_URL` does not
   look like a sandbox, scratch org or developer edition. Override only
   deliberately, with `SF_E2E_ALLOW_NON_SANDBOX=true`.
2. **Run tag.** Every record carries a unique per-run marker
   (`client-sf-bulk2-e2e-<uuid8>`). If cleanup fails, the leftovers are findable
   by hand instead of being indistinguishable from real data.
3. **Cleanup.** Created records are deleted in `afterAll`, through the same Bulk
   API. A cleanup failure is warned about, never thrown — it must not mask the
   assertion failure that may have preceded it.

Not wired into `prepublishOnly`. A release must not depend on network access to
a third party.

## What you need

| Variable | Required | Notes |
|----------|----------|-------|
| `SF_INSTANCE_URL` | yes | My Domain URL, no trailing slash |
| `SF_ACCESS_TOKEN` | one of | Simplest. Tokens expire; a Bulk job can run minutes |
| `SF_CLIENT_ID` + `SF_CLIENT_SECRET` | one of | Preferred. Mints a fresh token per run |
| `SF_API_VERSION` | no | Default `59.0` |
| `SF_E2E_OBJECT` | no | Default `Account` |
| `SF_E2E_LABEL_FIELD` | no | Default `Name` |
| `SF_E2E_RECORD_COUNT` | no | Default `3` |
| `SF_E2E_POLL_DELAY_MS` | no | Default `3000` |
| `SF_E2E_CLEANUP` | no | Default `true` |
| `SF_E2E_ALLOW_NON_SANDBOX` | no | Default `false` |

A partial configuration **fails loudly** rather than skipping — a half-filled
`.env` is a mistake, not a choice.

### Org prerequisites

- The authenticated user needs **API Enabled**, and create/delete on
  `SF_E2E_OBJECT`.
- For the client-credentials flow: a Connected App with that flow enabled and a
  **run-as user** assigned. Salesforce does not allow it without one.

## What is covered

| File | Covers |
|------|--------|
| `query.e2e.ts` | submit → wait → results; one-call helper; real pagination; job info; list; abort; error propagation |
| `ingest.e2e.ts` | create → upload → start → wait → results; one-call helper; per-row failures; abort; missing-file rejection |
| `monitor.e2e.ts` | `MonitorJob` event sequence on real poll cycles, and that polling stops once the call settles |

Three tests exist because a specific defect was fixed in this initiative and
only a live org proves the fix end to end: pagination not stacking locator
parameters, a failed poll reaching the caller instead of hanging, and
`getFileBody` rejecting with an `Error` rather than a string.

## What is still not covered

- **Salesforce API contract changes.** Running green today says nothing about a
  future Salesforce release.
- **Large volumes.** `SF_E2E_RECORD_COUNT` defaults to 3. Nothing here exercises
  the unbounded-size path, and `createAxiosHeader` still sets `maxBodyLength`
  and `maxContentLength` to `Infinity`.
- **Concurrent polls.** `getFinalBulkState` starts a new poll every `delay` ms
  regardless of whether the previous returned. Pre-existing; asserted by nothing.
- **Auth.** The library performs none — it accepts a token. `helpers/auth.ts` is
  harness code, not library code.
