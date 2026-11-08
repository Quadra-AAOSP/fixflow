<script setup lang="ts">
import ShopNotifications from '@/components/dashboard/ShopNotifications.vue';
import { ref } from 'vue';
import SkipLink from '@/components/ui/SkipLink.vue';
import { ArrowLeft, Bell, UserRound } from '@lucide/vue';
import { useAuth } from '@/composables/useAuth';
import LanguageSelector from '@/components/ui/LanguageSelector.vue';
import { useLocale } from '@/i18n';
import '@/styles/shop.css';
import { useNotificationIndicator } from '@/composables/useNotificationIndicator';
const { hasUnread } = useNotificationIndicator(['shop']);
const { user } = useAuth();
const noticesOpen = ref(false);
const { t } = useLocale();
</script>
<template>
  <div class="shop-shell"><SkipLink /><header class="shop-shell-header"><RouterLink to="/shop" class="shop-wordmark">FixFlow<span> / {{ t('Shop') }}</span></RouterLink><nav :aria-label="t('Shop navigation')"><LanguageSelector /><details><summary>{{ t('Tools') }}</summary><RouterLink v-if="user?.role !== 'shop_manager'" to="/shop">{{ t('Shop') }}</RouterLink><template v-if="user?.role === 'shop_manager' || user?.role === 'super_admin'"><RouterLink to="/shop/dashboard">{{ t('Dashboard') }}</RouterLink><RouterLink to="/shop/orders-management">{{ t('Manage orders') }}</RouterLink><RouterLink to="/shop/manage">{{ t('Product management') }}</RouterLink></template></details><button v-if="user" class="notification-bell notification-indicator-button" type="button" :aria-label="t(hasUnread ? 'Notifications, new notifications' : 'Notifications')" @click="noticesOpen = !noticesOpen" :aria-expanded="noticesOpen"><Bell :size="23" aria-hidden="true" /><span v-if="hasUnread" class="notification-unread-dot" aria-hidden="true" /></button><RouterLink v-if="user && user.role !== 'shop_manager'" to="/"><ArrowLeft :size="15" />{{ t('Workspace') }}</RouterLink><RouterLink :to="user ? '/profile' : '/login?redirect=/shop'"><UserRound :size="17" />{{ user ? user.firstName : t('Sign in') }}</RouterLink></nav></header><ShopNotifications v-if="user && noticesOpen" /><main id="main-content" tabindex="-1" class="shop-shell-main"><RouterView /></main><footer class="shop-shell-footer"><span>{{ t('FixFlow · A little care. A big difference.') }}</span><span>© {{ new Date().getFullYear() }} FixFlow</span></footer></div>
</template>

<style scoped>
.notification-bell { min-width: 44px; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; }
</style>
