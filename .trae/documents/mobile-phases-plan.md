# Mobile Frontend — Remaining Work Phases

## Context

The audit found ~25 mobile spec items unfinished after the initial build + first round of fixes. Some are mobile-only (no backend change needed), others are genuinely blocked by missing endpoints on the backend. This plan splits work into phases so you can ship what you own now and know exactly what waits on backend.

Backend-blocked items are explicitly excluded from every phase in this plan — they cannot be built without new endpoints.

---

## Phase 1 — Accessibility + Polish (mobile-only, low risk, high visibility)

**Goal:** Fix the easy wins that make the app feel production-ready.

### 1A. Accessibility pass (spec 16.7)
Files touched: every screen under `app/(tabs)/` and `app/(auth)/`
- Add `accessibilityLabel` and `accessibilityHint` on all Pressable buttons that currently only have `accessibilityRole` — Home quick actions, FilterTabs picker items, segmented-control options, ListRow rows.
- Add `accessibilityState={{ checked: active }}` on SegmentedControl to reflect the currently selected value.
- Add `accessibilityState={{ disabled: true }}` on disabled fields in report form (subsite picker when none exist).
- Run: voiceover on iOS / TalkBack on Android on every main screen.

### 1B. 401 auto-redirect recovery polish
File: `stores/auth.tsx`, `app/_layout.tsx`
- When auto re-login succeeds mid-flow, the Home setup gate / admin-application banner should re-check and clear itself — currently it only refreshes `/me`; make sure UI gating re-runs correctly.
- When auto re-login fails and the user signs in manually, clear the `reloginError` banner that still sits on Profile.

### 1C. Empty-state consistency
Files: `app/(tabs)/index.tsx` (Home), `app/(tabs)/reports/index.tsx`, `app/(tabs)/assignments.tsx`
- Every screen has different empty-state copy for "no reports yet". Standardize:
  - Reporter: "No reports filed yet — file the first one"
  - Staff/Admin: "No reports at this site"
  - Technician: "No assigned reports yet"

---

## Phase 2 — i18n (mobile-only, one focused session)

**Goal:** Extract all hardcoded strings into a central catalog with at least English + Simplified Chinese.

### 2A. Install + configure
```
npx expo install i18next react-i18next
```
Create `constants/i18n.ts` with init (language detector uses `Locale` from RN + persists to SecureStore) + `resources/en/common.json` + `resources/zh/common.json`.

### 2B. Extract pass (all screens + components)
Files touched (pattern repeats across each):
- Wrap strings in `t('path.to.key')`
- English + Chinese catalog entries for every extracted key
- Targets: auth screens (login, register x3), Home, Reports list + detail + new, Assignments, Profile, More (all sub-screens), Team access, Site setup, Admin application screens

### 2C. Language picker
Add segmented Language control to `app/(tabs)/profile/settings.tsx` that writes to i18next + SecureStore.

---

## Phase 3 — Technician + Staff UI shells (mobile-only, client-side routing)

**Goal:** Give technicians and staff/admin screens that are visibly different from reporters, even if some action buttons gate to "coming soon" until backend lands.

### 3A. Technician queue split (spec 8.2/8.3 — UI shell)
File: `app/(tabs)/assignments.tsx`
- Split single scoped list into two visual sections: "Assigned to me" (reports where `assignedTechnicianId === me`) and "Available to claim" (reports where no technician is assigned + `policy.inAssignmentQueue`).
- "Available to claim" buttons → tap → currently a toast "Claiming opens here" (backend `GET claimable` / `POST claim` endpoints don't exist, so client-side claim is a placeholder).

### 3B. Staff/Admin oversight shell (spec 9.9)
File: NEW `app/(tabs)/more/technicians.tsx`
- List of technicians assigned to the site, with skills and contract status, pulled from the **current endpoints** (filter `technicians` from the user list / contract list).
- Currently `GET /api/technicians` is NOT-implemented, so if that's still true this is a static/seeded view — flag to the user that backend is needed.

### 3C. Technician availability toggle shell (spec 8.5)
File: `app/(tabs)/profile/index.tsx` technician-only
- Add toggle "Available for work" that's persisted locally (SecureStore) and drives the Workspace header. No backend save for now.

---

## Phase 4 — Confirm / Reopen (backend MUST land first — skip unless it does)

Backend needs:
- `POST /api/reports/{id}/confirm`
- `POST /api/reports/{id}/reopen` with reason

Mobile work (when endpoints exist):
- Services: `services/reports.ts` add `confirmReport`, `reopenReport` with reason field
- Reports list: "Needs confirmation" filter tab
- Report detail (reporter view): Confirm resolved button + Reopen button with modal reason input
- Report detail (staff/admin view): visibility of reopen reason + confirmation history

---

## Phase 5 — Photos + Analysis (backend MUST land first — skip unless it does)

Backend needs:
- `POST /api/reports/{id}/photos`
- `DELETE /api/reports/{id}/photos/{photoId}`
- Photo-analysis endpoint

Mobile work:
- `npx expo install expo-image-picker`
- Add image picker to report form with 5-image max, 5MB per-image, permission handling
- Analysis badge on report detail screen

---

## Phase 6 — Tests + Demo artifacts

### 6A. Component tests (spec 17.x)
- Install Vitest + React Native Testing Library (or `@testing-library/react-native`)
- Targets: auth store heartbeat/login, validation utils (`utils/registration.ts`, report form validation), role-gated conditional rendering in tab layout
- Add script to package.json: `"test": "vitest run"`

### 6B. Demo accounts + release build (spec 17.12–17.20)
- Run a final `eas build --profile preview` when the backend is up
- Screens: one screenshot per role (reporter, technician, staff, admin, super_admin, shop_manager)
- Demo script

---

## Critical Files to Modify by Phase

| Phase | Files |
|---|---|
| 1A | `app/(tabs)/**/*.tsx`, `app/(auth)/**/*.tsx` |
| 1B | `stores/auth.tsx`, `app/_layout.tsx` |
| 1C | `app/(tabs)/index.tsx`, `reports/index.tsx`, `assignments.tsx` |
| 2A | `constants/i18n.ts` (new), `package.json` |
| 2B | ~20 files across `app/` + `components/` |
| 2C | `profile/settings.tsx` |
| 3A | `app/(tabs)/assignments.tsx` |
| 3B | `app/(tabs)/more/technicians.tsx` (new), `more/index.tsx` |
| 3C | `profile/index.tsx`, `stores/auth.tsx` |
| 4 (wait) | `services/reports.ts`, `lib/endpoints.ts`, `reports/[id].tsx` |
| 5 (wait) | `reports/new.tsx`, `reports/[id].tsx` |
| 6A | `tests/` (new), `package.json` |

---

## Verification

- After each phase: `npx tsc --noEmit -p tsconfig.json` must pass
- After Phase 1A: VoiceOver/TalkBack manual spot-check
- After Phase 2: Switch to Chinese, verify all labels switch
- After Phase 3B: Confirm `GET /api/technicians` still doesn't exist — if it does, wire it for real
- After Phase 6A: `npx vitest run` green