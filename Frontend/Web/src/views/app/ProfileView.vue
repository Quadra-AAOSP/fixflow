<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { User } from '@lucide/vue';

import Button from '@/components/ui/Button.vue';
import { useAuth } from '@/composables/useAuth';
import { colors } from '@/constants/theme';

const router = useRouter();
const { user, logout } = useAuth();
const loggingOut = ref(false);

async function onLogout() {
  loggingOut.value = true;
  try {
    await logout();
    await router.replace({ name: 'login' });
  } finally {
    loggingOut.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-md">
    <div class="mb-6 flex flex-col items-center">
      <span
        class="mb-3 inline-flex rounded-full bg-primary/15 p-4 dark:bg-primary-dark/20"
      >
        <User :size="36" :color="colors.light.primary" />
      </span>
      <h1 class="text-xl font-semibold text-ink dark:text-ink-dark">
        {{ user ? `${user.firstName} ${user.lastName}` : 'Profile' }}
      </h1>
      <p v-if="user" class="mt-1 text-sm text-muted dark:text-muted-dark">
        {{ user.email }}
      </p>
    </div>

    <div
      v-if="user"
      class="mb-6 rounded-xl border border-border bg-card p-4 dark:border-border-dark dark:bg-card-dark"
    >
      <div class="mb-3 flex items-center justify-between">
        <span class="text-sm text-muted dark:text-muted-dark">Role</span>
        <span class="text-sm font-medium capitalize text-ink dark:text-ink-dark">
          {{ user.role }}
        </span>
      </div>
      <div class="mb-3 flex items-center justify-between">
        <span class="text-sm text-muted dark:text-muted-dark">Site ID</span>
        <span class="text-sm font-medium text-ink dark:text-ink-dark">
          {{ user.siteId != null ? user.siteId : '—' }}
        </span>
      </div>
      <div v-if="user.phone" class="flex items-center justify-between">
        <span class="text-sm text-muted dark:text-muted-dark">Phone</span>
        <span class="text-sm font-medium text-ink dark:text-ink-dark">
          {{ user.phone }}
        </span>
      </div>
    </div>

    <Button
      label="Sign out"
      variant="secondary"
      :loading="loggingOut"
      @click="onLogout"
    />
  </div>
</template>
