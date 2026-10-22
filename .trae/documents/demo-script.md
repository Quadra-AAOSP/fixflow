# FixFlow Mobile — Demo Script

Prereqs: backend running (`./mvnw spring-boot:run`), MinIO running (`fixflow.minio.*` env vars set), Expo dev server or a preview APK from `eas build --profile preview` (scaffolded in `eas.json`).

Demo accounts to create up front: one per role — reporter, technician, staff, admin, super_admin, shop_manager. Register reporter/admin-apply/technician via the role-picker flow; create staff/super_admin/shop_manager via backend seed or admin tooling.

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
Reporter Home, Technician Assignments, Staff Reports-with-confirm, Admin Technicians, Super-admin Applications, Shop-manager products.
