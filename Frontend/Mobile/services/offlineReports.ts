import { ApiError } from '@/lib/apiClient';
import {
  listQueuedReports,
  removeQueuedReport,
  type QueuedReport,
} from '@/lib/offlineQueue';
import { uploadPhoto } from '@/services/photos';
import { createReport } from '@/services/reports';
import type { Report } from '@/types';

/**
 * Network failures throw a plain `Error` (RN fetch / browser TypeError); the
 * API layer throws `ApiError` for any server response. Kept in one place so
 * the form and the queue agree on what "offline" means.
 */
export function isNetworkFailure(err: unknown): boolean {
  if (err instanceof ApiError) {
    // ApiError with status 0 exists only for transport-level failures on
    // some platforms; anything with a real HTTP status is a server answer.
    return err.status === 0;
  }
  if (!(err instanceof Error)) return false;
  const message = (err.message ?? '').toLowerCase();
  return (
    message.includes('network request failed') ||
    message.includes('networkerror') ||
    message.includes('timeout') ||
    message.includes('connection refused') ||
    message.includes('unable to resolve') ||
    message.includes('cannot connect') ||
    message.includes('failed to fetch')
  );
}

export type FlushResult = {
  submitted: number;
  /** Still queued because the network was unavailable. */
  pending: number;
  /** Dropped because the server rejected the payload (validation/permission). */
  dropped: number;
};

async function submitQueuedReport(entry: QueuedReport): Promise<Report> {
  const report = await createReport(entry.payload);
  // Photos are best-effort: a cache URI can expire across a restart, and
  // losing one image must not lose the whole report.
  for (const photo of entry.photos) {
    try {
      await uploadPhoto(report.id, photo.uri, photo.fileName, photo.mimeType);
    } catch {
      // Skip an unreachable cached photo.
    }
  }
  return report;
}

/**
 * Sends everything in the offline queue, oldest first. Network failures stay
 * queued for the next reconnect; 4xx responses are dropped so one invalid
 * entry cannot block the queue forever.
 */
export async function flushReportQueue(): Promise<FlushResult> {
  const queued = await listQueuedReports();
  let submitted = 0;
  let pending = 0;
  let dropped = 0;

  for (const entry of queued) {
    try {
      await submitQueuedReport(entry);
      await removeQueuedReport(entry.id);
      submitted += 1;
    } catch (err) {
      if (isNetworkFailure(err)) {
        pending += 1;
      } else {
        await removeQueuedReport(entry.id);
        dropped += 1;
      }
    }
  }

  return { submitted, pending, dropped };
}
