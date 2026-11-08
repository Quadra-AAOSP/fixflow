import { describe, expect, it } from 'vitest';
import { appendReportPage, createReportPageRequests, createRequestGate, nextReportPage } from '../utils/requestGate';

describe('report pagination', () => {
  it('requests the next page once, retries an unsuccessful append and deduplicates rows', () => {
    const requests = createReportPageRequests();
    const initial = requests.begin(0)!;
    expect(requests.finish(initial)).toBe(true);
    const page = nextReportPage(0, 2)!;
    const failedAppend = requests.begin(page)!;
    expect(page).toBe(1);
    expect(requests.begin(page)).toBeNull();
    expect(requests.finish(failedAppend)).toBe(true);
    const retry = requests.begin(nextReportPage(0, 2)!)!;
    expect(requests.finish(retry)).toBe(true);
    expect(appendReportPage([{ id: 1 }], [{ id: 1 }, { id: 2 }])).toEqual([{ id: 1 }, { id: 2 }]);
    expect(nextReportPage(1, 2)).toBeNull();
  });

  it('prevents an old append from committing or releasing the new page request', () => {
    const requests = createReportPageRequests();
    const old = requests.begin(1)!;
    requests.invalidate();
    const replacement = requests.begin(1)!;
    expect(requests.finish(old)).toBe(false);
    expect(requests.begin(1)).toBeNull();
    expect(requests.finish(replacement)).toBe(true);
  });
});

it('discards deferred results from an obsolete identity and after logout', async () => {
  const gate = createRequestGate();
  const committed: string[] = [];
  let resolveOld!: () => void;
  const first = gate.begin();
  const old = new Promise<void>(resolve => { resolveOld = resolve; }).then(() => {
    if (gate.current(first)) committed.push('old');
  });
  gate.invalidate();
  const second = gate.begin();
  if (gate.current(second)) committed.push('new');
  resolveOld();
  await old;
  gate.invalidate();
  expect(gate.current(second)).toBe(false);
  expect(committed).toEqual(['new']);
});
