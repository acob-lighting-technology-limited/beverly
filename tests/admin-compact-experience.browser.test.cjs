'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
(async () => {
  const { preview } = await import('vite');
  const root = path.resolve(__dirname, '..');
  const server = await preview({ root: path.join(root, 'apps/admin'), base: '/wallet-admin/', configFile: path.join(root, 'apps/admin/vite.config.ts'), preview: { host: '127.0.0.1', port: 0 } });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const customerId = '22222222-2222-4222-8222-222222222222';
  let lastSearch = '';
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
    await context.addInitScript(() => { localStorage.setItem('beverly.staff.access_token','test'); localStorage.setItem('beverly.staff.user',JSON.stringify({id:'staff',role:'super-admin',full_name:'Test Admin'})); });
    await context.route('**/api/**', route => {
      const u = new URL(route.request().url()); let body = {};
      if (u.pathname.endsWith('/admin/me')) body = { user: { id:'staff', role:'super-admin', full_name:'Test Admin' }, permissions: [] };
      else if (u.pathname.endsWith('/admin/customers/summary')) body = {};
      else if (u.pathname.endsWith('/admin/customers')) body = { customers: [{ id:customerId, full_name:'Test Customer', phone:'08000000000', status:'active', station_ids:[], balance_minor:0, kyc_tier:0 }], nextCursor:null };
      else if (u.pathname.endsWith('/admin/meter-orders/stats')) body = {};
      else if (u.pathname.endsWith('/admin/meter-orders')) { lastSearch = u.searchParams.get('q') || ''; body = {orders: [{ id:'order-1',customer_name_snapshot:'Test Customer',contact_phone:'08000000000',status:'pending_payment',meter_type:'single_phase',property_address:'Test address',service_area:'Test area',amount_minor:100000,created_at:'2026-10-29T10:00:00Z' }],nextCursor:null}; }
      else if (u.pathname.endsWith('/admin/notifications')) body = {notifications:[{id:'n1',type:'funding_approval',title:'Funding approval requested',body:'Reference requires review.',read:false,created_at:'2026-10-29T10:00:00Z',metadata:{path:'/funding'}}],nextCursor:null,unreadCount:1};
      else if (u.pathname.endsWith('/admin/funding/pending') || u.pathname.endsWith('/admin/funding/history')) body = { funding: [] };
      else if (u.pathname.endsWith('/admin/vending')) body = { purchases: [{ id:'purchase-1', actor_type:'vendor', vended_by_name:'Test Vendor', vendor_business_name:'Test Vendor', meter_id:'METER-1', station_id:'SITE-A', status:'delivered', amount_minor:100000, created_at:'2026-10-29T10:00:00Z' }] };
      else if (u.pathname.endsWith('/admin/stations')) body = { stations: [] };
      else if (u.pathname.endsWith('/support/tickets')) body = {tickets:[]};
      else if (u.pathname.endsWith('/support/tickets/stats')) body = {open:0};
      else if (u.pathname.endsWith('/support/chat/sessions')) body = {sessions:[]};
      else if (u.pathname.endsWith('/support/faqs')) body = {faqs:[]};
      else if (u.pathname.endsWith('/support/faq-categories')) body = {categories:[]};
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
    });
    const page = await context.newPage(); const base = `http://127.0.0.1:${server.httpServer.address().port}/wallet-admin`;
    for (const width of [320, 390, 581]) {
      await page.setViewportSize({width,height:844});
      await page.goto(`${base}/`);
      await page.locator('.recent-cards .bw-tc').first().waitFor();
      assert.equal(await page.locator('.recent-cards .bw-tc').first().getByText('Test Vendor', { exact: true }).count(), 1);
      const recentCard = await page.locator('.recent-cards .bw-tc').first().boundingBox();
      assert(recentCard && recentCard.x >= 0 && recentCard.x + recentCard.width <= width + 1);
      await page.goto(`${base}/customers`);
      const card = page.locator('.c-card').first(); await card.waitFor();
      assert((await card.boundingBox()).height < 210, 'customer card should remain compact');
      if (width === 390) await page.screenshot({path: 'C:/Users/FLOWPI~1/AppData/Local/Temp/beverly-compact-customer.png'});
      await card.getByRole('link', { name: 'Test Customer' }).focus();
      assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'A');
      await page.goto(`${base}/meter-orders`);
      await page.locator('.mo-card').first().waitFor();
      if (width === 390) await page.screenshot({path: 'C:/Users/FLOWPI~1/AppData/Local/Temp/beverly-compact-orders.png'});
      await page.getByLabel('Search meter orders').fill('Test area');
      await page.getByRole('button',{name:'Search',exact:true}).click();
      await page.waitForFunction(() => document.querySelector('.mo-card'));
      assert.equal(lastSearch,'Test area');
      await page.goto(`${base}/notifications`);
      await page.getByRole('button',{name:/Funding approval requested/}).waitFor();
      assert((await page.locator('.notification-card').first().boundingBox()).height < 150);
      await page.goto(`${base}/support`);
      await page.getByRole('heading',{name:'Support desk'}).waitFor();
      await page.goto(`${base}/guide`);
      await page.getByRole('heading',{name:'Find your way around Beverly.'}).waitFor();
      assert.equal(await page.getByText('Audit trail coverage').count(),0);
      const overflow = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, elements: [...document.querySelectorAll('main *')].filter(el => el.getBoundingClientRect().right > window.innerWidth + 2).slice(0, 8).map(el => `${el.tagName}.${el.className}`) }));
      assert(overflow.width <= width + 2, `page should fit the viewport: ${JSON.stringify(overflow)}`);
      if (width === 390) await page.screenshot({path: 'C:/Users/FLOWPI~1/AppData/Local/Temp/beverly-compact-guide.png'});
    }
    console.log('Compact customer, order, notification, support and guide journeys passed');
  } finally { await browser.close(); await new Promise(resolve=>server.httpServer.close(resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1});
