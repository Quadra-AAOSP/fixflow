import { afterEach, describe, expect, it, vi } from 'vitest';
import { addTechnicianSkill } from '../src/services/technician';

afterEach(() => vi.unstubAllGlobals());
describe('technician trade submission', () => {
  it('saves supplied skills with the actual technician ID and explicit proficiency', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 9, category: 'electrical', specialty: 'lighting', proficiency: 4 })));
    vi.stubGlobal('fetch', fetch);
    const result = await addTechnicianSkill(28, ' electrical ', ' lighting ', '4');
    expect(result.id).toBe(9);
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/technician-skills');
    expect(JSON.parse(fetch.mock.calls[0]?.[1].body)).toEqual({ technicianId: 28, category: 'electrical', specialty: 'lighting', proficiency: 4 });
  });
  it('does not silently assign a proficiency or submit incomplete skills', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    for (const level of ['', '0', '6', '2.5']) expect(() => addTechnicianSkill(28, 'electrical', 'lighting', level)).toThrow('proficiency');
    expect(() => addTechnicianSkill(28, '', 'lighting', '3')).toThrow('trade');
    expect(() => addTechnicianSkill(28, 'electrical', '', '3')).toThrow('specialty');
    expect(fetch).not.toHaveBeenCalled();
  });
});
