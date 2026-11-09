import { createRouter, createWebHistory, type RouteRecordRaw, type RouterHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { shopManagerRouteAllowed, workspaceRoles } from '@/utils/workspaceAccess';
import { accountHome } from '@/utils/navigation';

const routes: RouteRecordRaw[] = [
  { path: '/agreements/technician/draft-2026-11-03', redirect: '/agreements/technician/2026-11-03' },
  { path: '/agreements/technician/2026-11-03', name: 'technician-agreement', component: () => import('@/views/auth/TechnicianAgreementView.vue') },
  { path: '/request-site', name: 'request-site', component: () => import('@/views/auth/SiteApplicationView.vue') },
  { path: '/site-application', name: 'site-application-status', component: () => import('@/views/auth/SiteApplicationView.vue') },
  { path: '/application-access', name: 'application-access', meta: { requiresAuth: true }, props: { applicationOnly: true }, component: () => import('@/views/app/AdminApplicationView.vue') },
  { path: '/setup-site-admin', name: 'site-admin-setup', component: () => import('@/views/auth/SiteApplicationView.vue') },
  { path: '/shop', component: () => import('@/layouts/ShopLayout.vue'), children: [
    { path: '', name: 'shop', component: () => import('@/views/app/ShopView.vue') },
    { path: 'orders/:orderId', name: 'shop-order', meta: { requiresAuth: true }, component: () => import('@/views/app/ShopOrderView.vue') },
    { path: 'dashboard', name: 'shop-dashboard', meta: { requiresAuth: true, roles: ['shop_manager', 'super_admin'] }, component: () => import('@/views/app/ShopDashboardView.vue') },
    { path: 'orders-management', name: 'shop-orders-management', meta: { requiresAuth: true, roles: ['shop_manager', 'super_admin'] }, component: () => import('@/views/app/ShopOrdersManagementView.vue') },
    { path: 'orders-management/:orderId', name: 'shop-managed-order', meta: { requiresAuth: true, roles: ['shop_manager', 'super_admin'] }, component: () => import('@/views/app/ShopOrdersManagementView.vue') },
    { path: 'manage', name: 'shop-management', meta: { requiresAuth: true, roles: ['shop_manager', 'super_admin'] }, component: () => import('@/views/app/ShopManagementView.vue') },
  ] },
  { path: '/preview', redirect: '/' },
  { path: '/access-policy', component: () => import('@/layouts/AuthLayout.vue'), children: [{ path: '', name: 'access-policy', component: () => import('@/views/auth/AccessPolicyView.vue') }] },
  { path: '/login', component: () => import('@/layouts/AuthLayout.vue'), meta: { guest: true }, children: [
    { path: '', name: 'login', component: () => import('@/views/auth/LoginView.vue') },
  ] },
  { path: '/register', component: () => import('@/layouts/AuthLayout.vue'), meta: { guest: true }, children: [
    { path: '', name: 'register', component: () => import('@/views/auth/RegisterView.vue') },
  ] },
  { path: '/', component: () => import('@/layouts/AppLayout.vue'), meta: { requiresAuth: true }, children: [
    { path: 'site-applications', name: 'site-applications', meta: { roles: ['super_admin'] }, component: () => import('@/views/app/SiteApplicationsView.vue') },
    { path: 'technician-verifications', name: 'technician-verifications', meta: { roles: ['super_admin'] }, component: () => import('@/views/app/TechnicianVerificationReviewView.vue') },
    { path: '', name: 'home', meta: { roles: [...workspaceRoles.dashboard] }, component: () => import('@/views/app/HomeView.vue') },
    { path: 'reporter', name: 'reporter-home', meta: { roles: [...workspaceRoles.reporter] }, component: () => import('@/views/app/ReporterHomeView.vue') },
    { path: 'reports', name: 'reports', meta: { roles: [...workspaceRoles.reports] }, component: () => import('@/views/app/ReportsView.vue') },
    { path: 'reports/new', name: 'new-report', meta: { roles: [...workspaceRoles.newReport] }, component: () => import('@/views/app/ReportFormView.vue') },
    { path: 'reports/:id', name: 'report-detail', meta: { roles: [...workspaceRoles.reports] }, component: () => import('@/views/app/ReportDetailView.vue') },
    { path: 'sites', name: 'sites', meta: { roles: [...workspaceRoles.sites] }, component: () => import('@/views/app/SitesView.vue') },
    { path: 'sites/:siteId', name: 'site-detail', meta: { roles: [...workspaceRoles.sites] }, component: () => import('@/views/app/SiteDetailView.vue') },
    { path: 'sites/:siteId/subsites', name: 'subsites', meta: { roles: [...workspaceRoles.sites] }, component: () => import('@/views/app/SubsitesView.vue') },
    { path: 'assignments', name: 'assignments', meta: { roles: [...workspaceRoles.assignments] }, component: () => import('@/views/app/AssignmentsView.vue') },
    { path: 'technician', name: 'technician', meta: { roles: ['technician'] }, component: () => import('@/views/app/TechnicianView.vue') },
    { path: 'technician/marketplace', name: 'technician-marketplace', meta: { roles: ['technician'] }, component: () => import('@/views/app/TechnicianMarketplaceView.vue') },
    { path: 'building-suggestions', name: 'building-suggestions', meta: { roles: ['reporter'] }, component: () => import('@/views/app/BuildingSuggestionsView.vue') },
    { path: 'marketplace', name: 'marketplace', meta: { roles: [...workspaceRoles.marketplace] }, component: () => import('@/views/app/MarketplaceView.vue') },
    { path: 'technician/invitations', name: 'technician-invitations', meta: { roles: ['technician'] }, component: () => import('@/views/app/TechnicianInvitationsView.vue') },
    { path: 'site-rules', name: 'site-rules', meta: { roles: [...workspaceRoles.team] }, component: () => import('@/views/app/SiteRulesView.vue') },
    { path: 'team-access', name: 'team-access', meta: { roles: ['admin', 'super_admin'] }, component: () => import('@/views/app/TeamAccessView.vue') },
    { path: 'contracts', name: 'contracts', meta: { roles: ['technician', 'admin', 'super_admin'] }, component: () => import('@/views/app/ContractsView.vue') },
    { path: 'profile', name: 'profile', component: () => import('@/views/app/ProfileView.vue') },
    { path: 'admin-application', name: 'admin-application', meta: { roles: [...workspaceRoles.application] }, component: () => import('@/views/app/AdminApplicationView.vue') },
  ] },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];
export function createAppRouter(history: RouterHistory = createWebHistory()) {
  const router = createRouter({ history, routes, scrollBehavior(to) {
    return to.hash ? { el: to.hash, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' } : { top: 0 };
  } });
  router.beforeEach(async to => {
    const auth = useAuthStore();
    await auth.hydrate();
    if (to.meta.requiresAuth && !auth.isAuthenticated) return { name: 'login', query: { redirect: to.fullPath } };
    if (auth.user?.applicationOnly) return to.name === 'application-access' || { name: 'application-access' };
    if (to.name === 'application-access') return accountHome(auth.user);
    if (to.meta.guest && auth.isAuthenticated) return accountHome(auth.user);
    if (auth.user?.role === 'reporter' && to.path.startsWith('/shop')) return accountHome(auth.user);
    if (auth.user?.role === 'shop_manager' && to.name === 'shop') return '/shop/orders-management';
    if (auth.user?.role === 'shop_manager' && to.meta.requiresAuth && !shopManagerRouteAllowed(to.name)) return '/shop/dashboard';
    if (Array.isArray(to.meta.roles) && !to.meta.roles.includes(auth.user?.role)) return accountHome(auth.user);
    if (to.name === 'home' && auth.user?.role === 'technician') return { name: 'technician' };
    return true;
  });
  return router;
}
export const router = createAppRouter();
