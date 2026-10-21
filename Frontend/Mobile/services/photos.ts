import { api } from '@/lib/apiClient';
import { endpoints } from '@/lib/endpoints';
import type { ReportPhoto } from '@/types';

const BASE = 5 * 1024 * 1024; // 5 MB server cap

/**
 * Lists photos attached to a report.
 */
export function listPhotos(reportId: number): Promise<ReportPhoto[]> {
  return api.get<ReportPhoto[]>(
    endpoints.reports.photos.list.replace('{id}', String(reportId)),
  );
}

/**
 * Uploads a single photo to a report. The caller must validate that the file
 * is an image and ≤ 5MB before calling — the backend rejects anything else.
 */
export function uploadPhoto(
  reportId: number,
  fileUri: string,
  filename: string,
  contentType: string,
): Promise<ReportPhoto> {
  const form = new FormData();
  // React Native FormData expects `uri`, `type`, `name` on the file blob.
  // We use any because React Native's FormData typing differs from the web.
  const fileBlob: any = {
    uri: fileUri,
    name: filename,
    type: contentType,
  };
  form.append('file', fileBlob);
  return api.post<ReportPhoto>(
    endpoints.reports.photos.upload.replace('{id}', String(reportId)),
    undefined,
    { body: form },
  );
}

/**
 * Deletes a photo by id. Server returns 204 empty — the caller drops the
 * local entry on success.
 */
export function deletePhoto(reportId: number, photoId: number): Promise<void> {
  return api.del<void>(
    endpoints.reports.photos.delete
      .replace('{id}', String(reportId))
      .replace('{photoId}', String(photoId)),
  );
}

/** Max file size the server accepts (5 MB). */
export const MAX_PHOTO_SIZE_BYTES = BASE;

/** Max photo count per report. */
export const MAX_PHOTO_COUNT = 5;
