import type { Urgency } from './index';

export type ReportStatus = 'open' | 'routed' | 'assigned' | 'in_progress' | 'resolved_pending_confirmation' | 'confirmed' | 'reopened' | 'escalated';
export type SiteType = 'school' | 'hostel' | 'hotel';
export interface Site {
  id: number; name: string; type: SiteType; contractStatus: 'contracted' | 'uncontracted';
  address: string | null; description: string | null; imageUrl: string | null;
  createdAt: string; updatedAt: string;
}
export interface SiteRule {
  id: number; siteType: SiteType; category: string; urgencyWeight: number | null; sortOrder: number | null;
}
export interface Subsite {
  id: number; siteId: number; label: string; name: string;
  description: string | null; archivedAt: string | null;
}
export interface SubsitePayload { label: string; name: string; description: string | null }
export interface SubsiteAlert {
  id: number; siteId: number; requestedByUserId: number;
  note: string | null; status: 'pending' | 'resolved'; createdAt: string;
}
export type ReportVisibility = 'public' | 'private';
export interface Report {
  visibility?: ReportVisibility;
  id: number; siteId: number | null; subsiteId: number | null; createdByUserId: number | null; createdByName: string | null;
  description: string; address: string | null; category: string; specialty: string | null;
  aiUrgency: Urgency | null; reporterUrgency: Urgency; reporterReason: string | null; finalUrgency: Urgency | null; calculatedUrgency?: Urgency | null; participationCount?: number;
  status: ReportStatus; assignedTechnicianId: number | null; editable: boolean; reopenCount: number;
  createdAt: string; updatedAt: string;
  policy?: {
    statusGroup: string; effectiveUrgency: Urgency; urgent: boolean;
    inAssignmentQueue: boolean; participant: boolean; canSeeSensitive: boolean;
    canAssign: boolean; canJoin: boolean; canEdit?: boolean; canDelete?: boolean;
  };
  photos?: ReportPhoto[];
  reopenReason?: string | null;
  confirmedByUserId?: number | null;
  confirmedByName?: string | null;
  confirmedAt?: string | null;
  aiReport?: { urgency: Urgency | null; category: string | null; specialty: string | null; description: string | null; urgencyReason: string | null };
  visionJob?: ReportVisionJob | null;
}
export interface ReportPhoto {
  id: number; objectKey: string; url: string | null; contentType: string;
  fileSizeBytes: number; sortOrder: number; createdAt: string; retrievalPath: string;
}
export interface ReportPage {
  content: Report[]; page: number; size: number; totalElements: number; totalPages: number;
}
export interface CreateReportPayload {
  visibility?: ReportVisibility;
  description: string; address?: string; category: string; specialty?: string;
  reporterUrgency: Urgency; reporterReason?: string; siteId: number; subsiteId?: number;
}
export interface ReportReporter { reportId: number; userId: number; joinedAt: string; name?: string | null }
export interface ReportVisionJob {
  jobId: string; reportId: number;
  status: 'queued' | 'processing' | 'completed' | 'review_required' | 'stale' | 'failed';
  model: string | null;
}
export type SitePayload = Pick<Site, 'name' | 'type' | 'contractStatus' | 'address' | 'description' | 'imageUrl'>;
