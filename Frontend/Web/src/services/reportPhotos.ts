import { request } from './api';
import { API_BASE_URL } from '@/constants/config';
import type { ReportPhoto } from '@/types/maintenance';

// Upload constraints from ReportPhotoValidator; the API enforces them again.
export const REPORT_PHOTO_LIMIT = 5;
export const REPORT_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const REPORT_PHOTO_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];
export function validateReportPhoto(file: File) {
  if (!file.size) throw new Error('Choose a non-empty photo.');
  if (file.size > REPORT_PHOTO_MAX_BYTES) throw new Error('Each photo must be at most 5 MiB.');
  if (!REPORT_PHOTO_TYPES.includes(file.type.toLowerCase())) throw new Error('Choose a JPEG, PNG, WebP, GIF, or HEIC photo.');
}
export function safePhotoUrl(value: string | null): string | undefined {
  if (!value) return undefined;
  if (/^\/api\/reports\/\d+\/photos\/\d+\/content$/.test(value)) return API_BASE_URL + value;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}
export const listReportPhotos = (id: number) => request<ReportPhoto[]>(`/api/reports/${id}/photos`);
export function uploadReportPhoto(id: number, file: File) {
  validateReportPhoto(file);
  const body = new FormData(); body.append('file', file);
  return request<ReportPhoto>(`/api/reports/${id}/photos`, { method: 'POST', body });
}
export const removeReportPhoto = (id: number, photoId: number) => request<void>(`/api/reports/${id}/photos/${photoId}`, { method: 'DELETE' });
export const refreshReportPhotoUrl = (id: number, photoId: number) => request<{ url: string }>(`/api/reports/${id}/photos/${photoId}`);
