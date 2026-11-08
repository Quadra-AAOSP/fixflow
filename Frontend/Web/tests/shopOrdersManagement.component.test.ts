// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount, flushPromises } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import View from '../src/views/app/ShopOrdersManagementView.vue';
import { useAuthStore } from '../src/stores/auth';
import { listManagedOrders, getManagedOrder, advanceFulfillment } from '../src/services/shopAdmin';
vi.mock('../src/services/shopAdmin', () => ({ listManagedOrders: vi.fn(), getManagedOrder: vi.fn(), advanceFulfillment: vi.fn() }));
const order = { orderId:'A1', status:'paid', paymentStatus:'succeeded', fulfillmentStatus:'ordered', allowedTransitions:['processing'], currency:'USD', minorUnitDigits:2, totalMinor:1000, shippingName:'Buyer', shippingPhone:null, shippingAddress:'Address', items:[] } as unknown as import('../src/types/shop').ManagedShopOrder;
beforeEach(() => {setActivePinia(createPinia()); vi.resetAllMocks(); useAuthStore().user={id:4,role:'shop_manager',siteId:null,firstName:'A',lastName:'B',email:'a@b.invalid',phone:null,address:null};});
it('loads the queue and advances only a server-provided transition', async () => { vi.mocked(listManagedOrders).mockResolvedValue({content:[order],hasMore:false}); vi.mocked(getManagedOrder).mockResolvedValue(order); vi.mocked(advanceFulfillment).mockResolvedValue({...order,fulfillmentStatus:'processing',allowedTransitions:['shipped']}); const router=createRouter({history:createMemoryHistory(),routes:[{path:'/orders',component:View},{path:'/orders/:orderId',name:'shop-managed-order',component:View}]}); await router.push('/orders'); await router.isReady(); const w=mount(View,{global:{plugins:[router]}}); await flushPromises(); expect(w.text()).toContain('A1'); await router.push('/orders/A1'); await flushPromises(); await w.findAll('button').find(b=>b.text()==='Start processing')!.trigger('click'); await flushPromises(); expect(advanceFulfillment).toHaveBeenCalledWith('A1','processing'); expect(w.text()).toContain('Mark shipped'); w.unmount(); });

import { ApiError } from '../src/services/api';
it('clears private delivery details when access is revoked', async () => { vi.mocked(getManagedOrder).mockResolvedValueOnce(order).mockRejectedValueOnce(new ApiError(403,'Forbidden')); const router=createRouter({history:createMemoryHistory(),routes:[{path:'/orders/:orderId',name:'shop-managed-order',component:View}]}); await router.push('/orders/A1'); await router.isReady(); const w=mount(View,{global:{plugins:[router]}}); await flushPromises(); expect(w.text()).toContain('Address'); await w.findAll('button').find(b=>b.text()==='Refresh')!.trigger('click'); await flushPromises(); expect(w.text()).not.toContain('Address'); expect(w.find('[role="alert"]').exists()).toBe(true); w.unmount(); });
