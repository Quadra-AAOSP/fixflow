import { request } from './api';

export type ReportNotice = {
  id: number;
  reportId: number | null;
  type: 'report_edited' | 'report_deleted' | 'work_completed' | 'contract_submitted' | 'contract_approved' | 'contract_rejected';
  createdAt: string;
};

export function listNotifications(page: number) {
  return request<{ content: ReportNotice[]; hasMore: boolean }>(`/api/notifications?page=${page}`);
}
