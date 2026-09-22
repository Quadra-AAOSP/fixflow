import type { Report, Site } from '../src/types/maintenance';
export function report(overrides: Partial<Report> = {}): Report {
  return { id: 1, siteId: 7, createdByUserId: null, createdByName: null, description: 'A reported issue', address: null,
    category: 'plumbing', specialty: null, aiUrgency: null, reporterUrgency: 'medium', reporterReason: null,
    finalUrgency: null, status: 'open', assignedTechnicianId: null, editable: true, reopenCount: 0,
    createdAt: '2026-09-21T12:00:00Z', updatedAt: '2026-09-21T12:00:00Z', ...overrides };
}
export function site(id: number): Site {
  return { id, name: `Test site ${id}`, type: 'school', contractStatus: 'contracted', address: null, description: null,
    imageUrl: null, createdAt: '', updatedAt: '' };
}
