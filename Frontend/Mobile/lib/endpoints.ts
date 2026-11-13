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
    /** GET — public list for the registration site picker. */
    sites: '/api/auth/sites',
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
    /** GET — eligible contracted technicians for a site. */
    technicianPool: (siteId: number | string) =>
      `/api/sites/${siteId}/technician-pool`,
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
    leave: (id: number | string) => `/api/reports/${id}/leave`,
    reporters: (id: number | string) => `/api/reports/${id}/reporters`,
    assign: (id: number | string) => `/api/reports/${id}/assign`,
    /** POST — a contracted technician takes an unassigned queue item. */
    claim: (id: number | string) => `/api/reports/${id}/claim`,
    /** POST — assigned technician starts work (assigned/reopened → in_progress). */
    start: (id: number | string) => `/api/reports/${id}/start`,
    /** POST — assigned technician marks work complete; body `{ description }`. */
    resolve: (id: number | string) => `/api/reports/${id}/resolve`,
    /** PATCH — staff/admin final-urgency override; body `{ urgency, reason }`. */
    urgency: (id: number | string) => `/api/reports/${id}/urgency`,
    /** PATCH — reporter/ops edits a still-editable report. */
    update: (id: number | string) => `/api/reports/${id}`,
    /** GET — every status transition recorded for the report. */
    history: (id: number | string) => `/api/reports/${id}/history`,
    /** POST — stateless AI chat about one report; body carries the message history. */
    assistant: (id: number | string) => `/api/reports/${id}/assistant`,
    /** POST — natural-language query → structured filters (NL smart search). */
    searchNl: '/api/reports/search/nl',
    confirm: '/api/reports/{id}/confirm',
    reopen: '/api/reports/{id}/reopen',
    /** POST — manual AI classification (site admins / super admins only). */
    classify: (id: number | string) => `/api/reports/${id}/classify`,
    /** POST — consent-based background image processing. */
    vision: (reportId: number | string) => `/api/reports/${reportId}/vision`,
    /** GET — poll processing status. */
    visionJob: (reportId: number | string, jobId: string) =>
      `/api/reports/${reportId}/vision/${jobId}`,
    /** POST — ranked candidates and active-case counts. */
    technicianRanking: (id: number | string) =>
      `/api/reports/${id}/technician-ranking`,
    photos: {
      list: '/api/reports/{id}/photos',
      upload: '/api/reports/{id}/photos',
      delete: '/api/reports/{id}/photos/{photoId}',
      getUrl: '/api/reports/{id}/photos/{photoId}',
    },
  },

  technicianSkills: {
    create: '/api/technician-skills',
    me: '/api/technician-skills/me',
  },

  technicianContracts: {
    list: '/api/technician-contracts',
    create: '/api/technician-contracts',
    byId: (id: number | string) => `/api/technician-contracts/${id}`,
  },

  technicianTerms: {
    current: '/api/technician-terms/current',
    me: '/api/technician-terms/me',
    byTechnician: (technicianId: number | string) =>
      `/api/technician-terms/${technicianId}`,
    accept: '/api/technician-terms/accept',
  },

  technicians: {
    list: '/api/technicians',
    /** GET/PUT — the signed-in technician's availability status. */
    myAvailability: '/api/technicians/me/availability',
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
    notifications: (page: number) => `/api/shop/notifications?page=${page}`,
    confirmDelivery: (id: string) => `/api/shop/orders/${encodeURIComponent(id)}/confirm-delivery`,
    order: (publicId: string) =>
      `/api/shop/orders/${encodeURIComponent(publicId)}`,
    cancel: (publicId: string) =>
      `/api/shop/orders/${encodeURIComponent(publicId)}/cancel`,
    devCompletePayment: (publicId: string) =>
      `/api/shop/payments/dev/complete/${encodeURIComponent(publicId)}`,
  },

  /** Shop-manager product CRUD (`manageShop` capability). */
  shopAdmin: {
    analytics: '/api/admin/shop/analytics',
    orders: (page: number) => `/api/admin/shop/orders?page=${page}`,
    order: (id: string) => `/api/admin/shop/orders/${encodeURIComponent(id)}`,
    fulfillment: (id: string) => `/api/admin/shop/orders/${encodeURIComponent(id)}/fulfillment`,
    products: '/api/admin/shop/products',
    product: (id: string) => `/api/admin/shop/products/${encodeURIComponent(id)}`,
  },

  assistant: {
    /** POST — pre-filing triage chat; returns reply + optional suggested fields. */
    triage: '/api/assistant/triage',
    /** POST — upload audio (multipart field `audio`) → transcribed text. */
    transcribe: '/api/assistant/transcribe',
  },
} as const;

/*
 * Not implemented by the backend, therefore not exposed anywhere in the app:
 *
 *   PATCH  /api/reports/{id}/status
 *   POST   /api/reports/{id}/reassign   (reassignment reuses `/assign`)
 *   GET    /api/reports/assigned-to-me  (queue is derived from `/api/reports`)
 *   GET    /api/reports/claimable       (queue is derived from `/api/reports`)
 *
 * Implemented elsewhere and therefore wired above: technician availability
 * (`/api/technicians/me/availability`), claim (`/claim`), confirm/reopen,
 * start/resolve, urgency override, report edit, and the photo endpoints.
 *
 * Screens must not offer an affordance that depends on the absent paths.
 */
