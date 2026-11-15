import { stubApiFetch } from './csrfFetch';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addTechnicianSkill, getTechnicianAvailability, listTechnicians, rankTechnicians, setTechnicianAvailability } from '../src/services/technician';

afterEach(() => vi.unstubAllGlobals());
describe('technician trade submission', () => {
  it('reads and updates only the signed-in technician availability', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response('{}'))); stubApiFetch(fetch);
    await getTechnicianAvailability();
    await setTechnicianAvailability('available');
    expect(fetch.mock.calls.map(call => String(call[0]))).toEqual([
      expect.stringMatching(/\/api\/technicians\/me\/availability$/),
      expect.stringMatching(/\/api\/technicians\/me\/availability$/),
    ]);
    expect(fetch.mock.calls[1]?.[1].method).toBe('PUT');
    expect(JSON.parse(fetch.mock.calls[1]?.[1].body)).toEqual({ status: 'available' });
  });
  it('loads the directory and requests the chosen ranking mode for the actual report', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response('{}'))); stubApiFetch(fetch);
    await listTechnicians();
    await rankTechnicians(91, 'AI');
    expect(fetch.mock.calls.map(call => String(call[0]))).toEqual([
      expect.stringMatching(/\/api\/technicians$/),
      expect.stringMatching(/\/api\/reports\/91\/technician-ranking$/),
    ]);
    expect(JSON.parse(fetch.mock.calls[1]?.[1].body)).toEqual({ mode: 'AI' });
  });
  it('saves supplied skills with the actual technician ID without client proficiency', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 9, category: 'electrical', specialty: 'lighting', proficiency: 2.5 })));
    stubApiFetch(fetch);
    const result = await addTechnicianSkill(28, ' electrical ', ' lighting ');
    expect(result.id).toBe(9);
    expect(String(fetch.mock.calls[0]?.[0])).toMatch(/\/api\/technician-skills$/);
    expect(JSON.parse(fetch.mock.calls[0]?.[1].body)).toEqual({ technicianId: 28, category: 'electrical', specialty: 'lighting' });
  });
  it('rejects incomplete skills without posting', () => {
    const fetch = vi.fn(); stubApiFetch(fetch);
    expect(() => addTechnicianSkill(28, '', 'lighting')).toThrow('trade');
    expect(() => addTechnicianSkill(28, 'electrical', 'x'.repeat(129))).toThrow('specialty');
    expect(fetch).not.toHaveBeenCalled();
  });
});

it('sends an optional empty specialty as null', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 9, category: 'general', specialty: null, proficiency: 2.5 })));
  stubApiFetch(fetch);
  const saved = await addTechnicianSkill(28, 'general', ' ');
  expect(JSON.parse(fetch.mock.calls[0]?.[1].body)).toEqual({ technicianId: 28, category: 'general', specialty: null });
  expect(saved.specialty).toBeNull();
});
