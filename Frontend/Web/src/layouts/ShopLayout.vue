<script setup lang="ts">
import { ArrowLeft, UserRound } from '@lucide/vue';
import { useAuth } from '@/composables/useAuth';
import LanguageSelector from '@/components/ui/LanguageSelector.vue';
import { useLocale } from '@/i18n';
import '@/styles/shop.css';
const { user } = useAuth();
const { t } = useLocale();
</script>
<template>
  <div class="shop-shell"><header class="shop-shell-header"><RouterLink to="/shop" class="shop-wordmark">FixFlow<span> / shop</span></RouterLink><nav :aria-label="t('Shop navigation')"><LanguageSelector /><RouterLink v-if="user" to="/"><ArrowLeft :size="15" />{{ t('Workspace') }}</RouterLink><RouterLink :to="user ? '/profile' : '/login?redirect=/shop'"><UserRound :size="17" />{{ user ? user.firstName : t('Sign in') }}</RouterLink></nav></header><main class="shop-shell-main"><RouterView /></main><footer class="shop-shell-footer"><span>{{ t('FixFlow · A little care. A big difference.') }}</span><span>© {{ new Date().getFullYear() }} FixFlow</span></footer></div>
</template>
