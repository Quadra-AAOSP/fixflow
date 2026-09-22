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
export interface Report {
  id: number; siteId: number | null; createdByUserId: number | null; createdByName: string | null;
  description: string; address: string | null; category: string; specialty: string | null;
  aiUrgency: Urgency | null; reporterUrgency: Urgency; reporterReason: string | null; finalUrgency: Urgency | null;
  status: ReportStatus; assignedTechnicianId: number | null; editable: boolean; reopenCount: number;
  createdAt: string; updatedAt: string;
}
export interface CreateReportPayload {
  description: string; address?: string; category: string; specialty?: string;
  reporterUrgency: Urgency; reporterReason?: string; siteId: number;
}
export interface ReportReporter { reportId: number; userId: number; joinedAt: string }
export type SitePayload = Pick<Site, 'name' | 'type' | 'contractStatus' | 'address' | 'description' | 'imageUrl'>;
