import { stubApiFetch } from './csrfFetch';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addTechnicianSkill, getTechnicianAvailability, getTechnicianInvitations, listTechnicians, rankTechnicians, sendTechnicianInvitations, setTechnicianAvailability } from '../src/services/technician';

afterEach(() => vi.unstubAllGlobals());
describe('technician trade submission', () => {
  it('reads and updates only the signed-in technician availability', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response('{}'))); stubApiFetch(fetch);
    await getTechnicianAvailability();
    await setTechnicianAvailability('available');
    expect(fetch.mock.calls.map(call => call[0])).toEqual(['/api/technicians/me/availability', '/api/technicians/me/availability']);
    expect(fetch.mock.calls[1]?.[1].method).toBe('PUT');
    expect(JSON.parse(fetch.mock.calls[1]?.[1].body)).toEqual({ status: 'available' });
  });
  it('reads inbox pages and sends invitations with an explicit reason and batch', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response('{}'))); stubApiFetch(fetch);
    await getTechnicianInvitations(2);
    await sendTechnicianInvitations(91, ' Plumbing expertise ', 3);
    expect(fetch.mock.calls.map(call => call[0])).toEqual(['/api/technician-invitations?page=2', '/api/reports/91/technician-invitations?page=3']);
    expect(JSON.parse(fetch.mock.calls[1]?.[1].body)).toEqual({ reason: 'Plumbing expertise' });
    expect(() => sendTechnicianInvitations(91, '', 0)).toThrow('invitation reason');
  });
  it('loads the directory and requests the chosen ranking mode for the actual report', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response('{}'))); stubApiFetch(fetch);
    await listTechnicians();
    await rankTechnicians(91, 'AI');
    expect(fetch.mock.calls.map(call => call[0])).toEqual(['/api/technicians', '/api/reports/91/technician-ranking']);
    expect(JSON.parse(fetch.mock.calls[1]?.[1].body)).toEqual({ mode: 'AI' });
  });
  it('saves supplied skills with the actual technician ID and explicit proficiency', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 9, category: 'electrical', specialty: 'lighting', proficiency: 4 })));
    stubApiFetch(fetch);
    const result = await addTechnicianSkill(28, ' electrical ', ' lighting ', '4');
    expect(result.id).toBe(9);
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/technician-skills');
    expect(JSON.parse(fetch.mock.calls[0]?.[1].body)).toEqual({ technicianId: 28, category: 'electrical', specialty: 'lighting', proficiency: 4 });
  });
  it('does not silently assign a proficiency or submit incomplete skills', () => {
    const fetch = vi.fn(); stubApiFetch(fetch);
    for (const level of ['', '0', '6', '2.5']) expect(() => addTechnicianSkill(28, 'electrical', 'lighting', level)).toThrow('proficiency');
    expect(() => addTechnicianSkill(28, '', 'lighting', '3')).toThrow('trade');
    expect(() => addTechnicianSkill(28, 'electrical', 'x'.repeat(129), '3')).toThrow('specialty');
    expect(fetch).not.toHaveBeenCalled();
  });
});

it('sends an optional empty specialty as null while keeping an explicit proficiency', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 9, category: 'general', specialty: null, proficiency: 3 })));
  stubApiFetch(fetch);
  const saved = await addTechnicianSkill(28, 'general', ' ', '3');
  expect(JSON.parse(fetch.mock.calls[0]?.[1].body)).toEqual({ technicianId: 28, category: 'general', specialty: null, proficiency: 3 });
  expect(saved.specialty).toBeNull();
});
