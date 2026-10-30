// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import TechnicianAvailabilityPanel from '../src/components/technician/TechnicianAvailabilityPanel.vue';
import { useAuthStore } from '../src/stores/auth';
import * as api from '../src/services/technician';

vi.mock('../src/services/technician', () => ({ getTechnicianAvailability: vi.fn(), setTechnicianAvailability: vi.fn() }));
let wrapper: VueWrapper;
beforeEach(() => {
  setActivePinia(createPinia()); vi.resetAllMocks();
  useAuthStore().user = { id: 54, role: 'technician', siteId: null,
    firstName: 'Test', lastName: 'Technician', email: 'test@example.invalid', phone: null, address: null };
  vi.mocked(api.getTechnicianAvailability).mockResolvedValue({ technicianId: 54, status: 'unavailable', updatedAt: null });
});
afterEach(() => wrapper?.unmount());
describe('technician availability interaction', () => {
  it('loads real status and saves an explicit availability change', async () => {
    wrapper = mount(TechnicianAvailabilityPanel); await flushPromises();
    expect(wrapper.get('[role="switch"]').attributes('aria-checked')).toBe('false');
    vi.mocked(api.setTechnicianAvailability).mockResolvedValue({ technicianId: 54, status: 'available', updatedAt: '2026-10-30T08:00:00Z' });
    await wrapper.get('[role="switch"]').trigger('click'); await flushPromises();
    expect(api.setTechnicianAvailability).toHaveBeenCalledWith('available');
    expect(wrapper.get('[role="switch"]').attributes('aria-checked')).toBe('true');
  });
  it('retains the saved state when an update fails', async () => {
    wrapper = mount(TechnicianAvailabilityPanel); await flushPromises();
    vi.mocked(api.setTechnicianAvailability).mockRejectedValue(new Error('Update failed'));
    await wrapper.get('[role="switch"]').trigger('click'); await flushPromises();
    expect(wrapper.get('[role="switch"]').attributes('aria-checked')).toBe('false');
    expect(wrapper.get('[role="alert"]').text()).toBe('Update failed');
  });
  it('does not invent an availability state if loading fails', async () => {
    vi.mocked(api.getTechnicianAvailability).mockRejectedValue(new Error('Unavailable service'));
    wrapper = mount(TechnicianAvailabilityPanel); await flushPromises();
    expect(wrapper.find('[role="switch"]').exists()).toBe(false);
    expect(wrapper.get('[role="alert"]').text()).toBe('Unavailable service');
  });
});
