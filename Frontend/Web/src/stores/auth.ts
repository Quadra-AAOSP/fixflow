import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import * as authApi from '@/services/auth';
import { ApiError } from '@/services/auth';
import type { LoginPayload, RegisterPayload, User } from '@/types';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const isLoading = ref(true);

  const isAuthenticated = computed(() => user.value !== null);

  async function hydrate() {
    isLoading.value = true;
    try {
      user.value = await authApi.getMe();
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) {
        user.value = null;
      } else {
        user.value = null;
      }
    } finally {
      isLoading.value = false;
    }
  }

  async function login(payload: LoginPayload) {
    user.value = await authApi.login(payload);
  }

  async function register(payload: RegisterPayload) {
    await authApi.register(payload);
    user.value = await authApi.login({
      email: payload.email,
      password: payload.password,
    });
  }

  async function logout() {
    try {
      await authApi.logout();
    } finally {
      user.value = null;
    }
  }

  return {
    user,
    isLoading,
    isAuthenticated,
    hydrate,
    login,
    register,
    logout,
  };
});
