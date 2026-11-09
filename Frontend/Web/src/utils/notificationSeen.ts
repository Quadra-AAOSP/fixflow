async function storageGet(key: string) { return localStorage.getItem(key); }
async function storageSet(key: string, value: string) { localStorage.setItem(key, value); }
export type NoticeFeed = 'reports' | 'shop';
type Seen = Record<NoticeFeed, number>;
const cache = new Map<number, Promise<Seen>>();
const listeners = new Set<() => void>();
let writes = Promise.resolve();
const key = (id: number) => `fixflow.notifications.seen.${id}`;
export function subscribeSeen(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function readSeen(id: number): Promise<Seen> {
  if (!cache.has(id)) cache.set(id, (async () => {
    try {
      const value = JSON.parse(await storageGet(key(id)) || '{}');
      return { reports: Number.isSafeInteger(value?.reports) && value.reports > 0 ? value.reports : 0,
        shop: Number.isSafeInteger(value?.shop) && value.shop > 0 ? value.shop : 0 };
    } catch { return { reports: 0, shop: 0 }; }
  })());
  return cache.get(id)!;
}
/** Only call with IDs actually rendered by a successfully loaded inbox page. */
export async function markNoticesSeen(id: number, feed: NoticeFeed, notices: { id: number }[]) {
  const seen = await readSeen(id);
  const newest = notices.reduce((max, notice) => Math.max(max, notice.id), seen[feed]);
  if (newest <= seen[feed]) return;
  seen[feed] = newest;
  const value = JSON.stringify(seen);
  writes = writes.catch(() => {}).then(() => storageSet(key(id), value)).catch(() => {});
  listeners.forEach(listener => listener());
  await writes;
}
