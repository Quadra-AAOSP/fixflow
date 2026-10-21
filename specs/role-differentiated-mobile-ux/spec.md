# Spec: Role-differentiated mobile UX (site setup, admin applications, shop manager)

## Problem
Admin, super admin, and reporter screens are currently identical. The backend
now exposes `siteOnboarding`, `adminApplication`, `capabilities.manageShop`,
subsite management, and the site-admin application workflow. The mobile app
(only `Frontend/Mobile` is in scope) must surface these so each role lands on
an experience shaped for its job.

## Verified backend contract (from source, do not deviate)
- `UserRole`: `reporter | technician | staff | admin | super_admin | shop_manager`
  (`domain/UserRole.java`).
- `UserResponse` (`dto/UserResponse.java`) adds:
  - `siteOnboarding: { siteId, reportingReady, setupRequired, canManageSubsites, setupEndpoint } | null`
  - `adminApplication: { id, status } | null`
- `UserCapabilities` (`dto/UserCapabilities.java`) adds `manageShop: boolean`.
  `provisionableRoles`: super_admin → `[staff, admin, shop_manager]`, admin → `[staff]`.
- `GET /api/sites/{siteId}/reporting-setup` →
  `{ siteId, reportingReady, activeSubsiteCount }` (`SubsiteService.SetupStatus`).
- Subsites: `GET/POST /api/sites/{siteId}/subsites`,
  `PUT /api/sites/{siteId}/subsites/{id}`,
  `POST /api/sites/{siteId}/subsites/{id}/archive`.
  `SubsiteResponse { id, siteId, label, name, description, archivedAt }`;
  `SubsiteRequest { label(≤64), name(≤255), description(≤2000) }`.
- Site-admin applications (`SiteAdminApplicationController`):
  - `GET /api/auth/site-admin-application` → own application or null
  - `GET /api/admin/site-admin-applications` → pending list (super_admin only)
  - `POST /api/admin/site-admin-applications/{id}/approve|reject`
  - Response `{ id, userId, siteId, status: pending|approved|rejected, createdAt, decidedAt, decidedBy }`
  - 409 on repeat decision, 404 unknown id, 403 wrong role.
- Registration: `POST /api/auth/register` accepts `role: admin` + `siteId`;
  server demotes to `reporter` and files a pending application
  (`AuthService.register`).
- Provisioning: `POST /api/admin/users` accepts `staff | admin | super_admin |
  shop_manager`; admins may only mint `staff` for their own site;
  `shop_manager` and `super_admin` get null site.
- `CreateReportRequest` adds `subsiteId: Long?` (positive). **No
  public/private visibility field exists** — the visibility toggle is out of
  scope until the backend adds it.

## Changes by file

### Types
1. `types/common.ts` — add `'shop_manager'` to `UserRole`.
2. `types/user.ts` —
   - `User.capabilities` += `manageShop: boolean`.
   - `User` += `siteOnboarding: SiteOnboarding | null`,
     `adminApplication: AdminApplicationRef | null`.
   - New exported types:
     `SiteOnboarding { siteId: number; reportingReady: boolean; setupRequired: boolean; canManageSubsites: boolean; setupEndpoint: string }`,
     `AdminApplicationRef { id: number; status: 'pending' | 'approved' | 'rejected' }`,
     `SiteAdminApplication { id: number; userId: number; siteId: number; status: 'pending' | 'approved' | 'rejected'; createdAt: string; decidedAt: string | null; decidedBy: number | null }`.
   - `RegisterPayload.role` → `Extract<UserRole, 'reporter' | 'technician' | 'admin'>`.
   - `ProvisionUserPayload.role` → `Extract<UserRole, 'admin' | 'staff' | 'shop_manager' | 'super_admin'>`;
     `siteId: number | null` (null for shop_manager/super_admin).
3. `types/subsite.ts` — `Subsite` += `archivedAt: string | null`; add
   `ReportingSetup { siteId: number; reportingReady: boolean; activeSubsiteCount: number }`.
4. `types/report.ts` — `Report` += `subsiteId: number | null`;
   `CreateReportPayload` += `subsiteId?: number`.

### Endpoints (`lib/endpoints.ts`)
- `auth.siteAdminApplication: '/api/auth/site-admin-application'`
- `admin.siteAdminApplications: '/api/admin/site-admin-applications'`,
  `admin.siteAdminApplicationDecision: (id, decision) => /api/admin/site-admin-applications/{id}/{approve|reject}`
- `sites.reportingSetup: (siteId) => /api/sites/{siteId}/reporting-setup`
- `sites.subsite: (siteId, id) => /api/sites/{siteId}/subsites/{id}`
- `sites.archiveSubsite: (siteId, id) => /api/sites/{siteId}/subsites/{id}/archive`

### Services
- `services/sites.ts`: `getReportingSetup(siteId)`, `updateSubsite(siteId, id, payload)`,
  `archiveSubsite(siteId, id)`.
- `services/auth.ts`: `getMySiteAdminApplication(): Promise<SiteAdminApplication | null>`.
- `services/admin.ts`: `listSiteAdminApplications()`,
  `decideSiteAdminApplication(id, approve: boolean)`.

### Access (`constants/access.ts`)
- `roleLabels` += `shop_manager: 'Shop manager'`.
- New: `canManageShop(user)` (capabilities.manageShop),
  `canManageSubsites(user)` (`user.siteOnboarding?.canManageSubsites ?? false`).

### New screens (under `app/(tabs)/more/`, registered in `more/_layout.tsx`)
1. `site-setup.tsx` (title "Site setup") — admins with `canManageSubsites`.
   - Header state from `GET reporting-setup`: ready (mint check, "N active
     buildings") vs setup required (coral warning).
   - Subsite list: label chip + name + description; archived rows dimmed with
     "Archived" tag.
   - Add-building form (label, name, description) → `createSubsite`; inline
     edit via same form prefilled → `updateSubsite`; Archive button with
     confirmation → `archiveSubsite`.
   - Blocked for users without `canManageSubsites` (StateView).
2. `admin-applications.tsx` (title "Admin applications") — super_admin only.
   - Pending list from `listSiteAdminApplications`: applicant user id, site
     id, submitted `relativeTime(createdAt)`.
   - Approve / Reject buttons per row → `decideSiteAdminApplication`; on 409
     show "already decided" and refresh; row removed on success.
   - Empty state "No pending applications". Reminder copy that approval takes
     effect on the applicant's next sign-in and identity must be verified
     out-of-band.
3. `admin-application.tsx` (title "Admin application") — any signed-in user
   whose `adminApplication` is non-null (mostly reporters).
   - Status card from `GET /api/auth/site-admin-application` (fall back to
     `user.adminApplication`): pending → "awaiting super-admin review";
     approved → "sign out and back in to activate"; rejected → explanation +
     remain reporter.

### Edited screens
4. `more/index.tsx` — new rows with existing role gating pattern:
   - "Site setup" (admin/super_admin with `canManageSubsites`) → `/more/site-setup`.
   - "Admin applications" (super_admin) → `/more/admin-applications`.
   - "My admin application" (`user.adminApplication != null`) → `/more/admin-application`.
   - Keep Shop row as-is; add "Manage shop" row gated by `canManageShop(user)`
     only if a target exists — it does not, so instead hide the customer Shop
     row for `shop_manager` (they cannot purchase) and show an informational
     row noting catalog management is on the web admin. (No fake navigation.)
5. `more/team-access.tsx` —
   - Role state widened to full provisionable set from
     `capabilities.provisionableRoles` (drives shop_manager in automatically).
   - When role === `shop_manager` (or `super_admin`): hide the Site picker and
     send `siteId: null`; validation skips the site requirement.
   - Confirmation copy handles the no-site case.
6. `(auth)/register.tsx` —
   - `admin` leaves `MANAGED_ROLES`; gets a third public card "I'm a site
     administrator" with subtitle "Apply to manage a site — a super admin
     approves your request."
   - Selecting it renders the public form with Site ID required and an info
     panel explaining the approval flow; submit sends `role: 'admin'`.
   - Success screen copy for admin applicants: account works as reporter until
     approved; status visible under More → My admin application.
   - `MANAGED_ROLES` becomes `['staff', 'super_admin']` (informational only).
7. `(tabs)/reports/new.tsx` —
   - Load `listSubsites(site.id)`; active = `archivedAt == null`.
   - If the site has ≥1 active subsite: required "Building / area" Picker
     (options label `"{label} — {name}"`), `subsiteId` sent on submit;
     validation message includes location.
   - If 0 active subsites: replace the form with a blocking StateView —
     reporters: "No buildings are set up yet; contact your site
     administrator"; admins get a button to `/more/site-setup`.
   - No visibility toggle (backend has no field).
8. `(tabs)/index.tsx` (Home) — role-aware additions, minimal and data-cheap:
   - `SetupRequiredBanner`: when `user.siteOnboarding?.setupRequired`, a coral
     card above the stats: "Finish setting up {site}" + button →
     `/more/site-setup`. Recalculated from `/me`, no extra fetch.
   - `ApplicationPendingBanner`: when `user.adminApplication?.status ===
     'pending'`, a citron card linking to `/more/admin-application`.
   - Quick actions vary by capability: admins see "Team access" and "Site
     setup" tiles; super_admin sees "Applications"; reporter/technician keep
     the current set. Hide site-bound tiles for accounts with no site.
9. `more/_layout.tsx` — register the three new stack screens with titles.

## Out of scope (documented, not built)
- Public/private report visibility — no backend field.
- Shop-catalog management screens — no mobile target; `manageShop` only gates
  nav copy.
- Forced navigation / blocking login on `setupRequired` — backend explicitly
  does not block auth; the banner pattern is the enforcement UX.

## Verification
1. `npx tsc --noEmit -p tsconfig.json` from `Frontend/Mobile` — must pass.
2. Manual/device (report honestly if not run): admin first-login banner →
   site setup → add building → banner clears; reporter register-as-admin →
   pending status screen; super_admin approve → applicant re-login becomes
   admin; report form requires a building and submits `subsiteId`;
   shop_manager sees no site-bound menu rows.
