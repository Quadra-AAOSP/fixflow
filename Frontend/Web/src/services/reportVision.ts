import { request } from './api';
import type { ReportVisionJob } from '@/types/maintenance';

export function validateVisionImage(image: File) {
  if (!image.size || image.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/jpg', 'image/png'].includes(image.type.toLowerCase())) {
    throw new Error('Choose one non-empty JPEG or PNG image up to 5 MiB.');
  }
}
export function enqueueReportVision(reportId: number, image: File, consent: boolean) {
  if (!consent) throw new Error('Explicit consent is required for AI image processing.');
  validateVisionImage(image);
  const body = new FormData(); body.append('image', image); body.append('consent', 'true');
  return request<ReportVisionJob>(`/api/reports/${reportId}/vision`, { method: 'POST', body });
}
export const getReportVisionJob = (reportId: number, jobId: string) => request<ReportVisionJob>(`/api/reports/${reportId}/vision/${encodeURIComponent(jobId)}`);
