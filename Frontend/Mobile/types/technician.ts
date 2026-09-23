/**
 * Mirrors backend `TechnicianSkillResponse`.
 *
 * `category` and `specialty` are normalized server-side to trimmed,
 * lower-cased values (`TechnicianSkillService.create`), so a value echoed back
 * from a create call is the canonical one to compare against.
 *
 * `specialty` is `null` for a generalist in that trade — the schema treats a
 * NULL specialty as distinct from an empty string, and the unique key
 * (`uq_tech_skill`) is on the (technicianId, category, specialty) triple.
 */
export type TechnicianSkill = {
  id: number;
  technicianId: number;
  category: string;
  specialty: string | null;
  proficiency: number;
};

/**
 * Mirrors backend `TechnicianSkillRequest`.
 *
 * `technicianId` is required even for self-service: the backend authorizes on
 * it explicitly (`actor.getRole() === technician` must match
 * `request.technicianId()`, otherwise 403). admin / super_admin may pass
 * anyone's id; reporter / staff are rejected outright.
 *
 * `proficiency` is `@Min(1) @Max(5)` and the service defaults it to 3 when
 * omitted, mirroring the column default.
 */
export type CreateTechnicianSkillPayload = {
  technicianId: number;
  category: string;
  specialty?: string;
  proficiency?: number;
};
