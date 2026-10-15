import { useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';

type AccountPolicy = { passwordMinLength: number; managedRoleMessage: string; selfRegistrationRoles: string[] };

/** Optional display metadata: failure must not block login or registration. */
export function useAccountPolicy() {
  const [policy, setPolicy] = useState<AccountPolicy | null>(null);
  useEffect(() => {
    let active = true;
    api.get<AccountPolicy>('/api/auth/policy')
      .then(value => { if (active) setPolicy(value); }).catch(() => {});
    return () => { active = false; };
  }, []);
  return policy;
}
