import { beforeEach, expect, it, vi } from 'vitest';
import { request } from '../src/services/api';
import { askReportAssistant } from '../src/services/reportAssistant';
vi.mock('../src/services/api', () => ({ request: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
it('uses the published report assistant route and message body', async () => {
  vi.mocked(request).mockResolvedValue({ reply: 'Recorded status: assigned.', fallback: false });
  await askReportAssistant(91, [{ role: 'user', content: 'Status?' }]);
  expect(request).toHaveBeenCalledWith('/api/reports/91/assistant', {
    method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: 'Status?' }] }),
  });
});
it('rejects oversized history before sending it', async () => {
  await expect(askReportAssistant(91, Array.from({ length: 21 }, () => ({ role: 'user' as const, content: 'Question' })))).rejects.toThrow();
  await expect(askReportAssistant(91, [{ role: 'user', content: 'x'.repeat(2001) }])).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
});
it('rejects malformed success responses and preserves an explicit fallback', async () => {
  vi.mocked(request).mockResolvedValue({ reply: null, fallback: false });
  await expect(askReportAssistant(91, [{ role: 'user', content: 'Question' }])).rejects.toThrow('incomplete');
  vi.mocked(request).mockResolvedValue({ reply: null, fallback: true });
  await expect(askReportAssistant(91, [{ role: 'user', content: 'Question' }])).resolves.toEqual({ reply: null, fallback: true });
});
