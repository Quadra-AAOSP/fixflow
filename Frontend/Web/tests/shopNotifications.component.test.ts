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
