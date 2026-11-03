import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import BsvMapPage from '../components/BsvMapPage.vue';
import BsvFleetPage from '../components/BsvFleetPage.vue';
import BsvCrmPage from '../components/BsvCrmPage.vue';
import BsvStationsPage from '../components/BsvStationsPage.vue';
import BsvDiagnosticsPage from '../components/BsvDiagnosticsPage.vue';

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/map' },
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
    path: '/stations',
    name: 'stations',
    component: BsvStationsPage,
    meta: { title: 'Swap Stations & Racks', icon: 'station', group: 'Infrastructure' }
  },
  {
    path: '/diagnostics',
    name: 'diagnostics',
    component: BsvDiagnosticsPage,
    meta: { title: 'Battery Diagnostics Lab', icon: 'activity', group: 'Infrastructure' }
  },
  { path: '/:pathMatch(.*)*', redirect: '/map' }
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
  next();
});
