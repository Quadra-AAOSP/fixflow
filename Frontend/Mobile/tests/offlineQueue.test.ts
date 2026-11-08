import { describe, expect, it } from 'vitest';

import {
  OFFLINE_QUEUE_LIMIT,
  enqueueReport,
  listQueuedReports,
  removeQueuedReport,
  type QueueStore,
} from '../lib/offlineQueue';
import type { CreateReportPayload } from '../types';

const payload: CreateReportPayload = {
  description: 'Broken light in the corridor',
  category: 'electrical',
  reporterUrgency: 'medium',
  siteId: 7,
};

function memoryStore(): QueueStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    read: async <T,>(key: string) => (data.get(key) as T | undefined) ?? null,
    write: async (key: string, value: unknown) => {
      data.set(key, value);
    },
  };
}

describe('offline report queue', () => {
  it('starts empty', async () => {
    expect(await listQueuedReports(memoryStore())).toEqual([]);
  });

  it('enqueues a report with its photos and a stable id', async () => {
    const store = memoryStore();
    const entry = await enqueueReport(
      payload,
      [{ uri: 'file:///photo.jpg', fileName: 'photo.jpg', mimeType: 'image/jpeg' }],
      store,
    );
    const queued = await listQueuedReports(store);
    expect(queued).toHaveLength(1);
    expect(queued[0].id).toBe(entry.id);
    expect(queued[0].payload.description).toBe(payload.description);
    expect(queued[0].photos[0].fileName).toBe('photo.jpg');
  });

  it('removes one entry without touching the rest', async () => {
    const store = memoryStore();
    const first = await enqueueReport(payload, [], store);
    await enqueueReport({ ...payload, description: 'Second' }, [], store);
    await removeQueuedReport(first.id, store);
    const queued = await listQueuedReports(store);
    expect(queued).toHaveLength(1);
    expect(queued[0].payload.description).toBe('Second');
  });

  it('caps the queue, dropping the oldest entries', async () => {
    const store = memoryStore();
    for (let index = 0; index < OFFLINE_QUEUE_LIMIT + 3; index += 1) {
      await enqueueReport({ ...payload, description: `Report ${index}` }, [], store);
    }
    const queued = await listQueuedReports(store);
    expect(queued).toHaveLength(OFFLINE_QUEUE_LIMIT);
    expect(queued[0].payload.description).toBe('Report 3');
  });
});
