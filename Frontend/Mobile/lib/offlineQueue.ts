import type { CreateReportPayload } from '@/types';

export type QueuedPhoto = {
  uri: string;
  fileName: string;
  mimeType: string;
};

export type QueuedReport = {
  id: string;
  payload: CreateReportPayload;
  photos: QueuedPhoto[];
  createdAt: string;
};

const STORAGE_KEY = 'fixflow.offline.reports.v1';
const MAX_QUEUE = 10;

/**
 * Offline report queue. Only network failures are queued — validation and
 * permission errors must stay inline in the form. The queue survives a restart
 * and is capped so a long offline session cannot grow without bound.
 *
 * Kept pure of network/storage concerns (except the two tiny helpers) so the
 * behaviour can be unit tested with an injected store.
 */
export type QueueStore = {
  read: <T>(key: string) => Promise<T | null>;
  write: (key: string, value: unknown) => Promise<void>;
};

/**
 * Default store resolves the native persistence layer lazily so importing this
 * module (e.g. from Node-based unit tests) never pulls in React Native.
 */
const defaultStore: QueueStore = {
  read: async <T>(key: string) => {
    const { readJson } = await import('@/lib/persist');
    return readJson<T>(key);
  },
  write: async (key: string, value: unknown) => {
    const { writeJson } = await import('@/lib/persist');
    await writeJson(key, value);
  },
};

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listQueuedReports(
  store: QueueStore = defaultStore,
): Promise<QueuedReport[]> {
  const stored = await store.read<QueuedReport[]>(STORAGE_KEY);
  return Array.isArray(stored) ? stored : [];
}

export async function enqueueReport(
  payload: CreateReportPayload,
  photos: QueuedPhoto[],
  store: QueueStore = defaultStore,
): Promise<QueuedReport> {
  const entry: QueuedReport = {
    id: makeId(),
    payload,
    photos,
    createdAt: new Date().toISOString(),
  };
  const queued = await listQueuedReports(store);
  await store.write(STORAGE_KEY, [...queued, entry].slice(-MAX_QUEUE));
  return entry;
}

export async function removeQueuedReport(
  id: string,
  store: QueueStore = defaultStore,
): Promise<void> {
  const queued = await listQueuedReports(store);
  await store.write(
    STORAGE_KEY,
    queued.filter((entry) => entry.id !== id),
  );
}

export async function clearQueuedReports(
  store: QueueStore = defaultStore,
): Promise<void> {
  await store.write(STORAGE_KEY, []);
}

export const OFFLINE_QUEUE_LIMIT = MAX_QUEUE;
