# Repeatable backend connection checks

`tests/live/backendConnections.test.ts` invokes the production web service functions
against a running isolated backend. It is not a mock server or a browser runner.
The default test suite skips these seven checks and never connects to a server.

## Prerequisites

- Node 20 or newer with Fetch and `Headers.getSetCookie`.
- A running loopback HTTP backend with a disposable database and a reporter fixture.
- An existing site and report accessible to that reporter. Use a report the reporter
  created or joined, because photo metadata is restricted to participants.
- Set these environment variables outside source control:
  - `FIXFLOW_LIVE_API`: backend origin, e.g. `http://127.0.0.1:8082`.
  - `FIXFLOW_LIVE_REPORTER_EMAIL`: disposable account ending in `@example.invalid`.
  - `FIXFLOW_LIVE_PASSWORD`: that fixture's password.
  - `FIXFLOW_LIVE_SITE_ID`: its positive integer site ID.
  - `FIXFLOW_LIVE_REPORT_ID`: accessible report's positive integer ID.

Run from `Frontend/Web`:

```sh
VITE_API_URL= npm run test:live
```

The empty API base is intentional: a Node-only cookie bridge forwards relative
`/api/` requests to the explicitly selected server. It preserves the real client
CSRF, serialization, parsing, timeout and error code paths. It rejects non-loopback
targets, URL credentials and absolute service URLs. Cookies remain in memory and
are cleared at teardown; credentials and response bodies are not printed by the
runner. Do not record secrets in tracked environment files or command examples.
With no `FIXFLOW_LIVE_API`, Vitest reports these tests as skipped, not passed.

## What it proves

The suite checks cookie-backed login/restoration, published registration policy,
reporter site scope, building reads, paginated reports/detail, authorized photo
metadata, server rejection of an admin inbox read, retained session after 403,
catalogue parsing, account order history, and server-side session invalidation.
It logs in and logs out its own session. It does not create accounts or alter sites,
reports, contracts, products or orders. It does not call AI or payment providers.

Photo upload/download/persistence, other role mutations, WebSockets, browser
navigation/rendering and full maintenance lifecycle acceptance remain separate
checks. Empty photo metadata is valid here and does not establish working storage.

## Observed run

3 November 2026: seven checks passed against the existing isolated backend on :8082
using the reporter fixture/site #1/report #1. Production service modules performed
the requests. The reporter management read returned 403 and the same session still
worked afterward; after logout `/api/auth/me` returned 401.
