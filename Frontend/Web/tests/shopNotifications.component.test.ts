// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount, flushPromises } from '@vue/test-utils';
import View from '../src/components/dashboard/ShopNotifications.vue';
import { useAuthStore } from '../src/stores/auth';
import { listShopNotifications } from '../src/services/shop';
vi.mock('../src/services/shop', () => ({listShopNotifications:vi.fn()}));
beforeEach(()=>{setActivePinia(createPinia()); vi.resetAllMocks();useAuthStore().user={id:1,role:'reporter',siteId:1,firstName:'A',lastName:'B',email:'a@b.invalid',phone:null,address:null};});
it('loads order alerts separately and clears them on logout',async()=>{vi.mocked(listShopNotifications).mockResolvedValue({content:[{id:1,orderId:'ORDER-A',type:'order_shipped',createdAt:'2026-11-08'}],hasMore:false});const w=mount(View,{global:{stubs:{RouterLink:{template:'<a><slot /></a>'}}}});await flushPromises();expect(w.text()).toContain('ORDER-A');useAuthStore().user=null;await flushPromises();expect(w.text()).not.toContain('ORDER-A');w.unmount();});
it('retains earlier notifications and retries a failed next page without duplicates', async () => {
  const notice = {id:1,orderId:'ORDER-A',type:'order_shipped' as const,createdAt:'2026-11-08'};
  vi.mocked(listShopNotifications).mockResolvedValueOnce({content:[notice],hasMore:true}).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({content:[notice,{...notice,id:2,orderId:'ORDER-B'}],hasMore:false});
  const w=mount(View,{global:{stubs:{RouterLink:{template:'<a><slot /></a>'}}}}); await flushPromises();
  await w.findAll('button').find(b=>b.text()==='Load more')!.trigger('click'); await flushPromises();
  expect(w.text()).toContain('ORDER-A'); expect(w.text()).toContain('Could not load');
  await w.findAll('button').find(b=>b.text()==='Retry')!.trigger('click'); await flushPromises();
  expect(listShopNotifications).toHaveBeenLastCalledWith(1);
  expect(w.findAll('li')).toHaveLength(2); w.unmount();
});
