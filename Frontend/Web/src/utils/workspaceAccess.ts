import type { User } from '@/types';

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
  application: ['reporter'],
} as const;

export function workspaceLinks(user: User | null, hasSite: boolean) {
  if (!user) return [];
  const role = user.role;
  const links: { to: string; label: string; icon: string }[] = [];
  if (role === 'shop_manager') return [
    { to: '/shop/manage', label: 'Product management', icon: 'shop' },
    { to: '/profile', label: 'Profile', icon: 'profile' },
  ];
  if (role === 'reporter') links.push({ to: '/reporter', label: 'My reports', icon: 'home' }, { to: '/building-suggestions', label: 'My building suggestions', icon: 'sites' });
  else if (role === 'technician') links.push({ to: '/technician', label: 'My workspace', icon: 'technician' });
  else if (workspaceRoles.dashboard.some(value => value === role)) links.push({ to: '/', label: 'Dashboard', icon: 'home' });
  if (role !== 'reporter' && (role !== 'technician' || hasSite)) links.push({ to: '/reports', label: 'Reports', icon: 'reports' });
  if (workspaceRoles.sites.some(value => value === role)) links.push({ to: '/sites', label: 'Sites', icon: 'sites' });
  if (workspaceRoles.assignments.some(value => value === role)) links.push({ to: '/assignments', label: 'Assignments', icon: 'assignments' });
  if (workspaceRoles.contracts.some(value => value === role)) links.push({ to: '/contracts', label: 'Site contracts', icon: 'contracts' });
  if (role === 'technician') links.push({ to: '/technician/marketplace', label: 'Find sites hiring', icon: 'sites' }, { to: '/technician/invitations', label: 'Invitations', icon: 'invitations' });
  if (workspaceRoles.team.some(value => value === role)) links.push({ to: '/site-rules', label: 'Site rules', icon: 'team' });
  if (workspaceRoles.team.some(value => value === role)) links.push({ to: '/team-access', label: 'Team access', icon: 'team' });
  if (role === 'reporter' && user.adminApplication) links.push({ to: '/admin-application', label: 'My application', icon: 'team' });
  if (role === 'super_admin') links.push({ to: '/shop/manage', label: 'Product management', icon: 'shop' });
  links.push({ to: '/shop', label: 'Shop', icon: 'shop' });
  return links;
}

/** Shared by initial routing and subsequent authenticated role changes. */
export function shopManagerRouteAllowed(name: unknown) {
  return ['profile', 'shop-management'].includes(String(name));
}
