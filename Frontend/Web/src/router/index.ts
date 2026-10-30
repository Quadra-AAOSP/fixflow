import { createRouter, createWebHistory, type RouteRecordRaw, type RouterHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { accountHome } from '@/utils/navigation';

const routes: RouteRecordRaw[] = [
  { path: '/shop', component: () => import('@/layouts/ShopLayout.vue'), children: [{ path: '', name: 'shop', component: () => import('@/views/app/ShopView.vue') }] },
  { path: '/preview', redirect: '/' },
  { path: '/access-policy', component: () => import('@/layouts/AuthLayout.vue'), children: [{ path: '', name: 'access-policy', component: () => import('@/views/auth/AccessPolicyView.vue') }] },
  { path: '/login', component: () => import('@/layouts/AuthLayout.vue'), meta: { guest: true }, children: [
    { path: '', name: 'login', component: () => import('@/views/auth/LoginView.vue') },
  ] },
  { path: '/register', component: () => import('@/layouts/AuthLayout.vue'), meta: { guest: true }, children: [
    { path: '', name: 'register', component: () => import('@/views/auth/RegisterView.vue') },
  ] },
  { path: '/', component: () => import('@/layouts/AppLayout.vue'), meta: { requiresAuth: true }, children: [
    { path: '', name: 'home', component: () => import('@/views/app/HomeView.vue') },
    { path: 'reports', name: 'reports', component: () => import('@/views/app/ReportsView.vue') },
    { path: 'reports/new', name: 'new-report', component: () => import('@/views/app/ReportFormView.vue') },
    { path: 'reports/:id', name: 'report-detail', component: () => import('@/views/app/ReportDetailView.vue') },
    { path: 'sites', name: 'sites', component: () => import('@/views/app/SitesView.vue') },
    { path: 'sites/:siteId/subsites', name: 'subsites', component: () => import('@/views/app/SubsitesView.vue') },
    { path: 'assignments', name: 'assignments', component: () => import('@/views/app/AssignmentsView.vue') },
    { path: 'technician', name: 'technician', meta: { roles: ['technician'] }, component: () => import('@/views/app/TechnicianView.vue') },
    { path: 'technician/invitations', name: 'technician-invitations', meta: { roles: ['technician'] }, component: () => import('@/views/app/TechnicianInvitationsView.vue') },
    { path: 'team-access', name: 'team-access', meta: { roles: ['admin', 'super_admin'] }, component: () => import('@/views/app/TeamAccessView.vue') },
    { path: 'contracts', name: 'contracts', meta: { roles: ['technician', 'admin', 'super_admin'] }, component: () => import('@/views/app/ContractsView.vue') },
    { path: 'profile', name: 'profile', component: () => import('@/views/app/ProfileView.vue') },
    { path: 'admin-application', name: 'admin-application', component: () => import('@/views/app/AdminApplicationView.vue') },
  ] },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];
export function createAppRouter(history: RouterHistory = createWebHistory()) {
  const router = createRouter({ history, routes, scrollBehavior(to) {
    return to.hash ? { el: to.hash, behavior: 'smooth' } : { top: 0 };
  } });
  router.beforeEach(async to => {
    const auth = useAuthStore();
    await auth.hydrate();
    if (to.meta.requiresAuth && !auth.isAuthenticated) return { name: 'login', query: { redirect: to.fullPath } };
    if (to.meta.guest && auth.isAuthenticated) return accountHome(auth.user);
    if (auth.user?.role === 'shop_manager' && to.meta.requiresAuth && to.name !== 'profile') return '/shop';
    if (Array.isArray(to.meta.roles) && !to.meta.roles.includes(auth.user?.role)) return { name: 'home' };
    if (to.name === 'home' && auth.user?.role === 'technician') return { name: 'technician' };
    return true;
  });
  return router;
}
export const router = createAppRouter();
