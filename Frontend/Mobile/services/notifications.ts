import { api } from '@/lib/apiClient';

/** Notification kinds the backend can push into a user's inbox. */
export type NoticeType =
  | 'report_edited'
  | 'report_deleted'
  | 'work_completed'
  | 'site_invitation'
  | 'report_assigned'
  | 'technician_assigned'
  | 'verification_submitted'
  | 'verification_verified'
  | 'verification_rejected'
  | 'verification_suspended'
  | 'terms_required'
  | 'contract_submitted'
  | 'contract_approved'
  | 'contract_rejected'
  | 'job_posted'
  | 'vetting_approved'
  | 'vetting_revoked'
  /** A super admin flagged a report that nobody at this site has picked up. */
  | 'report_unattended';

export type ReportNotice = {
  id: number;
  reportId: number | null;
  /** Secondary id the notice deep-links to (listing, contract request, technician). */
  referenceId?: number | null;
  invitationId?: number | null;
  type: NoticeType;
  createdAt: string;
};

export function listNotifications(page: number) {
  return api.get<{ content: ReportNotice[]; hasMore: boolean }>(`/api/notifications?page=${page}`);
}
