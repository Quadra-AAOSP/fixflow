import { request } from './api';
import type { TechnicianTermsStatus } from '@/types/technician';

export function getTechnicianTerms(): Promise<TechnicianTermsStatus> {
  return request('/api/technician-terms/me');
}

export function acceptTechnicianTerms(version: string): Promise<TechnicianTermsStatus> {
  return request('/api/technician-terms/accept', { method: 'POST', body: JSON.stringify({ version }) });
}

export function addTechnicianSkill(technicianId: number, category: string, specialty: string, proficiency: string) {
  const level = Number(proficiency);
  if (!category.trim() || category.trim().length > 128) throw new Error('Enter a trade of up to 128 characters.');
  if (!specialty.trim() || specialty.trim().length > 128) throw new Error('Enter a specialty of up to 128 characters.');
  if (!Number.isInteger(level) || level < 1 || level > 5) throw new Error('Choose a self-assessed proficiency from 1 to 5.');
  return request<{ id: number; category: string; specialty: string; proficiency: number }>('/api/technician-skills', {
    method: 'POST', body: JSON.stringify({ technicianId, category: category.trim(), specialty: specialty.trim(), proficiency: level }),
  });
}
