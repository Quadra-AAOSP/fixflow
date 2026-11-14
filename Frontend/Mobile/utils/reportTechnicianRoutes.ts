import type { Report, User } from '@/types';

export type TechnicianRoute = 'contracted' | 'marketplace';

type ReportRouting = Pick<Report, 'status' | 'siteId' | 'assignedTechnicianId'>
  & { policy?: Pick<NonNullable<Report['policy']>, 'canAssign'> | null };

export function reportTechnicianRoutes(
  report: ReportRouting,
  user: Pick<User, 'role' | 'siteId'> | null,
): TechnicianRoute[] {
  if (!user || report.status === 'confirmed' || report.status === 'resolved_pending_confirmation') return [];

  const siteAdmin = user.role === 'admin' && user.siteId != null && user.siteId === report.siteId;
  const manager = user.role === 'admin' || user.role === 'super_admin' || user.role === 'staff';
  const routes: TechnicianRoute[] = [];
  if (report.policy?.canAssign ?? manager) routes.push('contracted');
  if (
    (siteAdmin || user.role === 'super_admin') &&
    report.assignedTechnicianId === null &&
    ['open', 'routed', 'reopened', 'escalated'].includes(report.status)
  ) {
    routes.push('marketplace');
  }
  return routes;
}
