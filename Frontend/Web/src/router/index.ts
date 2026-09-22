import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from 'vue-router';

import { useAuthStore } from '@/stores/auth';

const routes: RouteRecordRaw[] = [
  {
    path: '/preview',
    component: () => import('@/layouts/AppLayout.vue'),
    children: [{ path: '', name: 'dashboard-preview', component: () => import('@/views/app/HomeView.vue') }],
  },
  {
    path: '/login',
    component: () => import('@/layouts/AuthLayout.vue'),
    meta: { guest: true },
    children: [
      {
        path: '',
        name: 'login',
        component: () => import('@/views/auth/LoginView.vue'),
      },
    ],
  },
  {
    path: '/register',
    component: () => import('@/layouts/AuthLayout.vue'),
    meta: { guest: true },
    children: [
      {
        path: '',
        name: 'register',
        component: () => import('@/views/auth/RegisterView.vue'),
      },
    ],
  },
  {
    path: '/',
    component: () => import('@/layouts/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'home',
        component: () => import('@/views/app/HomeView.vue'),
      },
      {
        path: 'reports',
        name: 'reports',
        component: () => import('@/views/app/ReportsView.vue'),
      },
      {
        path: 'profile',
        name: 'profile',
        component: () => import('@/views/app/ProfileView.vue'),
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to) {
    if (to.hash) return { el: to.hash, behavior: 'smooth' };
    return { top: 0 };
  },
});

router.beforeEach((to) => {
  const auth = useAuthStore();

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  if (to.meta.guest && auth.isAuthenticated) {
    return { name: 'home' };
  }

  return true;
});
