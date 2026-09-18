import { storeToRefs } from 'pinia';

import { useAuthStore } from '@/stores/auth';

/** Thin accessor over the Pinia auth store for views/composables. */
export function useAuth() {
  const store = useAuthStore();
  const { user, isLoading, isAuthenticated } = storeToRefs(store);

  return {
    user,
    isLoading,
    isAuthenticated,
    login: store.login,
    register: store.register,
    logout: store.logout,
    hydrate: store.hydrate,
  };
}
