import { optionalContractText, positiveIdentifier } from '@/utils/requestFields';
import { request } from './api';
import type { ProvisionUserPayload, User } from '@/types';
import type { ContractApplication } from '@/types/technician';

export interface TechnicianContract {
  id: number;
  technicianId: number;
  siteId: number;
  flatFeeMinor: number;
  feeCurrency: string;
  createdAt: string;
  siteName?: string;
}
export function provisionUser(payload: ProvisionUserPayload): Promise<User> {
  if (payload.role !== 'admin' && payload.role !== 'staff' && payload.role !== 'shop_manager') throw new Error('This web flow cannot provision that role.');
  return request('/api/admin/users', { method: 'POST', body: JSON.stringify(payload) });
}
export function createTechnicianContract(technicianId: number, siteId: number): Promise<TechnicianContract> {
  positiveIdentifier(technicianId, 'Choose a valid technician.');
  positiveIdentifier(siteId, 'Choose a valid site.');
  return request('/api/technician-contracts', { method: 'POST', body: JSON.stringify({ technicianId, siteId }) });
}
export function listContractApplications(siteId?: number): Promise<ContractApplication[]> {
  return request(`/api/technician-contract-requests${siteId == null ? '' : `?siteId=${siteId}`}`);
}
export function requestTechnicianContract(siteId: number, note: string): Promise<ContractApplication> {
  positiveIdentifier(siteId, 'Choose a valid site.');
  return request('/api/technician-contract-requests', {
    method: 'POST', body: JSON.stringify({ siteId, note: optionalContractText(note) }),
  });
}
export function decideContractApplication(id: number, decision: 'approve' | 'reject', reason: string): Promise<ContractApplication> {
  positiveIdentifier(id, 'Choose a valid request.');
  return request(`/api/technician-contract-requests/${id}/decision`, {
    method: 'POST', body: JSON.stringify({ decision, reason: optionalContractText(reason) }),
  });
}

export function listSiteContracts(siteId: number): Promise<TechnicianContract[]> {
  if (!Number.isSafeInteger(siteId) || siteId <= 0) throw new Error('Choose a valid site.');
  return request(`/api/technician-contracts?siteId=${siteId}`);
}
export function deleteTechnicianContract(id: number) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Choose a valid contract.');
  return request<void>(`/api/technician-contracts/${id}`, { method: 'DELETE' });
}
