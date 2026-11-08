import { api } from '@/lib/apiClient';

export type ReportNotice = {
  id: number;
  reportId: number;
  type: 'report_edited' | 'report_deleted';
  createdAt: string;
};

export function listNotifications(page: number) {
  return api.get<{ content: ReportNotice[]; hasMore: boolean }>(`/api/notifications?page=${page}`);
}
