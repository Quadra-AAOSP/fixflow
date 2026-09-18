<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { ClipboardList, House, User, Wrench } from '@lucide/vue';

import { colors } from '@/constants/theme';

const route = useRoute();

const links = [
  { to: '/', label: 'Home', icon: House },
  { to: '/reports', label: 'Reports', icon: ClipboardList },
  { to: '/profile', label: 'Profile', icon: User },
] as const;

function isActive(path: string) {
  return route.path === path;
}

const iconColor = computed(() =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches
    ? colors.dark.primary
    : colors.light.primary,
);
</script>

<template>
  <div class="min-h-screen bg-surface dark:bg-surface-dark">
    <header
      class="border-b border-border bg-card dark:border-border-dark dark:bg-card-dark"
    >
      <div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <div class="flex items-center gap-2">
          <span
            class="inline-flex rounded-lg bg-primary/15 p-2 dark:bg-primary-dark/20"
          >
            <Wrench :size="20" :color="iconColor" />
          </span>
          <span class="text-lg font-bold text-ink dark:text-ink-dark">
            FixFlow
          </span>
        </div>
        <nav class="flex items-center gap-1">
          <RouterLink
            v-for="link in links"
            :key="link.to"
            :to="link.to"
            class="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition"
            :class="
              isActive(link.to)
                ? 'bg-primary/10 text-primary dark:bg-primary-dark/15 dark:text-primary-dark'
                : 'text-muted hover:bg-surface dark:text-muted-dark dark:hover:bg-surface-dark'
            "
          >
            <component
              :is="link.icon"
              :size="18"
              :stroke-width="isActive(link.to) ? 2.5 : 2"
            />
            {{ link.label }}
          </RouterLink>
        </nav>
      </div>
    </header>
    <main class="mx-auto max-w-5xl px-4 py-6">
      <RouterView />
    </main>
  </div>
</template>
