import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { advanceRequestSession } from '@/services/api';
import * as authApi from '@/services/auth';
import type { LoginPayload, RegisterPayload, User } from '@/types';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const isLoading = ref(true);
  const initialized = ref(false);
  const isAuthenticated = computed(() => user.value !== null);
  let hydration: Promise<void> | undefined;
  let sessionGeneration = 0;
  function clearSession() { advanceRequestSession(); sessionGeneration++; user.value = null; initialized.value = true; isLoading.value = false; }
  async function hydrate() {
    if (initialized.value) return;
    if (hydration) return hydration;
    const current = sessionGeneration;
    hydration = (async () => {
      isLoading.value = true;
      try { const result = await authApi.getMe(); if (current === sessionGeneration) user.value = result; }
      catch { if (current === sessionGeneration) user.value = null; }
      finally { if (current === sessionGeneration) { initialized.value = true; isLoading.value = false; } }
    })();
    return hydration;
  }
  async function login(payload: LoginPayload) {
    advanceRequestSession();
    const current = ++sessionGeneration;
    const result = await authApi.login(payload);
    if (current === sessionGeneration) { user.value = result; initialized.value = true; isLoading.value = false; }
  }
  async function refreshUser() {
    const accountId = user.value?.id;
    const currentGeneration = sessionGeneration;
    if (accountId == null) return;
    const current = await authApi.getMe();
    if (currentGeneration === sessionGeneration && user.value?.id === accountId) {
      if (current.id !== accountId || current.role !== user.value.role || current.siteId !== user.value.siteId ||
          current.applicationOnly !== user.value.applicationOnly) {
        sessionGeneration++;
        advanceRequestSession();
      }
      user.value = current;
    }
  }
  async function register(payload: RegisterPayload) {
    await authApi.register(payload);
    await login({ email: payload.email, password: payload.password });
  }
  async function logout() {
    // Keep the UI session if the server failed to invalidate the actual cookie.
    await authApi.logout(); clearSession();
  }
  return { user, isLoading, isAuthenticated, hydrate, login, register, logout, clearSession, refreshUser };
});
