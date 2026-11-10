import { request } from './api';

export type ReportNotice = {
  id: number;
  reportId: number | null;
  invitationId?: number | null;
  type: 'report_edited' | 'report_deleted' | 'work_completed' | 'site_invitation';
  createdAt: string;
};

export function listNotifications(page: number) {
  return request<{ content: ReportNotice[]; hasMore: boolean }>(`/api/notifications?page=${page}`);
}
