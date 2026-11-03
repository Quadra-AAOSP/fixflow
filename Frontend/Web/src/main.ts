import { createApp, watch } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import { useAuthStore } from './stores/auth';
import { useShopStore } from './stores/shop';
import { useMaintenanceStore } from './stores/maintenance';
import { useRealtimeStore } from './stores/realtime';
import { setUnauthorizedHandler } from './services/api';
import './styles/global.css';
import { shopManagerRouteAllowed } from '@/utils/workspaceAccess';
import { i18n } from './i18n';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(i18n);
const auth = useAuthStore(pinia);
const maintenance = useMaintenanceStore(pinia);
const shop = useShopStore(pinia);
const realtime = useRealtimeStore(pinia);
function expireSession() {
  auth.clearSession();
  if (router.currentRoute.value.meta.requiresAuth) {
    void router.replace({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } });
  }
}
watch([() => auth.user?.id, () => auth.user?.role, () => auth.user?.siteId], () => {
  realtime.stop(); maintenance.reset(); shop.reset();
  if (auth.user) realtime.start(expireSession);
  const route = router.currentRoute.value;
  if (auth.user && (Array.isArray(route.meta.roles) && !route.meta.roles.includes(auth.user.role))) void router.replace('/');
  if (auth.user?.role === 'shop_manager' && route.meta.requiresAuth && !shopManagerRouteAllowed(route.name)) void router.replace('/shop');
}, { flush: 'sync' });
watch(() => maintenance.selectedSiteId, id => realtime.setSite(id), { flush: 'sync' });
setUnauthorizedHandler(expireSession);
app.use(router);
app.mount('#app');
