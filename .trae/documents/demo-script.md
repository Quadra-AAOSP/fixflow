# FixFlow Mobile — Demo Script

Prereqs: backend running (`./mvnw spring-boot:run`), MinIO running (`fixflow.minio.*` env vars set), Expo dev server or a preview APK from `eas build --profile preview` (scaffolded in `eas.json`).

Demo accounts (seeded — no manual creation):
1. Start the backend with `SEED_DEMO_DATA=true` (or `fixflow.seed.demo-enabled: true`); `SqlDataSeeder` imports `Backend/src/main/resources/db/demo-data.sql` idempotently.
2. Sign in with: `reporter@fixflow.test`, `technician@fixflow.test`, `staff@fixflow.test`, `admin@fixflow.test` (plus `superadmin@fixflow.test`, `shopmanager@fixflow.test` for the optional role walkthroughs). Passwords are the development seed passwords in that SQL file — never reuse them outside local demos.
3. Seeded sites: **Demo School** (contracted — AI routing / technician contract) and **Demo Hotel** (uncontracted — staff triage). Sample reports `[DEMO:FF-01…FF-08]` cover open, assigned, in_progress, resolved-pending-confirmation, confirmed, reopened and escalated.

## 1. Reporter
1. Log in as reporter → Home tab shows site stats, needs-attention card, recent reports.
2. Reports → New: fill description (10+ chars), pick subsite/category/urgency, toggle public/private, attach 2 photos via gallery + camera (observe 5-photo / 5 MB validation), submit.
3. Open the report → shows photos grid, status timeline, visibility lock chip.
4. Pull-to-refresh the list; confirm relative timestamps update.

## 2. Technician
1. Log in as technician → tabs are Workspace / Assignments / More / Profile (no Home/Reports).
2. Assignments → two sections: "Assigned to me" and "Available to claim".
3. Profile → availability toggle ("saved on this device only"), session panel with heartbeat status and keep-alive switch.
4. Try deep-linking to `/reports/1` while technician → auto-redirect to Workspace.

## 3. Staff / Admin
1. Log in as staff/admin → Home tab shows full dashboard; Reports list has status filter including "Needs confirmation".
2. More → Technicians: directory with availability chips, skills, contract sites.
3. Open a resolved-pending report → Confirm button; confirm → status flips to confirmed, confirmed-by card appears.
4. Reopen with a reason → status flips to reopened, reopen reason shown, count increments.

## 4. Super admin
1. More → Admin applications: approve/deny a pending admin application.
2. Verify applicant gains admin on next sign-in.

## 5. Shop manager
1. Log in as shop_manager → shop-only navigation (products/orders), no site tabs.

## 6. Cross-cutting
1. Profile → Settings → Language: switch to 中文, verify every label/tab switches; switch back.
2. Kill the backend → offline banner appears; retry button restores.
3. Dark mode toggle in Settings → whole app switches.
4. Wait 15 min (or drop device clock) → heartbeat keeps session alive; force a 401 → silent re-login.

## Screenshots to capture (one per role)

| Role | Screen | Expected state |
|---|---|---|
| Reporter | Home tab | Stats cards populated, needs-attention card with at least one item, recent reports with relative timestamps |
| Technician | Assignments tab | "Assigned to me" section with ≥1 card; "Available to claim" section visible below |
| Staff | Reports list, "Needs confirmation" filter active | At least one `resolved_pending_confirmation` report in the list |
| Admin | More → Technicians | Directory with availability chips, skills listed, contract sites grouped |
| Super admin | More → Admin applications | At least one pending application row with approve/deny actions |
| Shop manager | Shop products | Product grid visible; no site tabs in the bar |

Capture in light mode, English locale, on a physical device or emulator at 1080p+. Dark mode + 中文 variants are optional extras — run them after the primary set.

## Backup demo flow (if the device or network fails)

1. **Screenshots first** — capture the table above before the live walkthrough so the evidence survives a crash, and keep them in `Testing/` (not committed if large).
2. **Second device** — build the `preview` profile APK (`eas build --profile preview --platform android`) and install it on a spare phone; it talks to the same backend via `EXPO_PUBLIC_API_URL`.
3. **Web fallback** — `Frontend/Web` runs the same backend; demo reporter → reports list → detail → confirm/reopen there if the phone dies mid-flow.
4. **Offline demo instead of live backend** — stop the backend, submit a report, show the offline banner + queued report, then restart the backend and let auto-flush post it.
5. **Data reset** — re-run the backend with `SEED_DEMO_DATA=true`; the SQL is idempotent (`WHERE NOT EXISTS`), so clearing `reports`/`status_history` rows and restarting restores the `[DEMO:FF-01…FF-08]` fixtures.
6. **No-secret rule during demo** — never open `.env`, `application.yaml`, logs or the token bootstrap response on screen.
