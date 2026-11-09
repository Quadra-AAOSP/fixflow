# FixFlow Mobile — Weeks 2–9 Verification & Gap Closure Spec

## 1. Goal

Make the mobile app demonstrably satisfy every claim in the Weeks 2–9 checklist: verify what
exists, then implement anything missing / partial / broken. Final deliverable is a verdict with
a per-item status table, files changed, assumptions, and backend dependencies.

Baseline (measured this session):
- `npx tsc --noEmit` → exit 0.
- `npx vitest run` → 7 files / 72 tests passing.
- Backend `ReportWorkflowController`, `ReportController`, `ReportPhotoController`,
  `TechnicianAvailabilityController` and `TechnicianController` expose the endpoints the
  checklist assumes.

## 2. Audit result (before implementation)

| # | Item | Week | Status | Evidence / gap |
|---|------|------|--------|----------------|
| 1 | Folder structure | 2 | Verified | Expo Router `app/` replaces `screens/`+`navigation/`; `components/`, `assets/`, `constants/`, `lib/`, `services/`, `stores/`, `hooks/`, `types/`, `utils/` present |
| 2 | Packages + project runs | 2 | Verified | tsc + vitest green; expo-image-picker, reanimated, i18next, secure-store installed |
| 3 | Login uses approved colors + reusable inputs | 2 | Verified | `AuthShell`/`AuthField`/`AuthButton`, `constants/theme.ts` palette |
| 4 | Reporter + technician registration forms with validation | 2 | Verified | `register-reporter.tsx`, `register-technician.tsx`, `utils/registration.ts` + tests |
| 5 | Session persistence | 2 | Verified | `stores/auth.tsx`, `constants/session.ts`, SecureStore |
| 6 | Role-based navigation, secured screens | 2 | Verified | `lib/tabAccess.ts`, `app/_layout.tsx` redirect, `app/(tabs)/_layout.tsx` href:null |
| 7 | Auth fields match backend | 2 | Verified | Mobile payload ⊆ backend `RegisterRequest` (email, password, firstName, lastName, phone, address, role, siteId) |
| 8 | Report form: description/category/urgency/optional address | 3 | Verified | `app/(tabs)/reports/new.tsx` |
| 9 | Field validation + friendly errors | 3 | Verified | `validate()` + i18n `reports.new.*` keys |
| 10 | Submission loading + success states | 3 | Verified | `submitting`/`uploadingPhotos`, success toast |
| 11 | Photos ≤5 / ≤5MB / permissions / preview | 3 | Verified | `MAX_PHOTO_COUNT`, `MAX_PHOTO_SIZE_BYTES`, `services/photos.ts` |
| 12 | Open-reports list + detail | 3 | Verified | `reports/index.tsx`, `reports/[id].tsx` |
| 13 | Join existing report | 3 | Verified | `joinReport` + `onJoin`, idempotent server-side |
| 14 | Reporter privacy masking | 3 | Verified | `ReportResponse` nulls `createdByName`/`address` unless `canSeeSensitive` |
| 15 | API contract notes | 3 | **Partial** | `lib/endpoints.ts` + `services/reports.ts` trailing "NOT implemented" lists are stale (claim/availability/confirm/reopen/photos now exist) |
| 16 | Contractual vs non-contracted routing | 4 | Verified | `site.contractStatus` surfaced; backend assignment policy |
| 17 | Technician queue: assigned vs claimable, availability, claim | 4 | Verified | `assignments.tsx` two sections, `stores/availability.tsx`, `claimReport` |
| 18 | Staff/admin triage: AI vs reporter urgency comparison | 4 | Verified | detail `DefinitionRow` reporterUrgency/aiUrgency/finalUrgency |
| 19 | Final-urgency override | 4 | **Missing** | Backend `PATCH /api/reports/{id}/urgency` exists; no mobile service or UI |
| 20 | Technician oversight | 4 | Verified | `more/technicians.tsx`, ranking endpoints |
| 21 | Reroute / reassignment | 4/5 | **Partial** | `POST /assign` handles REASSIGNMENT + history, but UI has no reassign affordance/confirmation |
| 22 | Assignment/status events in mobile UI in real time | 4 | **Missing** | Backend `/ws/reports` exists; no mobile WS client |
| 23 | Loading/success/error on these flows | 4 | Verified | existing states + toasts |
| 24 | Staff functions hidden from unauthorized users | 4 | Verified | `report.policy.canAssign`, capability gates |
| 25 | Tech marks work complete → pending confirmation | 5 | **Missing** | Backend `POST /start`, `POST /resolve` exist; absent from mobile endpoints/services/UI |
| 26 | In-app alert to reporter when confirmation needed | 5 | **Missing** | No notification store; notifications screen is a static stub |
| 27 | Pending-resolution panel with details + controls | 5 | **Partial** | Confirm/Reopen buttons exist inline; no dedicated panel |
| 28 | Reporter confirms resolved report | 5 | **Partial** | Works, but single tap — no accidental-action guard |
| 29 | Reporter reopens with rationale | 5 | Verified | modal + reason validation |
| 30 | Report editing with role gating | 5 | **Missing** | `Report.editable` exists; no backend update endpoint, no mobile UI |
| 31 | Techn reassignment with role gating | 5 | **Partial** | see #21 |
| 32 | Work history preserved on edit/reassign | 5 | Verified | backend `appendStatusHistory` + `REASSIGNMENT` event |
| 33 | Race condition guard | 5 | Verified | `findForVisionUpdate` = `PESSIMISTIC_WRITE` on claim/assign/confirm/reopen |
| 34 | Confirm/reopen hard to trigger accidentally | 5 | **Partial** | confirm = one tap |
| 35 | Role-coverage tests for 4 roles | 6 | **Partial** | `tabAccess.test.ts` covers roles; no explicit reporter/technician/staff/admin workflow matrix; no resolution/queue tests |
| 36 | Cross-role permission/state resolved | 6 | Verified | policy flags + tabAccess landing redirects |
| 37 | Mobile API calls, loading, status sync | 6 | Verified | pagination, generation guard, 401 logout |
| 38 | Navigation/form feedback consistency | 6 | Verified | shared StateView/Screen/Card |
| 39 | Photo-analysis non-blocking status + result badge + unavailable/error | 7 | **Partial** | 20s blocking poll loop; status shown as plain text; no unavailable state |
| 40 | Language selection | 7 | Verified | `profile/settings.tsx` |
| 41 | Labels/validation extracted for translation | 7 | Verified | `constants/resources/{en,zh}`, parity test |
| 42 | Private info masked | 7 | Verified | server-side masking (see #14) |
| 43 | Tokens/internal details not displayed or logged | 7 | Verified | no token writes; cookie-based session; only dev API-candidate log |
| 44 | Regression tests auth/submission/routing/resolution | 7 | **Partial** | auth/routing exist; submission + resolution coverage thin |
| 45 | Real-time notifications (assignment/status/pending) | 8 | **Missing** | see #22/#26 |
| 46 | Complete translations, status values consistent | 8 | Verified | catalog parity test |
| 47 | Connection indicator + retry + clear errors | 8 | Verified | `OfflineBanner`, `useConnectivity` |
| 48 | Offline reporting (queued/retry) | 8 | **Missing** | failed submit only shows error |
| 49 | UI polish / a11y / touch targets | 8 | **Partial** | many labels exist; SegmentedControl/Picker lack selected/disabled state |
| 50 | Multiple screen sizes / network conditions | 8 | **Partial** | layout is responsive; no automated evidence — manual matrix required |
| 51 | Notifications + translated status stay in sync | 8 | **Missing** | depends on #45 |
| 52 | Final regression login→resolution→reopen | 9 | **Partial** | suite exists; new flows must be added |
| 53 | Production API config, no secrets | 9 | Verified | `constants/config.ts` requires `EXPO_PUBLIC_API_URL` when `!__DEV__`; `eas.json` profiles; no secrets in repo |
| 54 | Demo accounts for 4 roles + sample reports | 9 | **Partial** | `demo-script.md` documents them; no in-repo seeding runner |
| 55 | Release build producible | 9 | Verified (config) | `eas.json` preview/production; actual EAS run is external |
| 56 | Demo walkthrough scripted, works end-to-end | 9 | Verified | `.trae/documents/demo-script.md` |
| 57 | Screenshots + backup demo flow | 9 | **Partial** | checklist exists in demo-script; images must be captured on device |
| 58 | Dev vs release config inconsistencies | 9 | Verified | single URL resolver, dev-only candidates |
| 59 | "Week 3" header mislabel / "tidious" typo | 4/5 | N/A → **verify** | No weekly report docs exist in repo; will grep and fix if found |

## 3. Implementation plan (decision-complete)

### A. Technician two-step resolution (Week 5) — the core missing flow

**Backend: no change** — `POST /api/reports/{id}/start` and `POST /api/reports/{id}/resolve`
(`{"description": "..."}`) already exist.

- `Frontend/Mobile/lib/endpoints.ts`
  - add `reports.start = (id) => /api/reports/${id}/start`
  - add `reports.resolve = (id) => /api/reports/${id}/resolve`
  - add `reports.urgency = (id) => /api/reports/${id}/urgency`
  - add `reports.update = (id) => /api/reports/${id}`
  - replace the stale "NOT implemented" trailing comment with an accurate current list.
- `Frontend/Mobile/services/reports.ts`
  - `startReport(id): Promise<Report>` → POST start
  - `resolveReport(id, description): Promise<Report>` → POST resolve, body `{description}`
  - `overrideUrgency(id, urgency, reason): Promise<Report>` → PATCH urgency
  - `updateReport(id, payload): Promise<Report>` → PATCH report
  - delete the obsolete comment block listing implemented endpoints.
- `Frontend/Mobile/types/report.ts`
  - `UpdateReportPayload = Partial<Pick<CreateReportPayload, 'description'|'address'|'category'|'specialty'|'reporterUrgency'|'visibility'>>`
- `Frontend/Mobile/utils/reportActions.ts` (new, pure, testable)
  - `isAssignedToMe(report, userId)`
  - `canTechnicianStart(report, userId)` → assigned to me && status in `assigned|reopened`
  - `canTechnicianResolve(report, userId)` → assigned to me && status in `assigned|in_progress|reopened`
  - `canReporterConfirm(report)` → `resolved_pending_confirmation` && `policy.participant`
  - `canReporterReopen(report)` → `policy.participant` && status in `confirmed|resolved_pending_confirmation`
- `Frontend/Mobile/app/(tabs)/reports/[id].tsx`
  - Technician panel (assigned technician only):
    - "Start work" when `canTechnicianStart` → `startReport`, success toast, reload.
    - "Mark work complete" when `canTechnicianResolve` → modal with required note
      (1–10000 chars, counter, inline error) → `Alert.alert` confirmation → `resolveReport`.
      On success reload; status becomes `resolved_pending_confirmation`.
  - Reporter pending-resolution panel (replaces the bare action row when
    `status === 'resolved_pending_confirmation'`): card with status badge, assigned
    technician name (existing `technicianName`), resolved description guidance,
    "Confirm resolved" + "Reopen with reason".
  - Confirm guard: `onConfirm` becomes `confirmWithGuard()` that calls `Alert.alert`
    (destructive-neutral) before `confirmReport`.
  - All actions keep existing success/error surfaces (`actionMessage`/`actionError`/toasts).

### B. Final-urgency override (Week 4)

- In `[id].tsx`, a triage card visible to `report.policy.canAssign` (staff/admin/super_admin):
  side-by-side "Reporter" vs "AI" urgency, "Final" urgency, and an "Override urgency" action.
- Modal: `SegmentedControl` `low|medium|high|critical` + required reason (≤2000) → `overrideUrgency`.
  Show AI-not-classified fallback and inline error. Reload on success.
- Backend unchanged (`PATCH /urgency` exists, admin/staff permitted by controller).

### C. Reassignment affordance (Weeks 4/5)

- In the existing assignment section, when `report.assignedTechnicianId !== null`:
  - button label becomes "Reassign technician"; tapping requires `Alert.alert`
    ("Move this report from <current> to <candidate>?") before `assignTechnician`.
  - The assign candidate list already comes from directory/ranking; keep it.
- History/event preservation is backend-side and already implemented.

### D. Report editing with role gating (Week 5)

- **Backend (minimal, required to make the item real):**
  - `Backend/src/main/java/com/example/fixflow/dto/UpdateReportRequest.java` (new)
    - nullable `description` (`@Size(max=10000)`), `address` (`@Size(max=512)`),
      `category` (`@Size(max=64)`), `specialty` (`@Size(max=64)`), `reporterUrgency`,
      `visibility`; reject an all-null body (`@AssertTrue` helper).
  - `ReportController`: `@PatchMapping("/{id}") update(...)`.
  - `ReportService`: `@Transactional update(Long id, UpdateReportRequest req, AppUserDetails actor)`
    - load with `findForVisionUpdate`; `assertCanViewSite` + `assertCanSeeVisibility`.
    - allow if creator (`createdBy.id == actor.id`) or `staff|admin|super_admin`; else 403.
    - require `report.isEditable()` and status in `open|routed|reopened|escalated`; else 409.
    - apply only non-null fields; validate category against the report site's taxonomy
      (same service used by create).
    - `appendStatusHistory(report, s, s, actorUser, "Report edited")` and publish
      `STATUS_CHANGE` with same status so connected clients refresh.
    - return `response(report, actor)`.
- **Mobile:** `report.editable && (policy.participant || policy.canAssign)` → "Edit report"
  action opens a modal prefilled with description/address/category/visibility/urgency →
  `updateReport` → reload. `404/405` maps to `reports.detail.edit.unavailable` with a note
  that the server build does not yet expose editing.
- Contract to flag if backend is not shipped: `PATCH /api/reports/{id}` and the
  `UpdateReportRequest` shape above.

### E. Real-time event stream (Weeks 4/8)

- `Frontend/Mobile/constants/config.ts`: export `WS_BASE_URL` derived from `API_BASE_URL`
  (`http→ws`, `https→wss`), path `/ws/reports`.
- `Frontend/Mobile/services/realtime.ts` (new)
  - `subscribe(destination, handler): () => void`, where destination is
    `/sites/{siteId}/events` or `/reports/{id}/events`.
  - One shared socket; ref-counted destinations; sends `{action:'subscribe', destination}`;
    handles `subscribed`, `event`, `subscription-revoked`; reconnect with exponential backoff
    (1s→30s) while listeners exist; full teardown when the last listener leaves.
  - Never logs cookies/tokens. Failures are silent (callers fall back to polling).
- `Frontend/Mobile/hooks/useRealtimeEvents.ts` (new)
  - `useRealtimeEvents(destination | null, onEvent, { fallbackPollMs = 30000, enabled })`
    - subscribes while mounted; invokes `onEvent` for every event;
    - starts the fallback interval only while the socket is not open; stops when open;
    - re-subscribes when destination changes; cleans up on unmount.
- Wire:
  - `reports/[id].tsx` → `/reports/{id}/events`, debounce 400 ms → `load()`.
  - `reports/index.tsx`, `assignments.tsx`, `(tabs)/index.tsx`, `workspace.tsx` →
    `/sites/{siteId}/events`, debounce 600 ms → existing `load()`.
- Assumption: platform cookie store forwards the HTTP session cookie to the WS handshake
  (iOS/Android shared cookie storage, web same-origin). If not, the fallback poll keeps the
  UI live; no error is surfaced.

### F. In-app notifications (Weeks 5/8)

- `Frontend/Mobile/utils/notifications.ts` (new, pure)
  - `notificationForEvent(event, siteId)` → `{ id: eventId, eventType, reportId, titleKey,
    bodyKey, tone, occurredAt }` for `report.assignment.v1`,
    `report.reassignment.v1`, `report.status-changed.v1`,
    `report.pending-resolution.v1`, `report.confirmation.v1`; unknown types are dropped.
  - caps at 50, de-dupes by `eventId`.
- `Frontend/Mobile/stores/notifications.tsx` (new provider)
  - state: `items`, `unreadCount`, `markAllRead()`; persists to SecureStore
    (`fixflow.notifications.v1`), keyed by user id; clears on user change/logout.
  - subscribes to `/sites/{currentSite}/events` (reuses `services/realtime.ts`) while
    authenticated.
- `app/_layout.tsx`: `NotificationsProvider` inside `AuthProvider`;
  on a new item, `showToast` its translated title (uses `ToastProvider`).
- `app/(tabs)/more/notifications.tsx`: real list (icon by event type, translated title/body,
  relative time, tap → `/reports/{id}`, "Mark all read"), empty + error states.
- `app/(tabs)/index.tsx`: unread dot/count on the existing bell control.
- i18n: `notifications.event.*` for each event type + screen copy (en + zh).

### G. Offline queue + retry (Week 8)

- `Frontend/Mobile/stores/connectivity.tsx` (new provider; replaces per-hook polling)
  - owns `offline`, `retry()`, `pendingCount`, `flush()`; probes `/api/auth/policy` every 30 s,
    on foreground, and after `flush`.
  - `hooks/useConnectivity.ts` becomes a context reader (same public API) so existing screens
    continue to work.
- `Frontend/Mobile/lib/offlineQueue.ts` (new, storage-injectable for tests)
  - `enqueueReport({payload, photoUris})`, `listQueuedReports()`, `removeQueuedReport(id)`,
    `clearQueue()`; SecureStore key `fixflow.offline.reports.v1`; cap 10.
- `Frontend/Mobile/services/offlineReports.ts` (new)
  - `isNetworkFailure(err)`; `flushReportQueue()` → `createReport` + best-effort photo upload
    per entry; removes successes; keeps network failures; drops 4xx with a returned error list.
- `app/(tabs)/reports/new.tsx`
  - on `isNetworkFailure` during submit → enqueue, toast `reports.new.queuedOffline`, navigate
    back to list. Validation/4xx errors keep the inline error path (never queue).
- `app/_layout.tsx` `OfflineBanner`: show `pendingCount` and make Retry call `flush()` then
  `retry()`.
- `reports/index.tsx`: thin banner when `pendingCount > 0` with "Send now".
- Assumption: cached photo URIs may be unreachable after a restart; those uploads are skipped
  and the report is still submitted (no silent loss of the report).

### H. Non-blocking photo analysis + badge (Week 7)

- `[id].tsx`
  - `analyzePhotos()` only calls `triggerVisionProcessing` once and stores the job; a
    `setInterval` (2 s, max 60 s) polls `getVisionJobStatus` without blocking the UI.
  - Render a status badge: `pending` (citron), `processing` (mint), `completed` (mint),
    `failed` (coral), plus `unavailable` when the trigger returns 404/501/503.
  - Terminal state → `load()`; timer cleared on unmount and on new load.
- i18n `reports.detail.vision.status.*` and `reports.detail.vision.unavailable`.

### I. Accessibility polish (Week 8)

- `components/ui/SegmentedControl.tsx`: `accessibilityState={{ selected }}` and
  `accessibilityLabel` from option label.
- `components/ui/Picker.tsx`: option rows expose `accessibilityState={{ selected, disabled }}`.
- `reports/new.tsx`: photo/Camera/Gallery buttons → `accessibilityState={{ disabled }}`.
- `[id].tsx`: confirm / reopen / resolve buttons → explicit labels + hints; minimum 44 px
  touch height on the primary actions.
- No visual redesign; only semantics and touch padding.

### J. Tests, config, docs

- `tests/roleCoverage.test.ts` (new): matrix of all 6 roles × every tab and landing redirect.
- `tests/resolution.test.ts` (new): `utils/reportActions.ts` truth table (start/resolve/confirm/reopen).
- `tests/realtime.test.ts` (new): `utils/notifications.ts` mapping, de-dupe, cap.
- `tests/offlineQueue.test.ts` (new): in-memory storage adapter → enqueue/list/remove, cap, flush selection.
- `tests/endpoints.test.ts`: assert new paths (`start`, `resolve`, `urgency`, `update`).
- `lib/endpoints.ts` / `services/reports.ts`: accurate contract comments.
- `Frontend/Mobile/.env.example`: document `EXPO_PUBLIC_API_URL` as required for release, no secrets.
- Docs: grep repo for `Week 3` header inside a Week-4 doc and for `tidious`; fix if found.
- Demo accounts/sample reports: add a dev-profile seeder **only if** an existing bootstrap
  pattern makes this low-risk; otherwise document the exact accounts in
  `.trae/documents/demo-script.md` and flag DB seeding as a backend task.
- Screenshots: cannot be produced headlessly; keep the capture table in `demo-script.md`,
  add a backup flow (offline + reopen) and record it as a manual delivery step.

## 4. Verification

1. `cd Frontend/Mobile && npx tsc --noEmit` → 0 errors.
2. `cd Frontend/Mobile && npx vitest run` → all tests green (existing 72 + new).
3. `cd Backend && .\mvnw.cmd -q compile` → success after the update endpoint.
4. Manual matrix (documented in the final report): login each role → reporter files → tech
   claims → starts → resolves → reporter confirms → reopen → staff overrides urgency →
   edit → reassign; language switch; backend killed → offline queue → restart backend →
   queued report appears; WS events update list/detail without pull-to-refresh.
5. Final table: Item | Week | Status | Files Changed | Notes; assumptions; backend dependencies;
   completeness score; Ready / Not ready verdict.

## 5. Explicit non-goals

- No visual redesign, no new navigation paradigm.
- No changes to auth/session semantics, privacy masking, or the pessimistic-lock model.
- No EAS build execution (external service); config is verified only.
- No screenshot capture (needs a running device); checklist + backup flow documented instead.

## 6. Assumptions

1. Expo Router `app/` is the accepted equivalent of `screens/` + `navigation/`.
2. Backend is the source of truth for capabilities and privacy; mobile only pre-filters.
3. `POST /start`, `POST /resolve`, `PATCH /urgency` are already deployed; only `PATCH /reports/{id}`
   is newly added.
4. WS handshake forwards cookies; if it does not, polling fallback is acceptable for the demo.
5. Offline queue holds report payloads only; unreachable cached photos are skipped, never the report.
6. "Four roles" = reporter, technician, staff, administrator (`admin`), with
   `super_admin`/`shop_manager` covered in the role matrix as extra.
