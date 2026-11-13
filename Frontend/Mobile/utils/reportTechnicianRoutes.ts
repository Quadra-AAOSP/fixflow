import type { Report, User } from '@/types';

export type TechnicianRoute = 'contracted' | 'marketplace';

type ReportRouting = Pick<Report, 'status' | 'siteId' | 'assignedTechnicianId'>
  & { policy: Pick<Report['policy'], 'canAssign'> };

export function reportTechnicianRoutes(
  report: ReportRouting,
  user: Pick<User, 'role' | 'siteId'> | null,
): TechnicianRoute[] {
  if (!user || report.status === 'confirmed' || report.status === 'resolved_pending_confirmation') return [];

  const siteAdmin = user.role === 'admin' && user.siteId != null && user.siteId === report.siteId;
  const routes: TechnicianRoute[] = [];
  if (report.policy.canAssign) routes.push('contracted');
  if (siteAdmin && report.assignedTechnicianId === null
    && ['open', 'routed', 'reopened', 'escalated'].includes(report.status)) routes.push('marketplace');
  return routes;
}
