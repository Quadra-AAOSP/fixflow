# FixFlow Playwright workflows

Run from this directory with the current backend listening on localhost:8080
and local demo data available. Install dependencies here and in Frontend/Web
with npm.cmd ci if needed. Playwright starts Vue automatically, or can reuse an
already running Vue instance. Use a disposable local database for write runs.

    npm.cmd test
    npm.cmd run test:browser
    npm.cmd run test:api
    npm.cmd run test:list
    npm.cmd run report

The default is headed, maximized Microsoft Edge with a 500 ms action delay and
one worker. The list reporter prints steps in the terminal; the HTML report
can be opened separately. No Playwright UI mode is needed.

    $env:DEMO_MODE = 'true'
    $env:ALLOW_WORKFLOW_WRITES = 'true'
    npm.cmd run test:demo

DEMO_MODE adds one-second browser announcements at annotated actions and groups
login into one announcement. Input values are never included in announcements.
Without ALLOW_WORKFLOW_WRITES=true, scenarios that create maintenance, site,
contract, or shop records are skipped. Created records are kept in the local
database, so the workflow can be inspected afterwards.

Use --grep to select tags or a workflow name from test:list. For example:

    npm.cmd test -- --grep '@reporter'
    npm.cmd test -- --grep '@public'

Set PLAYWRIGHT_HEADLESS=true for an unattended run, PLAYWRIGHT_BROWSER=firefox
for Firefox (install its Playwright browser first), or SLOW_MO_MS to change
the action delay. Set BACKEND_URL and VUE_WEB_URL together for custom endpoints,
keeping the same hostname. With START_VUE=false the suite does not start Vite.

Demo accounts are the aliases documented in Backend/dev/README.txt. To override
a role, provide FIXFLOW_<ROLE>_EMAIL and FIXFLOW_<ROLE>_PASSWORD in the test
process (for example FIXFLOW_SUPER_ADMIN_EMAIL). Do not put real credentials
in this folder. Use the local demo seed with configured site buildings,
taxonomy and documents. Backend/API cases run via Playwright request contexts;
they do not represent visual browser or native Expo verification.

The full marketplace case also needs FIXFLOW_MARKETPLACE_CATEGORY set to a
matching trade, and the demo technician must have current terms, platform
verification and site vetting. Simulated shop checkout requires
FIXFLOW_ALLOW_DEV_CHECKOUT=true and a backend configured for development
checkout. The site onboarding scenario needs working document storage.
