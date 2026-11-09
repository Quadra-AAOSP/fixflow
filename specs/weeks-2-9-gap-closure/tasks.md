# Weeks 2–9 Gap Closure — Tasks

Ordered execution. Each task ends with `npx tsc --noEmit`; clusters end with `npx vitest run`.

## T1 — Contracts & stale comments (Week 3)
- [x] `lib/endpoints.ts`: add `reports.start`, `reports.resolve`, `reports.urgency`, `reports.update`; replace stale list.
- [x] `services/reports.ts`: add `startReport`, `resolveReport`, `overrideUrgency`, `updateReport`; replace stale list.
- [x] `types/report.ts`: add `UpdateReportPayload`.
- [x] Extend `tests/endpoints.test.ts`.
- **Accept:** typecheck green; test asserts the four new paths.

## T2 — Backend report editing (Week 5)
- [x] `dto/UpdateReportRequest.java` with nullable, validated fields + at-least-one-field check.
- [x] `ReportController` `@PatchMapping("/{id}")`.
- [x] `ReportService.update(...)`: participant/staff gate, `editable` + status gate, category taxonomy validation, same-status history entry + `STATUS_CHANGE` publish.
- **Accept:** `.\mvnw.cmd -q compile` succeeds.

## T3 — Pure helpers (Weeks 5/8)
- [x] `utils/reportActions.ts` (`isAssignedToMe`, `canTechnicianStart/Resolve`, `canReporterConfirm/Reopen`, `canEditReport`).
- [x] `utils/notifications.ts` (`notificationForEvent`, `mergeNotifications`).
- [x] `tests/resolution.test.ts`, `tests/realtime.test.ts`.
- **Accept:** truth tables pass.

## T4 — Technician action panel + reporter pending panel (Week 5)
- [x] `[id].tsx`: start/resolve panel, resolve modal (required note, counter, confirm), pending-resolution card.
- [x] Confirm wrapped in `Alert.alert`; reopen stays modal-gated.
- [x] i18n en/zh keys for panel/modal/confirm.
- **Accept:** no single-tap resolution actions; parity test green.

## T5 — Urgency override + reassignment (Week 4)
- [x] `[id].tsx`: reporter-vs-AI-vs-final triage card for `policy.canAssign`.
- [x] Override modal (urgency + reason) → `overrideUrgency`; inline errors.
- [x] Assign button becomes "Reassign technician" with `Alert` confirmation when already assigned.
- [x] i18n keys.
- **Accept:** visible only to staff/admin/super_admin; actions reload report.

## T6 — Report editing UI (Week 5)
- [x] `[id].tsx`: "Edit report" when `editable` && (participant || canAssign); modal prefilled; PATCH; 404/405 → "unavailable" message.
- [x] i18n keys.
- **Accept:** gated correctly; error path handled.

## T7 — Real-time client (Weeks 4/8)
- [x] `constants/config.ts`: `WS_EVENTS_URL` + `WS_ORIGIN`.
- [x] `services/realtime.ts`: shared socket, subscriptions, reconnect, silent failure.
- [x] `hooks/useRealtimeEvents.ts`: subscribe + fallback polling.
- [x] Wire detail/list/assignments/home/workspace.
- **Accept:** typecheck; no token logging; manual WS event refreshes list/detail (or fallback poll when WS unavailable).

## T8 — Notifications (Weeks 5/8)
- [x] `stores/notifications.tsx`: persisted feed, unread count, mark-all-read, site subscription.
- [x] `app/(tabs)/_layout.tsx`: provider + toast on new event.
- [x] `more/notifications.tsx`: real feed with deep links, empty/error states.
- [x] Unread badge on home bell.
- [x] i18n `notifications.*`.
- **Accept:** pending-resolution event produces a visible alert and a feed row.

## T9 — Offline queue + connectivity store (Week 8)
- [x] `stores/connectivity.tsx`; `hooks/useConnectivity.ts` reads context.
- [x] `lib/offlineQueue.ts`; `services/offlineReports.ts` (`isNetworkFailure`, `flushReportQueue`).
- [x] `new.tsx` queues on network failure only.
- [x] Offline banner: pending count + Retry → flush.
- [x] Reports list pending banner.
- [x] `tests/offlineQueue.test.ts`.
- [x] i18n keys.
- **Accept:** backend down → submit → queued → backend up → auto-flush → report appears.

## T10 — Photo analysis non-blocking + badge (Week 7)
- [x] Replace blocking poll loop with interval + ref cleanup.
- [x] Badge incl `unavailable`/`failed`; reload on terminal state.
- [x] i18n keys.
- **Accept:** UI interactive during analysis; badge reflects terminal state.

## T11 — Accessibility polish (Week 8)
- [x] `SegmentedControl` / `Picker` selected + disabled states.
- [x] Photo buttons disabled state; primary report actions labelled, ≥44 px.
- **Accept:** no type errors; semantics present.

## T12 — Role/section coverage tests (Week 6)
- [x] `tests/roleCoverage.test.ts`: 6 roles × tabs × landing redirect.
- **Accept:** every role asserted for allowed and forbidden destinations.

## T13 — Final verification & report (Week 9)
- [x] `npx tsc --noEmit`, `npx vitest run` (11 files / 100 tests), backend `.\mvnw.cmd -q compile`.
- [x] Grep for Week-4 mislabel / "tidious"; fix if present (only spec artifacts mention them — no weekly report docs exist).
- [x] `.env.example` release note (required `EXPO_PUBLIC_API_URL`, no secrets; `EXPO_PUBLIC_WS_ORIGIN`).
- [x] Demo-account seeding: existing `SqlDataSeeder` + `demo-data.sql` covers all roles and sample reports; documented in demo script.
- [x] Screenshot checklist + backup flow note added to `.trae/documents/demo-script.md`.
- [x] Produce final table, assumptions, dependencies, score, verdict.

## Out of scope
Visual redesign, EAS build execution, real screenshot capture, backend auth/privacy changes.
