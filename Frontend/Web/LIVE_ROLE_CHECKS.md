# Technician and site-admin live checks

Checked 3 November 2026 using the current Vue frontend on 8081 and the isolated
backend on 8082 / fixflow_web_verify_1793370073. All account names, contact data,
site records and request text in this check are disposable fixtures.

## Scope and fixture setup

- Existing technician: account #4, web-technician@example.invalid, null siteId.
- Existing availability before the check: available.
- New target: site #2, Contract request verification site.
- Target-site admin: web-contract-admin@example.invalid, scoped only to site #2.
- Setup used existing backend APIs; no backend source or production record changed.
- Current terms are not configured/enforced in this verification server.
  This does not approve terms or authorize a production contract.

## Observed browser flow

| Step | Action | Observed result |
| --- | --- | --- |
| Fresh technician login | Sign in after the previous overnight session expired | /technician opens; no maintenance report search or notification control |
| Availability update | Toggle available off | Backend-returned state becomes unavailable |
| Restore fixture | Toggle availability back on | State becomes available with a fresh server timestamp |
| Independent option | Open contract options | Continue independently remains available; no contract is required |
| Request submission | Submit site #2 with an explicit test/review-only note | Request #1 appears as pending in the technician's own request list |
| Reviewer login | Sign in as site #2 admin | First-login setup opens for site #2; its own site data loads |
| Target inbox | Open /contracts | Request #1 appears with site #2, technician #4 and the submitted note |
| No automatic approval | Inspect recorded site contracts | No contract is recorded for site #2 |

Approval/rejection buttons were inspected but not submitted. Terms acceptance,
legal agreement and production vetting are not established by this fixture.
The request remains pending for review; existing contracts were not changed.

## Navigation corrections found during review

TechnicianView previously linked accessible assigned work to /assignments, which
is restricted to staff/admins. It now links to the authorized report list. This
does not manufacture the missing assigned-to-me/claimable queue contract.
AppLayout hides report-search/notification entry points for shop-manager profiles
and technicians without an accessible site. A shared shop-manager route rule now
keeps initial guards and later account-role changes consistent for profile,
product management and owned order detail.

## Automated evidence and remaining gate

Actual component tests cover the technician's report link and conditional global
controls. Existing route tests exercise permitted shop-manager destinations.
The full suite and build passed after these changes (see VERIFICATION.md).

A health request to http://127.0.0.1:9000/minio/health/live received no HTTP response.
This only describes that local target; it is not a claim about every possible
storage service. Live object-storage preview/download and provider acceptance
remain open, together with approval/decision and remaining role-flow checks.
