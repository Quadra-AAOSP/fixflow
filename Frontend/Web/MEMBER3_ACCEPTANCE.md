# Member 3 acceptance map

Reviewed 3 November 2026 against fixflow-task-prd(1)(1).md, current web sources,
backend controller mappings, automated checks and recorded live observations.
The full objective is not complete. Implementation, automated checks and live
acceptance are separate columns; a source file or passing helper is not release proof.

## 3.1 App shell, navigation and sessions

| Requirement | Source / test evidence | Acceptance status |
| --- | --- | --- |
| Vue/Vite/TypeScript/Pinia/router/shared components | package.json; layouts; components/ui; production build | Implemented; build passes |
| Authenticated/guest and role navigation | router/index.ts; utils/workspaceAccess.ts; router.test.ts; workspaceRoles.component.test.ts | Implemented; live reporter management denial observed |
| Login and reporter/technician registration | auth views; services/auth.ts; authLocale and registrationPolicy tests | Implemented; live sign-in/session checks recorded |
| Restoration and credentialed requests | stores/auth.ts; services/api.ts; auth/api tests | Implemented; live cookie reload observed |
| Errors, timeouts, 401 clearing and failed-logout retention | api/auth/requestSession tests; auth store | Automated evidence; live expiry/logout observed |
| Registration payload validation | utils/registration.ts; registration.test.ts | Automated evidence; DTO/policy limits reviewed |
| Real component/router interactions | tests/*.component.test.ts and router.test.ts | Present; do not substitute for every live role mutation |
| Site-admin applications and decisions | AdminApplicationView; TeamAccessView; teamAccess tests | Implemented; wider live decision acceptance remains open |
| Shop-manager permissions/provisioning | workspaceAccess; TeamAccessView; router/teamAccess tests | Implemented; management page covered by role tests |
| Backend signup policy | accountPolicy service/store; registrationPolicy/accountPolicy tests | Implemented with failure/retry gating |
| Live persistence/idle expiry/re-login/logout | VERIFICATION.md session table | Observed against disposable backend |
| Absolute expiry | VERIFICATION.md absolute-expiry entry | Newly observed independently of idle expiry |

## 3.2 Reporting, browsing and detail

| Requirement | Source / test evidence | Acceptance status |
| --- | --- | --- |
| JSON intake and returned-report navigation | ReportFormView; reportForm/reportIntake tests | Live create → detail observed |
| Site browse/search/status filters | ReportsView; maintenance utilities; workspaceLocale tests | Implemented; live Chinese search observed |
| Status/category/specialty/assignee/timestamps and separate urgencies | ReportDetailView; classification panel | Implemented; live detail observed |
| Masked identity/address, participants and joining | ReportDetailView; privacy tests | Live peer masking before join and disclosure after join observed |
| Scope cleanup and stale-response rejection | maintenance/realtime/auth stores; privacy/store/requestSession tests | Automated coverage plus live reassignment/expiry cases |
| Building selection/subsite persistence | ReportFormView; reportForm tests | Actual building used in live creation |
| Site-not-ready setup guidance | report form/subsite views and tests | Implemented; empty-building tests present |
| Photo upload/download controls | ReportPhotosPanel; reportPhotos tests | Implemented; real object-storage preview/download unverified |
| Manual AI and background image consent/status | classification/vision panels and tests | Implemented; live external provider unverified |
| Form limits/nullability | FORM_CONTRACTS.md; requestFields/reportIntake tests | Source/DTO boundary review complete |
| Browser create/detail/join/privacy | VERIFICATION.md report intake entry | Manual live cases recorded; no standalone browser regression runner committed |

## 3.3 Sites and account administration

| Requirement | Source / test evidence | Acceptance status |
| --- | --- | --- |
| Site create/edit and accessible cards | SitesView; maintenance service; requestFields tests | Implemented; all mutations not live-accepted |
| Super-admin site context / ordinary own-site scope | maintenance store; store/siteDetails tests | Implemented; site change/privacy guards covered |
| Authorized account provisioning | TeamAccessView; registration builder; teamAccess tests | Implemented; broader live provisioning gate open |
| First-login setup / subsite create/edit/archive | SubsitesView; subsites component/service tests | Implemented; live create/edit and reload persistence observed; archive acceptance remains open |
| Missing-building suggestion/list/resolve | report form/subsite views; service/component tests | Live suggestion → admin building creation → resolution → reload observed; reporter management denied with 403 |
| Admin applications / shop manager | auth/team access services and views | Source and component evidence; independent human/team review remains open |

## 3.4 Technician network and workflow

| Requirement | Source / test evidence | Acceptance status |
| --- | --- | --- |
| Independent workspace and trade/specialty/proficiency | TechnicianView; TradeProfile; tradeProfile/technician tests | Implemented; null-site technician sign-in observed |
| Direct agreed contracts | ContractsView; access service; directory tests | Implemented; agreement not fabricated |
| Assignment/reassignment | TechnicianAssignmentPanel; ranking tests; assign service | Implemented; live reassignment revocation observed |
| Contract request/decision and current terms | ContractApplicationsPanel; terms/application tests; LIVE_ROLE_CHECKS.md | Live technician request and target-admin pending read observed; decision/terms acceptance remains open |
| Recorded contract list | ContractDirectoryPanel; directory tests | Live super-admin list observed |
| Terms review/acceptance/version change | TechnicianTermsPanel and terms tests | Implemented; real policy/legal approval remains external |
| Eligible candidates/workload/ranking/fallback | ranking/assignment panels and tests | Implemented; no invented AI ranking result |
| Invitations and availability | invitation/availability panels and tests; LIVE_ROLE_CHECKS.md | Live availability update/restoration observed; invitation acceptance remains open |
| Assigned/claimable queues, claims, triage/escalation/urgency override | Current backend mapping scan | Unavailable: required APIs are not published |
| Reporter/admin confirmation and reopen | ReportReviewPanel; reportReview tests | Implemented; full live lifecycle cannot be exercised yet |
| Work start/resolution/history | Current backend mapping scan | Unavailable: required APIs are not published |
| Ratings/linked reports/admin review | Current backend mapping scan | Unavailable: contract not published |

## 3.5 Realtime, shop and delivery gates

| Requirement | Source / test evidence | Acceptance status |
| --- | --- | --- |
| Socket subscription/dedup/reconnect/logout/REST authorization | reportRealtime/realtime store and tests | Implemented; selected live revocation/expiry cases recorded |
| No private retention after reassignment/expiry | reportDetailPrivacy tests; live observations | Verified in scoped cases; not every browser lifecycle |
| Shop catalogue/basket/checkout/orders/profile | shop views/stores/services; shop tests | Implemented; local fixtures used; no production payment acceptance |
| Tests and production build | Current audit commands; opt-in tests/live/backendConnections.test.ts | Default suite 373 passed / 7 live skipped; separate live run 7 passed; production build passes |
| Full role-to-confirmation delivery | Backend lifecycle gaps plus remaining live matrix | Not achieved |
| Keyboard/responsive/accessibility | ACCESSIBILITY_REVIEW.md; navigationAccessibility tests | Targeted evidence only; wider assistive-technology work remains |
| English/Chinese localization | i18n catalog; locale component tests | Implemented; selected live language checks recorded |
| Team contract review | No recorded approval artifact | Not achieved; cannot be supplied by an automated source check |

## Additional endpoints requested by the user

ENDPOINT_AUDIT.md inventories all controller mappings and web destinations.
Product administration, type-wide rules, contract removal/terms inspection,
site detail/setup/taxonomy/pool reads and owned order detail now have web screens.
A payment webhook is a provider-to-server endpoint, not a browser control.
Destructive controls have explicit confirmations; tests did not silently delete
real records or imply that database relationship removal is legal termination.

## Conditions needed to finish

1. Backend owners publish the missing maintenance lifecycle/queue contracts.
2. A real object-storage verification target and permitted provider configuration
   are supplied for the still-unverified integrations.
3. Remaining live role flows and wider assistive-technology/browser acceptance run.
4. Team/feature-owner contract review and release-scope decisions are recorded.

Keep these requirements open. Do not replace missing APIs with local success
states, mark production delivery from fixtures, or treat this map as approval.
