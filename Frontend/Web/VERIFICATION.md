# Vue web verification

Verified on 31 October 2026 in the current `feature/web` checkout. This records
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
It does not measure the configured absolute session lifetime or test browser
back/forward-cache behavior, which require separate checks.

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
