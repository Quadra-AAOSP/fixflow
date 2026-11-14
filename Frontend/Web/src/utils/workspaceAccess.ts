import type { User, UserRole } from '@/types';

// Screen visibility is UX policy; the API remains the authorization authority.
export const workspaceRoles = {
  dashboard: ['staff', 'admin', 'super_admin'],
  reporter: ['reporter'],
  reports: ['reporter', 'staff', 'admin', 'super_admin', 'technician'],
  newReport: ['reporter', 'staff', 'admin', 'super_admin'],
  sites: ['reporter', 'staff', 'admin', 'super_admin'],
  assignments: ['staff', 'admin', 'super_admin'],
  team: ['admin', 'super_admin'],
  contracts: ['technician', 'admin', 'super_admin'],
  technician: ['technician'],
  marketplace: ['admin', 'super_admin', 'technician'],
  application: ['reporter'],
} as const;

/** Visible top-level nav slots, including a possible trailing "More" entry. */
export const PRIMARY_NAV_LIMIT = 5;

export type WorkspaceLink = { to: string; label: string; icon: string };

export function workspaceLinks(user: User | null, hasSite: boolean): WorkspaceLink[] {
  if (!user || user.applicationOnly) return [];
  const role = user.role;
  const links: WorkspaceLink[] = [];
  if (role === 'shop_manager') return [
    { to: '/shop/dashboard', label: 'Dashboard', icon: 'home' },
    { to: '/shop/orders-management', label: 'Orders', icon: 'shop' },
    { to: '/shop/manage', label: 'Product management', icon: 'shop' },
    { to: '/profile', label: 'Profile', icon: 'profile' },
  ];
  if (role === 'reporter') links.push({ to: '/reports/new', label: 'Report issue', icon: 'reports' }, { to: '/reporter', label: 'My reports', icon: 'home' }, { to: '/building-suggestions', label: 'My building suggestions', icon: 'sites' });
  else if (role === 'technician') links.push({ to: '/technician', label: 'My workspace', icon: 'technician' });
  else if (workspaceRoles.dashboard.some(value => value === role)) links.push({ to: '/', label: 'Dashboard', icon: 'home' });
  if (role !== 'reporter' && (role !== 'technician' || hasSite)) links.push({ to: '/reports', label: 'Reports', icon: 'reports' });
  if (workspaceRoles.sites.some(value => value === role)) links.push({ to: '/sites', label: 'Sites', icon: 'sites' });
  if (workspaceRoles.assignments.some(value => value === role)) links.push({ to: '/assignments', label: 'Assignments', icon: 'assignments' });
  if (workspaceRoles.contracts.some(value => value === role)) links.push({ to: '/contracts', label: 'Site contracts', icon: 'contracts' });
  if (workspaceRoles.marketplace.some(value => value === role)) links.push({ to: '/marketplace', label: 'Job marketplace', icon: 'assignments' });
  if (workspaceRoles.team.some(value => value === role)) links.push({ to: '/site-rules', label: 'Site category', icon: 'team' });
  if (workspaceRoles.team.some(value => value === role)) links.push({ to: '/team', label: 'Team', icon: 'team' });
  if (workspaceRoles.team.some(value => value === role)) links.push({ to: '/team-access', label: 'Team access', icon: 'team' });
  if (role === 'reporter' && user.adminApplication) links.push({ to: '/admin-application', label: 'My application', icon: 'team' });
  if (role === 'super_admin') links.push({ to: '/shop/manage', label: 'Product management', icon: 'shop' });
  if (role === 'super_admin') links.push({ to: '/site-applications', label: 'Site applications', icon: 'team' },
    { to: '/technician-verifications', label: 'Technician verification', icon: 'team' });
  if (role !== 'reporter') links.push({ to: '/shop', label: 'Shop', icon: 'shop' });
  return links;
}

/** Preferred order for each role; overflow after the primary limit goes under More. */
const destinationOrder: Record<UserRole, string[]> = {
  reporter: ['/reporter', '/reports/new', '/sites', '/building-suggestions', '/admin-application'],
  staff: ['/', '/reports', '/assignments', '/sites', '/shop'],
  admin: ['/', '/reports', '/marketplace', '/sites', '/team', '/assignments', '/contracts', '/team-access', '/site-rules', '/shop'],
  super_admin: ['/', '/reports', '/marketplace', '/sites', '/team', '/shop', '/assignments', '/contracts', '/team-access', '/site-rules', '/shop/manage', '/site-applications', '/technician-verifications'],
  technician: ['/technician', '/marketplace', '/contracts', '/reports', '/shop'],
  shop_manager: ['/shop/dashboard', '/shop/orders-management', '/shop/manage', '/profile'],
};

function relabel(user: User, link: WorkspaceLink): WorkspaceLink {
  if (user.role === 'reporter' && link.to === '/sites') return { ...link, label: 'My site' };
  if (user.role === 'technician' && link.to === '/marketplace') return { ...link, label: 'Jobs' };
  return link;
}

export function workspaceNavigation(user: User | null, hasSite: boolean) {
  const links = workspaceLinks(user, hasSite);
  if (!user || user.applicationOnly) return { primary: [] as WorkspaceLink[], more: [] as WorkspaceLink[] };
  const ordered = destinationOrder[user.role]
    .flatMap(destination => links.filter(link => link.to === destination))
    .map(link => relabel(user, link));
  if (ordered.length <= PRIMARY_NAV_LIMIT) {
    return { primary: ordered, more: [] as WorkspaceLink[] };
  }
  const keep = PRIMARY_NAV_LIMIT - 1;
  return { primary: ordered.slice(0, keep), more: ordered.slice(keep) };
}

/** Shared by initial routing and subsequent authenticated role changes. */
export function shopManagerRouteAllowed(name: unknown) {
  return ['settings', 'profile', 'shop-management', 'shop-dashboard', 'shop-orders-management', 'shop-managed-order'].includes(String(name));
}
