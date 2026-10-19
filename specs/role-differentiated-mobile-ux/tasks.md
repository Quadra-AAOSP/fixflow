# Tasks: Role-differentiated mobile UX

1. **Types** — `types/common.ts` (+`shop_manager`), `types/user.ts`
   (+`manageShop`, `siteOnboarding`, `adminApplication`, `SiteOnboarding`,
   `AdminApplicationRef`, `SiteAdminApplication`; widen Register/Provision
   payloads), `types/subsite.ts` (+`archivedAt`, `ReportingSetup`),
   `types/report.ts` (+`subsiteId` on Report and CreateReportPayload).
2. **Endpoints** — `lib/endpoints.ts`: auth.siteAdminApplication,
   admin.siteAdminApplications + decision fn, sites.reportingSetup,
   sites.subsite, sites.archiveSubsite.
3. **Services** — `services/sites.ts` (getReportingSetup, updateSubsite,
   archiveSubsite), `services/auth.ts` (getMySiteAdminApplication),
   `services/admin.ts` (listSiteAdminApplications, decideSiteAdminApplication).
4. **Access helpers** — `constants/access.ts`: shop_manager label,
   canManageShop, canManageSubsites.
5. **Site setup screen** — new `app/(tabs)/more/site-setup.tsx`: readiness
   header, subsite list, add/edit/archive.
6. **Admin applications screen (super_admin)** — new
   `app/(tabs)/more/admin-applications.tsx`: pending list, approve/reject.
7. **My admin application screen** — new
   `app/(tabs)/more/admin-application.tsx`: applicant status.
8. **More menu** — `more/index.tsx`: new gated rows; `more/_layout.tsx`:
   register the three screens.
9. **Team access** — `more/team-access.tsx`: shop_manager support, nullable
   site, copy updates.
10. **Register** — `(auth)/register.tsx`: admin self-apply card + form +
    success copy; MANAGED_ROLES trimmed to staff/super_admin.
11. **Report form** — `(tabs)/reports/new.tsx`: subsite picker (required when
    subsites exist), blocking empty state when none, send subsiteId.
12. **Home role differentiation** — `(tabs)/index.tsx`: setup-required banner,
    application-pending banner, capability-driven quick actions.
13. **Verify** — `npx tsc --noEmit -p tsconfig.json` passes; summarize device
    checks still owed.
