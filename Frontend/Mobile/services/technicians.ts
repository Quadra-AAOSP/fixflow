import { api } from '@/lib/apiClient';
import { endpoints } from '@/lib/endpoints';
import type { TechnicianSummary } from '@/types';

/**
 * Lists every technician with their skills, contract sites and availability.
 * Available to `staff` and above; the backend does not scope this by site, so
 * the caller narrows the list itself. The caller must handle a 401 by signing
 * the user out — see `app/(tabs)/reports/index.tsx`.
 */
export function listTechnicians(): Promise<TechnicianSummary[]> {
  return api.get<TechnicianSummary[]>(endpoints.technicians.list);
}
