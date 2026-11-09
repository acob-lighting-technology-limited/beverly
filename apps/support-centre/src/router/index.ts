import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import LiveDeskView from '../views/LiveDeskView.vue';
import QueueView from '../views/QueueView.vue';
import CasesView from '../views/CasesView.vue';
import Customer360View from '../views/Customer360View.vue';
import IncidentsView from '../views/IncidentsView.vue';
import QualityView from '../views/QualityView.vue';
import AnalyticsView from '../views/AnalyticsView.vue';

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/live-desk' },
  {
    path: '/live-desk',
    name: 'live-desk',
    component: LiveDeskView,
    meta: { title: 'Live Desk', icon: 'zap' },
  },
  {
    path: '/queue',
    name: 'queue',
    component: QueueView,
    meta: { title: 'Queue & Workboard', icon: 'list' },
  },
  {
    path: '/cases',
    name: 'cases',
    component: CasesView,
    meta: { title: 'Cases', icon: 'folder' },
  },
  {
    path: '/customers',
    name: 'customers',
    component: Customer360View,
    meta: { title: 'Customer 360', icon: 'users' },
  },
  {
    path: '/incidents',
    name: 'incidents',
    component: IncidentsView,
    meta: { title: 'Incidents', icon: 'alert-triangle' },
  },
  {
    path: '/quality',
    name: 'quality',
    component: QualityView,
    meta: { title: 'Quality Reviews', icon: 'check-circle' },
  },
  {
    path: '/analytics',
    name: 'analytics',
    component: AnalyticsView,
    meta: { title: 'Analytics', icon: 'bar-chart' },
  },
  { path: '/:pathMatch(.*)*', redirect: '/live-desk' },
];

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL || '/support-centre/'),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

router.beforeEach((to, _from, next) => {
  if (to.meta?.title) {
    document.title = `${to.meta.title} · Beverly Support Centre`;
  }
  next();
});
