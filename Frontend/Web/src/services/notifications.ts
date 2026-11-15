import { request } from './api';

/** Notification kinds the backend can push into a user's inbox. */
export type NoticeType =
  | 'report_edited'
  | 'report_deleted'
  | 'work_completed'
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
  | 'report_unattended';

export type ReportNotice = {
  id: number;
  reportId: number | null;
  /** Secondary id the notice deep-links to (listing, contract request, technician). */
  referenceId?: number | null;
  type: NoticeType;
  createdAt: string;
};

export function listNotifications(page: number) {
  return request<{ content: ReportNotice[]; hasMore: boolean }>(`/api/notifications?page=${page}`);
}

/** Inbox title + detail copy keys (English source strings for `t()`). */
const NOTICE_COPY: Record<NoticeType, { title: string; detail: string }> = {
  report_assigned: {
    title: 'Job assigned',
    detail: 'Report #{id} was assigned to you.',
  },
  technician_assigned: {
    title: 'Technician assigned',
    detail: 'A technician was assigned to report #{id}.',
  },
  work_completed: {
    title: 'Work completed',
    detail: 'Report #{id} is ready for your confirmation.',
  },
  report_edited: {
    title: 'Report updated',
    detail: 'Report #{id} was edited.',
  },
  report_deleted: {
    title: 'Report archived',
    detail: 'Report #{id} was archived.',
  },
  report_unattended: {
    title: 'Unattended report',
    detail: 'Report #{id} still needs attention at your site.',
  },
  job_posted: {
    title: 'Marketplace job posted',
    detail: 'A new marketplace job matching your skills is open.',
  },
  contract_submitted: {
    title: 'New site contract request',
    detail: 'A technician applied for a site contract.',
  },
  contract_approved: {
    title: 'Site contract approved',
    detail: 'Your site contract request was approved.',
  },
  contract_rejected: {
    title: 'Site contract rejected',
    detail: 'Your site contract request was rejected.',
  },
  verification_submitted: {
    title: 'Verification submitted',
    detail: 'A technician verification is ready for review.',
  },
  verification_verified: {
    title: 'Verification approved',
    detail: 'Your technician verification was approved.',
  },
  verification_rejected: {
    title: 'Verification rejected',
    detail: 'Your technician verification was rejected.',
  },
  verification_suspended: {
    title: 'Verification suspended',
    detail: 'Your technician verification was suspended.',
  },
  terms_required: {
    title: 'Terms acceptance required',
    detail: 'Accept the technician terms to continue taking work.',
  },
  vetting_approved: {
    title: 'Site vetting approved',
    detail: 'You are cleared to work at this site.',
  },
  vetting_revoked: {
    title: 'Site vetting revoked',
    detail: 'Your clearance for this site was revoked.',
  },
};

export function noticeCopy(type: NoticeType): { title: string; detail: string } {
  return NOTICE_COPY[type] ?? {
    title: 'Notification',
    detail: 'Open your inbox for details.',
  };
}

/** Deep-link for a notice, or undefined when there is nowhere useful to go. */
export function noticePath(notice: Pick<ReportNotice, 'type' | 'reportId'>): string | undefined {
  switch (notice.type) {
    case 'report_deleted':
      return undefined;
    case 'contract_submitted':
      return '/team?tab=contracts';
    case 'contract_approved':
    case 'contract_rejected':
    case 'vetting_approved':
    case 'vetting_revoked':
      return '/contracts';
    case 'job_posted':
      return '/marketplace';
    case 'verification_submitted':
      return '/technician-verifications';
    case 'verification_verified':
    case 'verification_rejected':
    case 'verification_suspended':
    case 'terms_required':
      return '/technician';
    default:
      return notice.reportId == null ? undefined : `/reports/${notice.reportId}`;
  }
}
