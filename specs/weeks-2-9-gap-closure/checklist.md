# Weeks 2–9 Gap Closure — Verification Checklist

Each checkpoint is proven by code inspection plus `npx tsc --noEmit`, `npx vitest run` (11 files / 100 tests) and `.\mvnw.cmd -q compile` (backend).

## Week 2 — Setup, auth, role navigation
- [x] `app/` (Expo Router), `components/`, `assets/`, navigation guard (`lib/tabAccess.ts`) present.
- [x] `package.json` dependencies installed; typecheck passes.
- [x] Login/registration screens use the shared `TextField` / `Button` / `AuthShell` components and approved palette.
- [x] Separate reporter (`register-reporter.tsx`) and technician (`register-technician.tsx`) registration forms with validation copy.
- [x] Session persistence in `constants/session.ts` + `stores/auth.tsx` (SecureStore native, web fallback).
- [x] Role-based tabs and redirects (`lib/tabAccess.ts`, `app/(tabs)/_layout.tsx`); tested in `tests/tabAccess.test.ts` and `tests/roleCoverage.test.ts`. **Role/tab flow left untouched as requested.**

## Week 3 — Report form, photos, open reports
- [x] Report form has description, category, urgency, optional address, subsite, visibility.
- [x] Field validation with inline/user-facing messages.
- [x] Submit loading + success states.
- [x] Photo selection + preview capped at 5 images and 5 MB using shared `MAX_PHOTO_COUNT` / `MAX_PHOTO_SIZE_BYTES`.
- [x] Open-reports list and report-detail screens; "join report" action wired to backend.
- [x] Reporter privacy: server-masked `createdByName` / `address` / `reporterReason`; mobile renders masked nulls (`ReportCard.tsx`, `types/report.ts`).
- [x] API contract documented in `lib/endpoints.ts` / `services/reports.ts`.

## Week 4 — Routing, queues, triage, real time
- [x] Contractual vs non-contracted routing policy exposed on `report.policy` and rendered per role.
- [x] Technician queue: assigned vs claimable sections, availability toggle (`stores/availability.tsx`), claim controls.
- [x] Staff/admin triage: reporter-vs-AI-vs-final urgency columns, override modal, technician oversight, reassign.
- [x] Assignment/status events wired through `services/realtime.ts` + `hooks/useRealtimeEvents.ts` (poll fallback).
- [x] Loading / success / error feedback on all mutation flows.

## Week 5 — Two-step resolution, notifications, edit/reassign
- [x] Technician "Start work" and "Mark work complete" → `resolved_pending_confirmation`.
- [x] In-app notification + toast when confirmation is needed (`stores/notifications.tsx`).
- [x] Pending-resolution panel with report details and Confirm / Reopen controls.
- [x] Reporter confirm wrapped in `Alert.alert`; reopen requires a rationale.
- [x] Report edit modal role-gated; backend `PATCH /api/reports/{id}` added and compiling.
- [x] Technician reassignment gated and confirmed; status history preserved server-side.
- [x] Race guard: backend workflow transitions load reports with `PESSIMISTIC_WRITE`; UI guards duplicate taps.

## Week 6 — Checkpoint, role coverage, API/state
- [x] `tests/roleCoverage.test.ts` covers all four delivery roles (+ super_admin, shop_manager) across tabs and landing redirects.
- [x] Cross-role state sync: list/detail/queues all re-fetch on realtime signals.
- [x] Loading/error states on API calls; report status stays consistent.

## Week 7 — Gap fixes, photo analysis, multilingual, privacy
- [x] Non-blocking photo analysis with status badge (processing / done / unavailable / failed), no blocking poll loop.
- [x] Language selection in Profile → Settings; localStorage-backed locale.
- [x] All labels/validation extracted to `constants/resources/{en,zh}/common.json`, parity enforced by `tests/i18n-catalogs.test.ts`.
- [x] Private reporter info masked server-side and rendered as "not shared".
- [x] No access tokens or internal details logged (`apiClient` security test, realtime client silent failures).
- [x] Regression tests cover auth/session, submission helpers, routing, resolution.

## Week 8 — Real-time, translation, offline/retry, UI polish
- [x] Realtime notifications for assignment, reassignment, status change, pending resolution, confirmation.
- [x] English + Chinese catalogs complete and consistent (parity test green).
- [x] Connection indicator (`OfflineBanner`), retry/send-now action, clear error feedback, interrupted-upload handling.
- [x] Offline reporting: queue on network failure only, capped at 10, auto-flush on reconnect (`tests/offlineQueue.test.ts`).
- [x] Accessibility: selected/disabled states on `Picker` and `SegmentedControl`, labelled photo buttons, ≥44 px primary actions.

## Week 9 — Final regression, production config, demo, release
- [x] Final regression suite green: typecheck + 100 tests + backend compile.
- [x] Release build requires `EXPO_PUBLIC_API_URL` (`constants/config.ts` throws otherwise); no secrets in repo; `.env.example` documents the contract.
- [x] Demo accounts for reporter / technician / staff / admin (+ super_admin, shop_manager) seeded by `demo-data.sql`, with sample reports for every status.
- [x] Demo walkthrough scripted (`.trae/documents/demo-script.md`), including screenshot table and backup demo flow.
- [x] No weekly-report docs exist in the repo, so the "Week 3" header / "tidious" fixes are not applicable (grep confirmed only spec artifacts mention them).
