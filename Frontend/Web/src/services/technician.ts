import { request } from './api';
import type { RankingMode, TechnicianAvailability, TechnicianInvitationInbox, TechnicianInvitationsSent, TechnicianRanking, TechnicianSummary, TechnicianTermsStatus } from '@/types/technician';

export const getTechnicianAvailability = () => request<TechnicianAvailability>('/api/technicians/me/availability');
export function setTechnicianAvailability(status: TechnicianAvailability['status']) {
  return request<TechnicianAvailability>('/api/technicians/me/availability', { method: 'PUT', body: JSON.stringify({ status }) });
}

export function getTechnicianInvitations(page = 0) {
  return request<TechnicianInvitationInbox>(`/api/technician-invitations?page=${page}`);
}
export function sendTechnicianInvitations(reportId: number, reason: string, page = 0) {
  const message = reason.trim();
  if (!message || message.length > 1000) throw new Error('Enter an invitation reason of 1–1,000 characters.');
  return request<TechnicianInvitationsSent>(`/api/reports/${reportId}/technician-invitations?page=${page}`, { method: 'POST', body: JSON.stringify({ reason: message }) });
}

export const listTechnicians = () => request<TechnicianSummary[]>('/api/technicians');
export function rankTechnicians(reportId: number, mode: RankingMode) {
  return request<TechnicianRanking>(`/api/reports/${reportId}/technician-ranking`, { method: 'POST', body: JSON.stringify({ mode }) });
}

export function getTechnicianTerms(): Promise<TechnicianTermsStatus> {
  return request('/api/technician-terms/me');
}

export function acceptTechnicianTerms(version: string): Promise<TechnicianTermsStatus> {
  return request('/api/technician-terms/accept', { method: 'POST', body: JSON.stringify({ version }) });
}

export function addTechnicianSkill(technicianId: number, category: string, specialty: string, proficiency: string) {
  const level = Number(proficiency);
  if (!category.trim() || category.trim().length > 128) throw new Error('Enter a trade of up to 128 characters.');
  if (specialty.trim().length > 128) throw new Error('Enter a specialty of up to 128 characters.');
  if (!Number.isInteger(level) || level < 1 || level > 5) throw new Error('Choose a self-assessed proficiency from 1 to 5.');
  return request<{ id: number; category: string; specialty: string | null; proficiency: number }>('/api/technician-skills', {
    method: 'POST', body: JSON.stringify({ technicianId, category: category.trim(), specialty: specialty.trim() || null, proficiency: level }),
  });
}
