import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  acceptJobOffer,
  counterJobOffer,
  createJobOffer,
  listJobOffers,
  listMyJobOffers,
  rejectJobOffer,
} from '../services/jobOffers';
import { endpoints } from '../lib/endpoints';

vi.mock('../lib/apiClient', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { api } from '../lib/apiClient';

afterEach(() => vi.clearAllMocks());

describe('jobOffers service', () => {
  it('lists report and technician offers through the job-offer endpoints', async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    await listJobOffers(9);
    await listMyJobOffers();
    expect(api.get).toHaveBeenNthCalledWith(1, endpoints.jobOffers.forReport(9));
    expect(api.get).toHaveBeenNthCalledWith(2, endpoints.jobOffers.mine);
  });

  it('creates and responds to paid offers with amount payloads', async () => {
    vi.mocked(api.post).mockResolvedValue({ id: 1 });
    await createJobOffer(9, { technicianId: 4, amountMinor: 12500, currency: 'USD', note: 'Priority' });
    await acceptJobOffer(9, 1);
    await rejectJobOffer(9, 1, 'Unavailable');
    await counterJobOffer(9, 1, 15000, 'Need more');
    expect(api.post).toHaveBeenNthCalledWith(1, endpoints.jobOffers.forReport(9), {
      technicianId: 4,
      amountMinor: 12500,
      currency: 'USD',
      note: 'Priority',
    });
    expect(api.post).toHaveBeenNthCalledWith(2, endpoints.jobOffers.accept(9, 1));
    expect(api.post).toHaveBeenNthCalledWith(3, endpoints.jobOffers.reject(9, 1), {
      note: 'Unavailable',
    });
    expect(api.post).toHaveBeenNthCalledWith(4, endpoints.jobOffers.counter(9, 1), {
      amountMinor: 15000,
      note: 'Need more',
    });
  });
});
