import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import LiveMapPage from '../views/LiveMapPage.vue';
import DiagnosticsPage from '../views/DiagnosticsPage.vue';
import RegistryPage from '../views/RegistryPage.vue';
import SalesPage from '../views/SalesPage.vue';
import LoginView from '../views/LoginView.vue';
import ForgotPasswordView from '../views/ForgotPasswordView.vue';
import ResetPasswordView from '../views/ResetPasswordView.vue';
import PueHubView from '../views/PueHubView.vue';
import { useBatterySwapAuthStore } from '../stores/auth';

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/hub' },
  {
    // First screen after sign-in: pick Battery Swap Stations or Electronic Appliances.
    path: '/hub',
    name: 'hub',
    component: PueHubView,
    meta: { title: 'PUE Hub', standalone: true }
  },
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: { title: 'Sign In', public: true }
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: ForgotPasswordView,
    meta: { title: 'Forgot Password', public: true }
  },
  {
    path: '/reset-password',
    name: 'reset-password',
    component: ResetPasswordView,
    meta: { title: 'Reset Password', public: true }
  },
  {
    path: '/sites',
    name: 'sites',
    component: RegistryPage,
    meta: { title: 'Sites', resource: 'sites' }
  },
  {
    path: '/swap-stations',
    name: 'swap-stations',
    component: RegistryPage,
    meta: { title: 'Swap stations', resource: 'swap-stations' }
  },
  {
    path: '/bikes',
    name: 'bikes',
    component: RegistryPage,
    meta: { title: 'Bikes', resource: 'bikes' }
  },
  {
    path: '/batteries',
    name: 'batteries',
    component: RegistryPage,
    meta: { title: 'Batteries', resource: 'batteries' }
  },
  {
    path: '/riders',
    name: 'riders',
    component: RegistryPage,
    meta: { title: 'Riders', resource: 'riders' }
  },
  { path: '/sales', name: 'sales', component: SalesPage, meta: { title: 'Bike sales' } },
  // Old demo pages were replaced by the registry screens above.
  { path: '/stations', redirect: '/sites' },
  { path: '/fleet', redirect: '/bikes' },
  { path: '/crm', redirect: '/riders' },
  {
    path: '/map',
    name: 'map',
    component: LiveMapPage,
    meta: { title: 'Live map' }
  },
  {
    path: '/diagnostics',
    name: 'diagnostics',
    component: DiagnosticsPage,
    meta: { title: 'Diagnostics' }
  },
  { path: '/:pathMatch(.*)*', redirect: '/hub' }
];

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL || '/battery-swap/'),
  routes,
  scrollBehavior() {
    return { top: 0 };
  }
});

router.beforeEach((to, _from, next) => {
  if (to.meta?.title) {
    document.title = `${to.meta.title} · Beverly PUE`;
  }

  const auth = useBatterySwapAuthStore();
  auth.hydrate();

  const isPublic = Boolean(to.meta?.public);

  if (!isPublic && !auth.isAuthenticated) {
    return next({
      path: '/login',
      query: { redirect: to.fullPath }
    });
  }

  if (to.path === '/login' && auth.isAuthenticated) {
    return next({ path: '/hub' });
  }

  next();
});
