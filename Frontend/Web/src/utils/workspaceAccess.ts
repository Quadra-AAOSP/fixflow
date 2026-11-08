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
  marketplace: ['admin', 'technician'],
  application: ['reporter'],
} as const;

export function workspaceLinks(user: User | null, hasSite: boolean) {
  if (!user || user.applicationOnly) return [];
  const role = user.role;
  const links: { to: string; label: string; icon: string }[] = [];
  if (role === 'shop_manager') return [
    { to: '/shop/dashboard', label: 'Dashboard', icon: 'home' },
    { to: '/shop/orders-management', label: 'Orders', icon: 'shop' },
    { to: '/shop/manage', label: 'Product management', icon: 'shop' },
    { to: '/profile', label: 'Profile', icon: 'profile' },
  ];
  if (role === 'reporter') links.push({ to: '/reporter', label: 'My reports', icon: 'home' });
  else if (role === 'technician') links.push({ to: '/technician', label: 'My workspace', icon: 'technician' });
  else if (workspaceRoles.dashboard.some(value => value === role)) links.push({ to: '/', label: 'Dashboard', icon: 'home' });
  if (role !== 'technician' || hasSite) links.push({ to: '/reports', label: 'Reports', icon: 'reports' });
  if (workspaceRoles.sites.some(value => value === role)) links.push({ to: '/sites', label: 'Sites', icon: 'sites' });
  if (workspaceRoles.assignments.some(value => value === role)) links.push({ to: '/assignments', label: 'Assignments', icon: 'assignments' });
  if (workspaceRoles.contracts.some(value => value === role)) links.push({ to: '/contracts', label: 'Site contracts', icon: 'contracts' });
  if (role === 'technician') links.push({ to: '/technician/invitations', label: 'Invitations', icon: 'invitations' });
  if (workspaceRoles.marketplace.some(value => value === role)) links.push({ to: '/marketplace', label: 'Job marketplace', icon: 'assignments' });
  if (workspaceRoles.team.some(value => value === role)) links.push({ to: '/site-rules', label: 'Site rules', icon: 'team' });
  if (workspaceRoles.team.some(value => value === role)) links.push({ to: '/team-access', label: 'Team access', icon: 'team' });
  if (role === 'reporter' && user.adminApplication) links.push({ to: '/admin-application', label: 'My application', icon: 'team' });
  if (role === 'super_admin') links.push({ to: '/shop/manage', label: 'Product management', icon: 'shop' });
  if (role === 'super_admin') links.push({ to: '/site-applications', label: 'Site applications', icon: 'team' },
    { to: '/technician-verifications', label: 'Technician verification', icon: 'team' });
  links.push({ to: '/shop', label: 'Shop', icon: 'shop' });
  return links;
}

const primaryDestinations: Record<UserRole, string[]> = {
  reporter: ['/reporter', '/reports', '/sites'],
  staff: ['/', '/reports', '/assignments'],
  admin: ['/', '/reports', '/team-access'],
  super_admin: ['/', '/sites'],
  technician: ['/technician', '/marketplace'],
  shop_manager: ['/shop/dashboard', '/profile'],
};

export function workspaceNavigation(user: User | null, hasSite: boolean) {
  const links = workspaceLinks(user, hasSite);
  if (!user) return { primary: [], more: [] };
  const destinations = primaryDestinations[user.role];
  const primary = destinations.flatMap(destination => links.filter(link => link.to === destination));
  return { primary, more: links.filter(link => !destinations.includes(link.to)) };
}

/** Shared by initial routing and subsequent authenticated role changes. */
export function shopManagerRouteAllowed(name: unknown) {
  return ['profile', 'shop-management', 'shop-order', 'shop-dashboard', 'shop-orders-management', 'shop-managed-order'].includes(String(name));
}
