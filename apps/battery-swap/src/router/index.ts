import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import BsvMapPage from '../components/BsvMapPage.vue';
import BsvFleetPage from '../components/BsvFleetPage.vue';
import BsvCrmPage from '../components/BsvCrmPage.vue';
import BsvStationsPage from '../components/BsvStationsPage.vue';
import BsvDiagnosticsPage from '../components/BsvDiagnosticsPage.vue';
import LoginView from '../views/LoginView.vue';
import { useBatterySwapAuthStore } from '../stores/auth';

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/stations' },
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: { title: 'Sign In', public: true }
  },
  {
    path: '/stations',
    name: 'stations',
    component: BsvStationsPage,
    meta: { title: 'Swap Stations & Racks', icon: 'station', group: 'Infrastructure' }
  },
  {
    path: '/map',
    name: 'map',
    component: BsvMapPage,
    meta: { title: 'Live GPS Tracker', icon: 'map', group: 'Operations' }
  },
  {
    path: '/fleet',
    name: 'fleet',
    component: BsvFleetPage,
    meta: { title: 'Bike & Battery Registry', icon: 'bike', group: 'Operations' }
  },
  {
    path: '/crm',
    name: 'crm',
    component: BsvCrmPage,
    meta: { title: 'Rider Lease CRM', icon: 'users', group: 'Operations' }
  },
  {
    path: '/diagnostics',
    name: 'diagnostics',
    component: BsvDiagnosticsPage,
    meta: { title: 'Battery Diagnostics Lab', icon: 'activity', group: 'Infrastructure' }
  },
  { path: '/:pathMatch(.*)*', redirect: '/stations' }
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
    document.title = `${to.meta.title} · Beverly Battery Swap`;
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
    return next({ path: '/stations' });
  }

  next();
});
