import type { Verification } from '@/services/onboarding';
import type { Report, Site, SiteAdminApplication } from '@/types';

export type PlatformDashboardData = {
  sites: Site[];
  pendingAdmins: number;
  pendingTechnicians: number;
  unattended: Report[];
  moreUnattended: boolean;
};

export function buildPlatformDashboardData(
  sites: Site[],
  adminApplications: SiteAdminApplication[],
  verifications: Verification[],
  unattended: Report[],
  moreUnattended: boolean,
): PlatformDashboardData {
  return {
    sites,
    pendingAdmins: adminApplications.filter((item) => item.status === 'pending').length,
    pendingTechnicians: verifications.filter((item) => item.status === 'pending').length,
    unattended,
    moreUnattended,
  };
}
