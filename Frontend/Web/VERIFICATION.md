# Vue web verification

Evidence recorded from 31 October through 2 November 2026 in `feature/web`. This records
frontend evidence; it does not certify the backend or mark the maintenance MVP complete.

## Automated checks

Run from `Frontend/Web`:

```sh
VITE_API_URL= npm test -- --run
npm run build
```

The empty API base makes transport tests use their intended same-origin `/api`
contract rather than a developer's local API override. Tests stub transport or
services and therefore do not establish live backend acceptance on their own.

## Live session and private-report checks

Used the real Vue application on port 8081, its API/WebSocket proxy to the local
backend on port 8082, and a separate disposable MySQL verification database.
No production account, backend source, or external AI/payment provider was changed.
The browser was a narrow in-app-browser viewport, with Simplified Chinese selected.

| Case | Procedure | Observed result |
| --- | --- | --- |
| Cookie persistence | Sign in as an assigned fixture technician, open a private report, and fully reload the page. | The HTTP cookie restores the account; authorized description, creator, address, and urgency reason reappear from REST. |
| Reassignment revocation | Keep that private report open and assign it to a second contracted fixture technician through the authorized API. | Without reloading, the old technician's page removes all report details and shows the backend's access denial. The page stays signed in, but the report is no longer readable. |
| Access restored | Reassign the disposable report to the original technician and reload. | The authorized private fields return from the service. |
| Idle expiry | Move only the fixture account's JDBC session access/expiry times into the past in the disposable database. Wait for the live backend session check. | Within the six-second observation window, the socket closes, the web session is revalidated, private content disappears, and the page becomes `/login?redirect=/reports/<id>`. No browser reload is required. |
| Re-login | Sign in again using the same authorized fixture technician. | The preserved return path opens the report and fetches its currently authorized fields. |
| Server logout | Use the profile's sign-out action, then make a fresh direct visit to the protected report URL. | The application stays signed out and returns to login with the report return path. Private content does not reappear. |

The idle-expiry case exercises the web response to an expired server session.
It did not measure the absolute session lifetime. A separate absolute-expiry
case is recorded below; browser back/forward-cache behavior remains unverified.

## Regression coverage

- `reportRealtime.test.ts`: JSON frames, subscription filtering, event deduplication,
  reconnects, revocation and transport shutdown.
- `realtimeStore.test.ts`: REST reauthorization, immediate cache invalidation,
  event coalescing, expiry callbacks and ignored old connection callbacks.
- `reportDetailPrivacy.component.test.ts`: the actual detail component with the
  actual realtime store; private fields and child panels disappear before a pending
  authorization check finishes, and a late old REST response cannot restore them.
- `auth.test.ts` and `router.test.ts`: cookie restoration, logout outcomes,
  generation guards and protected/role-specific navigation.

## Keyboard and language checks

Live browser checks verified the native modal navigation drawer, Escape and focus
restoration, skip-to-content activation, page-content focus after navigation,
product-dialog focus restoration, and horizontal report-table arrow-key scrolling.
Application controls use English or Simplified Chinese, while names, narratives,
product/category data and unknown server messages remain as returned. Date and
currency formatting follows the selected locale without changing server amounts.

## Published registration policy

Signup and administrator provisioning load the public `/api/auth/policy` contract.
The returned password minimum is used in native controls, guidance and payload
validation. Signup offers only supported self-registration forms advertised by the
service; site-admin enrollment still requires the approval-flow flag, and privileged
roles never gain a public signup form. Missing or malformed policy metadata leaves
signup/provisioning unavailable with a retry action, without a guessed minimum.
The policy endpoint does not publish DTO maximum sizes; those limits still mirror
the backend request schemas. Component and service tests exercise a different
minimum and role set, policy-read failure/retry, and routing from the signed-in
account response rather than the submitted role.

## Open acceptance work

- Wider workspace viewport checks, remaining text contrast and assistive-technology audit.
- Live photo storage previews/downloads and enabled AI-provider processing; the local
  verification server uses memory photo storage and disabled external AI features.
- Full live role/application/contract/terms mutation acceptance, beyond component tests.
- Team review of REST/WebSocket contracts and the remaining maintenance lifecycle.
- Backend-dependent assigned/claimable technician queues, start/resolve/history,
  triage/escalation/urgency override, ratings, linked reports and admin review.
  Do not replace these missing contracts with invented data or local success states.

## Registration reflow and targeted contrast review

The live registration role screen fits without document-level horizontal scrolling
at 320 CSS pixels in English and Simplified Chinese. At 1280 CSS pixels the
Chinese page uses its two-column layout without overflow. Temporary viewport
overrides were reset after testing. This check does not cover every workspace page.

Secondary authentication text now uses a darker neutral; the measured foreground/
background ratio is 5.48:1 on the auth surface and 5.16:1 on the managed-access
notice. Coral heading text uses a darker shade (4.97:1); brand background colors
remain unchanged. Urgency chips use separate pale backgrounds and dark foregrounds,
with inverse pairs for dark mode. Sky, amber and red light pairs measure 8.24:1,
6.37:1 and 6.80:1; their dark pairs measure above 10:1. These are mathematical
checks of the selected sRGB pairs, not a claim of whole-application conformance.
Contrast reference: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html

Shipping inputs now mirror the published order DTO maximums: name 255, phone 64,
address 512. The backend remains responsible for authoritative validation.
Validation after this batch: all 40 test files / 228 tests passed; production
build and whitespace checks passed.

## Role-specific screens and building suggestions (2 November)

Reporter accounts now land on /reporter, showing reports created or joined using
server participant policy. Management statistics and assignment queues are absent.
Menu filtering and direct-route guards use the same role matrix; operational
dashboard/assignment routes are staff/admin/super-admin only. Technicians retain
authorized report details but cannot create reports or enter site administration.

A live disposable reporter session landed on My reports. Direct navigation to
/assignments returned to /reporter, and the mobile menu contained only My reports,
Reports, Sites and Shop. The report form's building suggestion action focused its
note field and preserved the report description. Submitting a synthetic suggestion
showed success; an independent admin GET /api/sites/1/subsite-requests returned
the same note as pending. This was performed only in fixflow_web_verify_1793370073.
No real report was submitted or building automatically approved.

Endpoint source review is recorded in ENDPOINT_AUDIT.md, including the remaining
administrative endpoint gaps. Product administration and assistant integration
are covered by the later entries below. This
batch does not establish that every backend endpoint is connected.

## Report assistant integration

Report detail now exposes the published assistant endpoint only to the matching
role/site/participant audience. Each send requires an opt-in checkbox explaining
that the configured provider receives the question and authorized report context.
The UI never sends automatically, never fabricates a reply after provider fallback,
renders replies as text, bounds history to the backend's 20-turn limit and clears
conversation state on report/account/access changes. Late responses after clearing
are ignored. Component/service tests cover consent, private-state invalidation,
fallback, unsafe markup, role restrictions and the exact POST body. Live provider
answers have not been verified; the disposable server has AI disabled.

## Product administration (2 November)

/shop/manage is restricted to shop_manager and super_admin in route guards, shop
header and workspace navigation. The screen connects all five product-admin
mappings: list, detail, create, update and DELETE (backend soft deactivation).
Create/update use distinct DTOs without server timestamps; price/stock use Java
integer limits, images require HTTPS, fields mirror DTO maximum lengths. Prices
are explicitly labelled in minor units rather than guessing a currency scale.
Deactivation requires a separate, focused confirmation; inactive items can be
reactivated through edit. Server failures keep entered values and existing cards.

Live browser evidence in fixflow_web_verify_1793370073: the super admin loaded
the catalogue, created web-verification-tool-20261102 as inactive at priceMinor
1890 / stock 3, read its detail, updated stock to 4 / active true, then deactivated
it. The final UI showed Inactive. No existing product or order was changed.
Component/service tests verify denied roles, exact payload fields, validation,
failed saves/deactivation, server-response rendering and load failure distinction.
All 45 test files / 274 tests passed before the editor-focus adjustment.
The final focus check and product tests passed afterward; production build passed.
The live shop-management header also fits at the observed 417 CSS-pixel width
without document-level horizontal scrolling after adding the management link.

## Type-wide site rules

/site-rules connects list/create/update/delete for site rules, limited to admin
and super_admin in both navigation and route guards. The view states that rules
affect every site of the chosen type. DTO integer/category limits are checked
and only confirmed server responses update the list. Permanent deletion has a
separate confirmation; no live rule deletion was executed. Component tests cover
editing, failure retention, denied roles, loading errors and request payloads.
The full suite passed 47 files / 287 tests; the production build passed.

## Recorded contract removal and terms inspection

The site-scoped contract directory connects DELETE /api/technician-contracts/{id}
and GET /api/technician-terms/{technicianId} for authorized site/super admins.
Removal has a focused permanent-delete confirmation and distinguishes database
relationship removal from legal termination or audited history. Failed deletion
retains the record; scope changes clear action state and reject late responses.
Terms inspection shows the server version, acceptance state, enforcement flag and
recorded acceptance dates; it never accepts terms for a technician.

Live read: super admin inspected technician #4's terms; the disposable server
returned no configured version and enforcement disabled. No contract was deleted.
The rule UI also created and updated only synthetic web_verification_category
(urgency weight 1 then 2, sort order 99) in the disposable schema. Existing rules
were unchanged, and permanent rule deletion was not executed through the browser.
Full regression evidence: 48 files / 292 tests passed; build passed.

## Site detail, setup and pool endpoints

/sites/:siteId connects the dedicated site GET, reporting-setup, taxonomy and
technician-pool APIs. Each resource has independent error handling; failed reads
are not displayed as successful empty data. Only staff/admin/super admins request
the pool/contact data. Ordinary users are restricted to their own site, and old
site/account responses are ignored after navigation. Super-admin permanent site
deletion requires exact-name confirmation and retains details/server errors on
refusal. The feature does not invent cascading deletion or bypass related records.

Live read against disposable site #1 returned its name, one active building,
configured school categories and two available contracted technicians. No site
was deleted. Component/service tests cover routes, DTO paths, pool privacy,
late responses, independent failures and refused deletion. Full regression:
50 test files / 302 tests and production build passed.

## Report intake and live peer privacy (2 November)

Report intake now exposes the backend's optional specialty and public/private
visibility fields. JSON uses lowercase visibility; multipart uses the Java enum
name required by the request-parameter binding. Both transports share DTO-bound
validation: description 10,000, address 512, category/specialty 128, urgency reason
2,000 characters; blank optional fields are omitted. Backend authorization and
validation remain authoritative. Boundary tests cover accepted maximums, oversized
rejection before transport, context validation and both visibility encodings.

Live browser flow in fixflow_web_verify_1793370073:

1. web-reporter@example.invalid submitted public report #3 through the actual
   form (building A, plumbing, medium urgency, specialty pipework). The form
   navigated to the saved detail, which displayed the entered fields.
2. After logout, web-peer@example.invalid opened the same report. Description
   and specialty were visible; creator name, exact room and urgency reason were
   absent from rendered DOM before membership. The join action was available.
3. Clicking the join action attached only this synthetic fixture. The detail
   refreshed from the backend: creator, room and reason appeared, with the peer
   in the attached-reporter list and the join action removed.
4. Opening unrelated private report #2 still returned Report not found; its
   description/room and the join action were absent. Joining public #3 did not
   grant access to private #2. No AI provider or real personal data was used.

This verifies the create/detail/join/peer privacy acceptance slice; it does not
prove every form's limits or the unpublished resolution lifecycle. All 51 test
files / 318 tests and the production build passed.

## Owned order detail and checkout request ordering

/shop/orders/:orderId connects the existing owned-order read, with returned line
prices, subtotal/shipping/tax/total, currency precision, delivery fields and payment
state. The history dialog links to this page. Cancellation requires review and a
separate confirmation; failed cancellation preserves the server-returned order.
Account/route changes clear shipping data and reject late detail responses.

Shop quote/history loads now reject obsolete responses. Checkout prevents duplicate
in-flight submission and reuses an idempotency key for an unchanged retry after a
network failure. Basket quantities and shipping inputs are disabled during submit.
A return URL containing orderId/devPay now opens the read-only order page; it cannot
trigger the development payment endpoint on mount. Component tests exercise old
quotes resolving last, unchanged retries, provider-return links, private-state
cleanup and cancellation errors.

Live read in the disposable schema: peer account viewed fixture order
00aaaf34-d3be-4446-bf02-337264e410c5, initially pending_payment/requires_action.
Fixture setup used only the local API, with a deterministic idempotency key and
synthetic delivery data. No payment was completed. The setup script cancelled this
fixture afterward to release its stock reservation; browser Refresh then showed
cancelled and removed the cancellation action. No existing order was modified.

Full suite: 53 test files / 325 tests passed; production build passed. Two additional
direct-order route checks passed afterward (51 router checks total).

## Remaining form boundary review

FORM_CONTRACTS.md maps current request DTOs to the web form/service boundaries.
Site create/update now validate the published sizes and normalize optional blanks.
Quote/order calls reject empty carts and invalid Java integer quantities; order
creation bounds shipping fields even when values came from autofill/component
state. Contract requests/decisions bound optional text and validate positive IDs.
No new description cap, price, stock or role policy was invented.
Boundary tests verify exact maximums, oversized rejection before network calls,
nullable optional fields and unchanged opaque product identifiers. Full suite:
54 files / 343 tests passed; production build passed.

Readability audit identified additional small workspace text below a 4.5:1 ratio,
including selected teal navigation on pale mint, coral status text, muted chart
labels and footer metadata. These remain targeted follow-up work; this audit does
not establish whole-application accessibility conformance.

## Workspace readability follow-up

ACCESSIBILITY_REVIEW.md records the measured text pairs, source methodology and
viewport observations. Muted metadata, selected navigation and status labels now
use darker foregrounds on the existing brand backgrounds. The observed pairs
exceed 5:1. Live computed styles confirmed the selected navigation, Open/Assigned
status text, site metadata and footer values.
Sites fit at 320px in English/Chinese and at 1280px in Chinese. Reporter home
fit at 320px in both languages, with the report table scrolling within its region.
The body minimum-width overflow and unwrapped site-card actions were corrected.
The browser viewport override was reset after testing. These changes do not
establish full accessibility acceptance for all roles and workflows.

## Absolute-expiry verification and acceptance audit

On 2 November, the real peer browser session opened report #3 and showed the
synthetic room/reason markers. The disposable database had exactly one peer
authentication timestamp. Only that timestamp was replaced with a standard Java
serialized Instant 24 hours in the past; the session idle deadline was separately
kept 30 minutes in the future. The default absolute limit is 12 hours.
After the backend's live socket/session check, the page redirected without a
reload to /login?redirect=/reports/3. Description, room and reason markers were
absent from the rendered DOM. Credential fields were cleared before capturing
the result screenshot. Re-login was then checked using the disposable account.
This tests the absolute authentication clock independently from idle expiry; it
does not measure a real 12-hour wall-clock session or all browser cache behavior.

MEMBER3_ACCEPTANCE.md maps the original checklist to current evidence and retains
the missing API/provider/storage/review gates. Fresh audit verification passed
55 test files / 346 tests and the production build after the catalogue-default fix.
Backend source was unchanged.

The final endpoint audit removed the stale opt-in catalogue gate: an unset
VITE_SHOP_CATALOG_PATH now uses the published /api/shop/catalog route. A valid
deployment override still works; a non-API override is rejected before fetch.
Three new configuration tests verify these cases with no invented product data.

## Technician request and scoped admin inbox (3 November)

LIVE_ROLE_CHECKS.md records the latest real-browser availability/request/inbox
flow. Technician #4 changed availability and restored it, then submitted a
nonbinding request for disposable site #2. Its site admin saw request #1 pending
while the recorded-contract list remained empty. No approval/rejection, terms
acceptance or real agreement was submitted. The first technician login crossed
an overnight idle gap; a fresh sign-in succeeded before these checks.

Review also corrected a technician link to manager-only assignments and hid
unavailable maintenance search controls from unrelated workspaces. The shared
shop-manager route rule now applies to both initial routing and later role changes.
Full validation after the corrections: 56 test files / 349 tests and build passed.
The attempted local storage health check received no HTTP response; actual storage
preview/download acceptance remains unverified.

## Request/session boundary regression (3 November)

Two transport/store regressions were reproduced before the fix: a delayed old
protected-request 401 cleared a newly signed-in user, and an old POST waiting for
CSRF could be dispatched after another account signed in. Request-session tests
now bind requests to their originating authentication scope. Sign-in, session
clearing and accepted role/site changes advance the request revision and abort
old controllers. Late responses are rejected before use or unauthorized handling.
A role/site change also invalidates overlapping older account-refresh results.

CSRF bootstrap remains shared within one session, but a cancelled consumer no
longer cancels another waiting writer. Old bootstrap completion cannot clear a
new session's bootstrap. Existing timeouts and current-session 401 clearing remain
covered. Client cancellation is not a server rollback; already dispatched writes
still depend on backend authorization, transactions and idempotency.

Actual auth store + stubbed fetch tests cover old 401, old waiting write, late
success, current 401, shared-token cancellation and overlapping role refresh.
The first two tests failed on the previous implementation. All 57 files / 355
tests and the production build pass after the fix. Live regression verified
logout, fresh sign-in and a successful building creation at disposable site #2.
Building B / Contract fixture annex persisted; the setup-required banner cleared.
No account approval, contract approval or external provider action was performed.

## Checkout-response destination validation (3 November)

createOrder now validates the returned order ID, non-negative integer total,
provider and nullable checkout URL before returning data to the UI. Provider
redirects require HTTPS; explicit development-provider links may use HTTP.
Executable/data schemes, relative destinations and URL-embedded credentials are
rejected. Missing response metadata is reported separately from an invalid link.
This checks URL shape/scheme, not provider identity or production payment approval.

On rejection the UI directs the user to Orders because a backend order may already
exist. The basket remains and unchanged retries retain their idempotency key; the
client does not claim that the server transaction was rolled back. The actual
service + component integration test confirms this behavior without navigation
or a real payment. Development-provider URLs cannot bypass scheme checks.

The full suite passed 58 files / 368 tests after the response guard, with build
passing. A later focused run passed all 17 checkout/response component tests,
including the added invalid-link basket/idempotency regression.
The missing lifecycle API, storage/provider and team-review gates remain open;
these are backend/team inputs rather than frontend package installations.
