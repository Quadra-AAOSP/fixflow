import { request } from './api';
import type { ProvisionUserPayload, User } from '@/types';

export interface TechnicianContract {
  id: number; technicianId: number; siteId: number; createdAt: string;
}
export function provisionUser(payload: ProvisionUserPayload): Promise<User> {
  if (payload.role !== 'admin' && payload.role !== 'staff') throw new Error('This web flow cannot provision that role.');
  return request('/api/admin/users', { method: 'POST', body: JSON.stringify(payload) });
}
export function createTechnicianContract(technicianId: number, siteId: number): Promise<TechnicianContract> {
  return request('/api/technician-contracts', { method: 'POST', body: JSON.stringify({ technicianId, siteId }) });
}
