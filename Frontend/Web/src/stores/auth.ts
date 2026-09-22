import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import * as authApi from '@/services/auth';
import type { LoginPayload, RegisterPayload, User } from '@/types';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const isLoading = ref(true);
  const initialized = ref(false);
  const isAuthenticated = computed(() => user.value !== null);
  let hydration: Promise<void> | undefined;
  function clearSession() { user.value = null; initialized.value = true; }
  async function hydrate() {
    if (initialized.value) return;
    if (hydration) return hydration;
    hydration = (async () => {
      isLoading.value = true;
      try { user.value = await authApi.getMe(); }
      catch { user.value = null; }
      finally { initialized.value = true; isLoading.value = false; }
    })();
    return hydration;
  }
  async function login(payload: LoginPayload) {
    user.value = await authApi.login(payload); initialized.value = true;
  }
  async function register(payload: RegisterPayload) {
    await authApi.register(payload);
    await login({ email: payload.email, password: payload.password });
  }
  async function logout() {
    // Keep the UI session if the server failed to invalidate the actual cookie.
    await authApi.logout(); clearSession();
  }
  return { user, isLoading, isAuthenticated, hydrate, login, register, logout, clearSession };
});
