/**
 * Locked API endpoint paths. Centralized here so the contract is auditable
 * in one place and so a contract drift (path rename, new param, etc.) is a
 * single-line change rather than a sweep across services.
 *
 * Paths reflect the backend as of the current implementation:
 *   /api/auth/{login,register,logout,me}
 *   /api/sites, /api/sites/{id}
 *   /api/site-rules
 *   /api/reports, /api/reports/{id}, /api/reports/{id}/join,
 *   /api/reports/{id}/reporters, /api/reports/{id}/assign
 *
 * Endpoints NOT implemented on the backend and intentionally NOT exposed
 * here: photo upload, status transitions, urgency override, reassignment,
 * technician availability self-toggle, claimable/assigned-to-me queues,
 * public site directory. Track in the project audit until the backend ships.
 */

export const endpoints = {
  auth: {
    login: '/api/auth/login',
    register: '/api/auth/register',
    logout: '/api/auth/logout',
    me: '/api/auth/me',
  },
  sites: {
    list: '/api/sites',
    byId: (id: number | string) => `/api/sites/${id}`,
  },
  siteRules: {
    list: '/api/site-rules',
  },
  reports: {
    list: '/api/reports',
    byId: (id: number | string) => `/api/reports/${id}`,
    join: (id: number | string) => `/api/reports/${id}/join`,
    reporters: (id: number | string) => `/api/reports/${id}/reporters`,
    assign: (id: number | string) => `/api/reports/${id}/assign`,
  },
} as const;