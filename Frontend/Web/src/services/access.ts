import { request } from './api';
import type { ProvisionUserPayload, User } from '@/types';
import type { ContractApplication } from '@/types/technician';

export interface TechnicianContract {
  id: number; technicianId: number; siteId: number; createdAt: string;
}
export function provisionUser(payload: ProvisionUserPayload): Promise<User> {
  if (payload.role !== 'admin' && payload.role !== 'staff' && payload.role !== 'shop_manager') throw new Error('This web flow cannot provision that role.');
  return request('/api/admin/users', { method: 'POST', body: JSON.stringify(payload) });
}
export function createTechnicianContract(technicianId: number, siteId: number): Promise<TechnicianContract> {
  return request('/api/technician-contracts', { method: 'POST', body: JSON.stringify({ technicianId, siteId }) });
}
export function listContractApplications(siteId?: number): Promise<ContractApplication[]> {
  return request(`/api/technician-contract-requests${siteId == null ? '' : `?siteId=${siteId}`}`);
}
export function requestTechnicianContract(siteId: number, note: string): Promise<ContractApplication> {
  return request('/api/technician-contract-requests', {
    method: 'POST', body: JSON.stringify({ siteId, note: note.trim() || null }),
  });
}
export function decideContractApplication(id: number, decision: 'approve' | 'reject', reason: string): Promise<ContractApplication> {
  return request(`/api/technician-contract-requests/${id}/decision`, {
    method: 'POST', body: JSON.stringify({ decision, reason: reason.trim() || null }),
  });
}
