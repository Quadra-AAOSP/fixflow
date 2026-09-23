import { api } from '@/lib/apiClient';
import { endpoints } from '@/lib/endpoints';
import type { CreateTechnicianSkillPayload, TechnicianSkill } from '@/types';

/**
 * Declares one trade / specialty for a technician.
 *
 * Authorization is enforced server-side and is *not* uniform across roles
 * (`TechnicianSkillService.create`):
 *   - `technician` — only for themselves; any other `technicianId` is 403.
 *   - `admin` / `super_admin` — for any technician.
 *   - `reporter` / `staff` — always 403.
 *
 * The target user must hold `users.role = technician` or the call fails the
 * `roleIntegrityService.requireTechnician` check.
 *
 * There is no matching READ endpoint yet, so this cannot be paired with a
 * fetch to show what is already declared. A duplicate
 * (technicianId, category, specialty) violates `uq_tech_skill`; unlike
 * contracts, the service has no pre-check, so it surfaces as an unhandled
 * DataIntegrityViolationException -> 500 rather than a clean 409.
 */
export function createTechnicianSkill(
  payload: CreateTechnicianSkillPayload,
): Promise<TechnicianSkill> {
  return api.post<TechnicianSkill>(endpoints.technicianSkills.create, payload);
}
