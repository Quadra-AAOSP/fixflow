// @vitest-environment jsdom
import { mount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import SiteVettingPanel from '@/components/technician/SiteVettingPanel.vue';
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/services/api', () => ({ request, errorMessage: (e: Error) => e.message }));
vi.mock('@/composables/useAuth', () => ({ useAuth: () => ({ user: ref({ id: 1, role: 'admin' }) }) }));
describe('site vetting selection', () => {
 it('discards an old response and clears checks when switching technicians', async () => {
  let finish!: (v: unknown) => void;
  request.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const panel = mount(SiteVettingPanel, { props: { siteId: 1, technicians: [10, 20] } });
  const select = panel.find('select');
  await select.setValue('10'); await panel.find('button').trigger('click');
  await select.setValue('20'); finish({status:'approved', review:null}); await flushPromises();
  expect(panel.text()).not.toContain('Site vetting: approved');
  request.mockResolvedValueOnce({status:'unreviewed', review:null}); await panel.find('button').trigger('click'); await flushPromises();
  await panel.find('input[type=checkbox]').setValue(true);
  await select.setValue('10');
  request.mockResolvedValueOnce({status:'unreviewed', review:null}); await panel.find('button').trigger('click'); await flushPromises();
  expect((panel.find('input[type=checkbox]').element as HTMLInputElement).checked).toBe(false);
 });
});

