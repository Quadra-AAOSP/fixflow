/**
 * Locked API endpoint paths. Centralized here so the contract is auditable
 * in one place and so a contract drift (path rename, new param, etc.) is a
 * single-line change rather than a sweep across services.
 *
 * Every path below was verified against the running backend controllers:
 *   AuthController, AdminUserController, SiteController, SubsiteController,
 *   SiteRuleController, ReportController, TechnicianSkillController,
 *   TechnicianContractController, ContractApplicationController,
 *   ShopCatalogController, ShopOrderController.
 *
 * Endpoints the backend does NOT implement are deliberately absent — see the
 * trailing comment for the tracked list.
 */

export const endpoints = {
  auth: {
    login: '/api/auth/login',
    register: '/api/auth/register',
    logout: '/api/auth/logout',
    me: '/api/auth/me',
    /** GET — the caller's own site-admin application, or null. */
    siteAdminApplication: '/api/auth/site-admin-application',
  },

  admin: {
    /** POST — provision a staff/admin account (`admin` | `super_admin`). */
    users: '/api/admin/users',
    /** GET — pending site-admin applications (super_admin only). */
    siteAdminApplications: '/api/admin/site-admin-applications',
    siteAdminApplicationDecision: (id: number | string, decision: 'approve' | 'reject') =>
      `/api/admin/site-admin-applications/${id}/${decision}`,
  },

  sites: {
    list: '/api/sites',
    byId: (id: number | string) => `/api/sites/${id}`,
    subsites: (siteId: number | string) => `/api/sites/${siteId}/subsites`,
    subsite: (siteId: number | string, id: number | string) =>
      `/api/sites/${siteId}/subsites/${id}`,
    archiveSubsite: (siteId: number | string, id: number | string) =>
      `/api/sites/${siteId}/subsites/${id}/archive`,
    reportingSetup: (siteId: number | string) =>
      `/api/sites/${siteId}/reporting-setup`,
    subsiteRequests: (siteId: number | string) =>
      `/api/sites/${siteId}/subsite-requests`,
    resolveSubsiteRequest: (siteId: number | string, id: number | string) =>
      `/api/sites/${siteId}/subsite-requests/${id}/resolve`,
  },

  siteRules: {
    list: '/api/site-rules',
    /** Optional `siteType` filter — omitted returns the full taxonomy. */
    byType: (siteType: string) =>
      `/api/site-rules?siteType=${encodeURIComponent(siteType)}`,
  },

  reports: {
    list: '/api/reports',
    byId: (id: number | string) => `/api/reports/${id}`,
    join: (id: number | string) => `/api/reports/${id}/join`,
    reporters: (id: number | string) => `/api/reports/${id}/reporters`,
    assign: (id: number | string) => `/api/reports/${id}/assign`,
  },

  technicianSkills: {
    create: '/api/technician-skills',
  },

  technicianContracts: {
    create: '/api/technician-contracts',
  },

  technicians: {
    list: '/api/technicians',
  },

  contractRequests: {
    list: '/api/technician-contract-requests',
    create: '/api/technician-contract-requests',
    bySite: (siteId: number | string) =>
      `/api/technician-contract-requests?siteId=${encodeURIComponent(siteId)}`,
    decide: (id: number | string) =>
      `/api/technician-contract-requests/${id}/decision`,
  },

  shop: {
    catalog: '/api/shop/catalog',
    quote: '/api/shop/checkout/quote',
    orders: '/api/shop/orders',
    order: (publicId: string) =>
      `/api/shop/orders/${encodeURIComponent(publicId)}`,
    cancel: (publicId: string) =>
      `/api/shop/orders/${encodeURIComponent(publicId)}/cancel`,
    devCompletePayment: (publicId: string) =>
      `/api/shop/payments/dev/complete/${encodeURIComponent(publicId)}`,
  },
} as const;

/*
 * Not implemented by the backend, therefore not exposed anywhere in the app:
 *
 *   POST   /api/reports/{id}/photos
 *   DELETE /api/reports/{id}/photos/{photoId}
 *   PATCH  /api/reports/{id}/status
 *   POST   /api/reports/{id}/confirm
 *   POST   /api/reports/{id}/reopen
 *   PATCH  /api/reports/{id}/urgency
 *   POST   /api/reports/{id}/reassign
 *   GET    /api/technicians/me/availability
 *   GET    /api/reports/assigned-to-me
 *   GET    /api/reports/claimable
 *   GET    /api/technician-skills
 *   GET    /api/technician-contracts
 *
 * Screens must not offer an affordance that depends on these.
 */
