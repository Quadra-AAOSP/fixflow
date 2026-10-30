// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import TechnicianAssignmentPanel from '../src/components/technician/TechnicianAssignmentPanel.vue';
import { useAuthStore } from '../src/stores/auth';
import * as api from '../src/services/technician';
import { assignTechnician } from '../src/services/maintenance';
import { report } from './fixtures';
import type { TechnicianRanking, TechnicianSummary } from '../src/types/technician';

vi.mock('../src/services/technician', () => ({ listTechnicians: vi.fn(), rankTechnicians: vi.fn() }));
vi.mock('../src/services/maintenance', () => ({ assignTechnician: vi.fn() }));
const person: TechnicianSummary = { id: 54, firstName: 'Alex', lastName: 'Rivera', email: 'test@example.invalid', phone: null,
  availabilityStatus: 'available', skills: [{ id: 1, category: 'plumbing', specialty: null, proficiency: 4 }],
  contracts: [{ siteId: 7, siteName: 'Test site', createdAt: '' }] };
const ranking: TechnicianRanking = { reportId: 1, requestedMode: 'STANDARD', methodUsed: 'STANDARD', fallbackReason: null,
  candidates: [{ technicianId: 54, proficiency: 4, specialtyMatch: false, activeCases: 3, score: 76.25 }] };
let wrapper: VueWrapper;
beforeEach(() => {
  setActivePinia(createPinia()); vi.resetAllMocks();
  useAuthStore().user = { id: 5, role: 'admin', siteId: 7,
    firstName: 'Test', lastName: 'Admin', email: 'admin@example.invalid', phone: null, address: null };
  vi.mocked(api.listTechnicians).mockResolvedValue([{ ...person }]);
  vi.mocked(api.rankTechnicians).mockResolvedValue({ ...ranking });
  vi.mocked(assignTechnician).mockResolvedValue(report({ assignedTechnicianId: 54, status: 'assigned' }));
});
afterEach(() => wrapper?.unmount());

describe('ranked technician assignment', () => {
  it('shows server workloads and assigns only a selected returned candidate', async () => {
    wrapper = mount(TechnicianAssignmentPanel, { props: { report: report() } }); await flushPromises();
    expect(api.rankTechnicians).toHaveBeenCalledWith(1, 'STANDARD');
    expect(wrapper.text()).toContain('Alex Rivera');
    expect(wrapper.text()).toContain('3 active cases at this site');
    await wrapper.setProps({ report: report({ address: 'Room 2' }) }); await flushPromises();
    expect(api.rankTechnicians).toHaveBeenCalledTimes(1);
    await wrapper.get('form').trigger('submit');
    expect(assignTechnician).not.toHaveBeenCalled();
    await wrapper.get('input[type="radio"]').setValue(true);
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(assignTechnician).toHaveBeenCalledWith(1, 54);
    expect(wrapper.emitted('saved')?.[0]?.[0]).toMatchObject({ assignedTechnicianId: 54 });
  });
  it('displays the actual standard fallback when AI ranking is unavailable', async () => {
    wrapper = mount(TechnicianAssignmentPanel, { props: { report: report() } }); await flushPromises();
    vi.mocked(api.rankTechnicians).mockResolvedValue({ ...ranking, requestedMode: 'AI', fallbackReason: 'AI ranking is not configured; deterministic ranking used' });
    await wrapper.get('select').setValue('AI'); await flushPromises();
    expect(api.rankTechnicians).toHaveBeenLastCalledWith(1, 'AI');
    expect(wrapper.text()).toContain('Requested: AI · Method used: STANDARD');
    expect(wrapper.get('[role="status"]').text()).toContain('deterministic ranking used');
  });
  it('shows staff matching contracted directory choices without calling the admin ranking endpoint', async () => {
    useAuthStore().user!.role = 'staff';
    vi.mocked(api.listTechnicians).mockResolvedValue([person, { ...person, id: 99, contracts: [] }]);
    wrapper = mount(TechnicianAssignmentPanel, { props: { report: report() } }); await flushPromises();
    expect(api.rankTechnicians).not.toHaveBeenCalled();
    expect(wrapper.findAll('input[type="radio"]')).toHaveLength(1);
    expect(wrapper.text()).toContain('workload counts require administrator access');
  });
  it('discards a ranking response for a report that has been left', async () => {
    let finish!: (value: TechnicianRanking) => void;
    vi.mocked(api.rankTechnicians).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    wrapper = mount(TechnicianAssignmentPanel, { props: { report: report() } });
    vi.mocked(api.rankTechnicians).mockResolvedValue({ ...ranking, reportId: 2, candidates: [] });
    await wrapper.setProps({ report: report({ id: 2 }) }); await flushPromises();
    finish(ranking); await flushPromises();
    expect(wrapper.find('input[type="radio"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('No matching available');
  });
  it('does not request candidate data for reporters', async () => {
    useAuthStore().user!.role = 'reporter';
    wrapper = mount(TechnicianAssignmentPanel, { props: { report: report() } }); await flushPromises();
    expect(api.listTechnicians).not.toHaveBeenCalled();
    expect(api.rankTechnicians).not.toHaveBeenCalled();
  });
});
