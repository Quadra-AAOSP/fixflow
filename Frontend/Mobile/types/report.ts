import type { Urgency } from './common';

/**
 * Mirrors backend `ReportStatus` enum. Transitions beyond the initial
 * `open` → `assigned` are intentionally NOT supported by the current
 * backend; the mobile will only surface the values present here.
 */
export type ReportStatus =
  | 'open'
  | 'routed'
  | 'assigned'
  | 'in_progress'
  | 'resolved_pending_confirmation'
  | 'confirmed'
  | 'reopened'
  | 'escalated';

/**
 * Mirrors backend `ReportResponse`.
 *
 * `createdByUserId`, `createdByName`, `address`, and `reporterReason` are
 * server-masked: they arrive as `null` to peer reporters (i.e. reporters who
 * are not the creator and have not joined the report) and to non-assigned
 * technicians. The mobile must not attempt to reconstruct these client-side
 * or render placeholders that leak their existence.
 */
export type Report = {
  id: number;
  siteId: number | null;
  createdByUserId: number | null;
  createdByName: string | null;
  description: string;
  address: string | null;
  category: string;
  specialty: string | null;
  aiUrgency: Urgency | null;
  reporterUrgency: Urgency;
  reporterReason: string | null;
  finalUrgency: Urgency | null;
  status: ReportStatus;
  assignedTechnicianId: number | null;
  editable: boolean;
  reopenCount: number;
  createdAt: string;
  updatedAt: string;
};

/**
 * Mirrors backend `CreateReportRequest`. `category` must match
 * `SiteRule.category` for the report's site type — the server rejects with 400
 * otherwise (`CategoryTaxonomyService.requireAllowedCategory`).
 */
export type CreateReportPayload = {
  description: string;
  address?: string;
  category: string;
  specialty?: string;
  reporterUrgency: Urgency;
  reporterReason?: string;
  /** Required only for super_admin; non-admins default to their own site. */
  siteId?: number;
};

/** Mirrors backend `ReportReporterResponse`. */
export type ReportReporter = {
  reportId: number;
  userId: number;
  joinedAt: string;
};

/** Mirrors backend `AssignTechnicianRequest`. */
export type AssignTechnicianPayload = {
  technicianId: number;
};