<script setup lang="ts">
import ShopNotifications from '@/components/dashboard/ShopNotifications.vue';
import { ref, watch } from 'vue';
import SkipLink from '@/components/ui/SkipLink.vue';
import { ArrowLeft, Bell, UserRound, X } from '@lucide/vue';
import { useAuth } from '@/composables/useAuth';
import LanguageSelector from '@/components/ui/LanguageSelector.vue';
import { useLocale } from '@/i18n';
import '@/styles/shop.css';
import { useNotificationIndicator } from '@/composables/useNotificationIndicator';
const { hasUnread } = useNotificationIndicator(['shop']);
const { user } = useAuth();
const noticesOpen = ref(false);
const notificationDialog = ref<HTMLDialogElement>();
function openNotifications() { notificationDialog.value?.showModal(); noticesOpen.value = true; }
watch(() => user.value?.id, () => { notificationDialog.value?.close(); noticesOpen.value = false; });
const { t } = useLocale();
</script>
<template>
  <div class="shop-shell"><SkipLink /><header class="shop-shell-header"><RouterLink to="/shop" class="shop-wordmark">FixFlow<span> / {{ t('Shop') }}</span></RouterLink><nav :aria-label="t('Shop navigation')"><LanguageSelector /><details><summary>{{ t('Tools') }}</summary><RouterLink v-if="user?.role !== 'shop_manager'" to="/shop">{{ t('Shop') }}</RouterLink><template v-if="user?.role === 'shop_manager' || user?.role === 'super_admin'"><RouterLink to="/shop/dashboard">{{ t('Dashboard') }}</RouterLink><RouterLink to="/shop/orders-management">{{ t('Manage orders') }}</RouterLink><RouterLink to="/shop/manage">{{ t('Product management') }}</RouterLink></template></details><button v-if="user" class="notification-bell notification-indicator-button" type="button" :aria-label="t(hasUnread ? 'Notifications, new notifications' : 'Notifications')" @click="openNotifications" :aria-expanded="noticesOpen"><Bell :size="23" aria-hidden="true" /><span v-if="hasUnread" class="notification-unread-dot" aria-hidden="true" /></button><RouterLink v-if="user && user.role !== 'shop_manager'" to="/"><ArrowLeft :size="15" />{{ t('Workspace') }}</RouterLink><RouterLink :to="user ? '/profile' : '/login?redirect=/shop'"><UserRound :size="17" />{{ user ? user.firstName : t('Sign in') }}</RouterLink></nav></header><dialog ref="notificationDialog" class="shop-notification-dialog" :aria-label="t('Notifications')" @close="noticesOpen = false"><div class="shop-notification-heading"><h2>{{ t('Notifications') }}</h2><button type="button" class="notification-bell" :aria-label="t('Close dialog')" @click="notificationDialog?.close()"><X :size="22" /></button></div><ShopNotifications v-if="user && noticesOpen" @navigate="notificationDialog?.close()" /></dialog><main id="main-content" tabindex="-1" class="shop-shell-main"><RouterView /></main><footer class="shop-shell-footer"><span>{{ t('FixFlow · A little care. A big difference.') }}</span><span>© {{ new Date().getFullYear() }} FixFlow</span></footer></div>
</template>

<style scoped>
.notification-bell { min-width: 44px; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; }
.shop-notification-dialog{width:min(540px,calc(100% - 32px));max-height:80dvh;overflow:auto;border:1px solid var(--product-border);border-radius:16px;padding:24px;color:var(--product-ink);background:var(--product-surface)}
.shop-notification-dialog::backdrop{background:#233d365c}.shop-notification-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:24px}.shop-notification-heading h2{font-size:22px;font-weight:700}
</style>
