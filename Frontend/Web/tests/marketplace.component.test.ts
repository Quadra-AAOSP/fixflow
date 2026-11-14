// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, expect, it, vi } from 'vitest';
import MarketplacePublishPanel from '../src/components/technician/MarketplacePublishPanel.vue';
import MarketplaceView from '../src/views/app/MarketplaceView.vue';
import * as marketplace from '../src/services/marketplace';
import { useAuthStore } from '../src/stores/auth';
import type { UserRole } from '../src/types';
import { report } from './fixtures';

vi.mock('../src/services/marketplace', () => ({
  actOnMarketplaceApplication: vi.fn(), applyForMarketplaceJob: vi.fn(), cancelMarketplaceAssignment: vi.fn(), closeMarketplaceJob: vi.fn(),
  listMarketplaceApplicants: vi.fn(), listMarketplaceJobs: vi.fn(), publishMarketplaceJob: vi.fn(),
}));

const applicant: marketplace.MarketplaceApplication = {
  id: 2, technicianId: 3, technicianName: 'Test Technician', note: 'Qualified for this repair.', status: 'pending',
  offerExpiresAt: null, activeCases: 0, completedJobs: 2, averageRating: null,
};
const listing: marketplace.MarketplaceListing = {
  id: 1, reportId: 8, summary: 'Repair a broken fixture', broadLocation: 'West district', timing: 'This week',
  category: 'general', specialty: null, urgency: 'medium', status: 'open', canCancelAssignment: false, expiresAt: '2026-11-12T00:00:00Z', myApplication: null,
};
const global = { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } };

function signIn(role: UserRole) {
  useAuthStore().user = { id: role === 'technician' ? 3 : 4, role, siteId: role === 'admin' ? 7 : null,
    firstName: 'Test', lastName: 'User', email: 'test@example.invalid', phone: null, address: null };
}

beforeEach(() => { vi.resetAllMocks(); setActivePinia(createPinia()); });

it('publishes only the fields written for the public listing and requires a privacy check', async () => {
  signIn('admin');
  vi.mocked(marketplace.publishMarketplaceJob).mockResolvedValue(listing);
  const wrapper = mount(MarketplacePublishPanel, { props: { report: report({ id: 8, siteId: 7, status: 'open', assignedTechnicianId: null, description: 'Private report text' }) }, global });
  expect(wrapper.find('textarea').element.value).toBe('');
  expect(wrapper.find('button[type=submit]').attributes('disabled')).toBeDefined();
  await wrapper.find('textarea').setValue(listing.summary);
  const inputs = wrapper.findAll('input');
  await inputs[0].setValue(listing.broadLocation);
  await inputs[1].setValue(listing.timing);
  await inputs[2].setValue('125.50');
  await wrapper.setProps({ report: report({ id: 8, siteId: 7, status: 'open', assignedTechnicianId: null, description: 'Refreshed private report' }) });
  await wrapper.find('form').trigger('submit');
  expect(marketplace.publishMarketplaceJob).not.toHaveBeenCalled();
  await wrapper.find('input[type=checkbox]').setValue(true);
  await wrapper.find('form').trigger('submit');
  await flushPromises();
  expect(marketplace.publishMarketplaceJob).toHaveBeenCalledWith({
    reportId: 8,
    summary: listing.summary,
    broadLocation: listing.broadLocation,
    timing: listing.timing,
    amountMinor: 12550,
    currency: 'USD',
  });
  expect(wrapper.get('[role=status]').text()).toContain('published');
  wrapper.unmount();
});

it('shows applicants on the listing for site admins and requires confirmation before selecting', async () => {
  signIn('admin');
  vi.mocked(marketplace.listMarketplaceJobs).mockResolvedValue([{ ...listing, applications: [applicant] }]);
  vi.mocked(marketplace.actOnMarketplaceApplication).mockResolvedValue({ ...applicant, status: 'offered' });
  const wrapper = mount(MarketplaceView, { global });
  await flushPromises();
  expect(wrapper.text()).toContain('Test Technician');
  expect(wrapper.text()).toContain('1 applicants');
  const offer = wrapper.findAll('button').find(button => button.text() === 'Send offer')!;
  expect(offer.attributes('disabled')).toBeDefined();
  await wrapper.find('input[type=checkbox]').setValue(true);
  expect(offer.attributes('disabled')).toBeUndefined();
  await offer.trigger('click');
  expect(marketplace.actOnMarketplaceApplication).toHaveBeenCalledWith(1, 2, 'select');
  wrapper.unmount();
});

it('exposes the report link to the technician only after the offer is accepted', async () => {
  signIn('technician');
  vi.mocked(marketplace.listMarketplaceJobs)
    .mockResolvedValueOnce([{ ...listing, reportId: null, status: 'offered', myApplication: { ...applicant, status: 'offered' } }])
    .mockResolvedValueOnce([{ ...listing, status: 'assigned', myApplication: { ...applicant, status: 'accepted' } }]);
  vi.mocked(marketplace.actOnMarketplaceApplication).mockResolvedValue({ ...applicant, status: 'accepted' });
  const wrapper = mount(MarketplaceView, { global });
  await flushPromises();
  expect(wrapper.find('a[href="/reports/8"]').exists()).toBe(false);
  await wrapper.findAll('button').find(button => button.text() === 'Accept offer')!.trigger('click');
  await flushPromises();
  expect(marketplace.actOnMarketplaceApplication).toHaveBeenCalledWith(1, 2, 'accept');
  expect(wrapper.get('a[href="/reports/8"]').text()).toBe('Open report');
  wrapper.unmount();
});

it('requires a cancellation reason and refreshes the closed listing after cancellation', async () => {
  signIn('admin');
  vi.mocked(marketplace.listMarketplaceJobs)
    .mockResolvedValueOnce([{ ...listing, status: 'assigned', canCancelAssignment: true }])
    .mockResolvedValueOnce([{ ...listing, status: 'closed' }]);
  vi.mocked(marketplace.cancelMarketplaceAssignment).mockResolvedValue({ ...listing, status: 'closed' });
  const wrapper = mount(MarketplaceView, { global });
  await flushPromises();
  expect(wrapper.get('form button').attributes('disabled')).toBeDefined();
  await wrapper.get('form textarea').setValue('Site access can no longer be arranged.');
  await wrapper.get('form').trigger('submit');
  await flushPromises();
  expect(marketplace.cancelMarketplaceAssignment).toHaveBeenCalledWith(1, 'Site access can no longer be arranged.');
  expect(wrapper.find('form').exists()).toBe(false);
  expect(wrapper.text()).toContain('Closed');
  wrapper.unmount();
});
