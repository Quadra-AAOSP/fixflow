<script setup lang="ts">
import { ArrowLeft, UserRound } from '@lucide/vue';
import { useAuth } from '@/composables/useAuth';
import '@/styles/shop.css';
const { user } = useAuth();
</script>
<template>
  <div class="shop-shell"><header class="shop-shell-header"><RouterLink to="/shop" class="shop-wordmark">FixFlow<span> / shop</span></RouterLink><nav aria-label="Shop navigation"><RouterLink v-if="user" to="/"><ArrowLeft :size="15" />Workspace</RouterLink><RouterLink :to="user ? '/profile' : '/login?redirect=/shop'"><UserRound :size="17" />{{ user ? user.firstName : 'Sign in' }}</RouterLink></nav></header><main class="shop-shell-main"><RouterView /></main><footer class="shop-shell-footer"><span>FixFlow · A little care. A big difference.</span><span>© {{ new Date().getFullYear() }} FixFlow</span></footer></div>
</template>
