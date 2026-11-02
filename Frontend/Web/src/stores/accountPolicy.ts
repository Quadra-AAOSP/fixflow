import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getAccountPolicy, type AccountPolicy } from '@/services/accountPolicy';
import { errorMessage } from '@/services/api';

/** Public account rules are shared across signup and administrator provisioning. */
export const useAccountPolicyStore = defineStore('account-policy', () => {
  const policy = ref<AccountPolicy | null>(null);
  const loading = ref(false);
  const error = ref('');
  let flight: Promise<void> | undefined;
  function load() {
    if (flight) return flight;
    if (policy.value) return Promise.resolve();
    loading.value = true; error.value = '';
    flight = (async () => {
      try { policy.value = await getAccountPolicy(); }
      catch (err) { error.value = errorMessage(err); }
      finally { loading.value = false; flight = undefined; }
    })();
    return flight;
  }
  return { policy, loading, error, load };
});
