import { createApp, watch } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import { useAuthStore } from './stores/auth';
import { useShopStore } from './stores/shop';
import { useMaintenanceStore } from './stores/maintenance';
import { setUnauthorizedHandler } from './services/api';
import './styles/global.css';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
const auth = useAuthStore(pinia);
const maintenance = useMaintenanceStore(pinia);
const shop = useShopStore(pinia);
watch(() => auth.user?.id, () => { maintenance.reset(); shop.reset(); }, { flush: 'sync' });
setUnauthorizedHandler(() => {
  auth.clearSession();
  if (router.currentRoute.value.meta.requiresAuth) {
    void router.replace({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } });
  }
});
app.use(router);
app.mount('#app');
