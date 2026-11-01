'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const { preview } = await import('vite');
  const root = path.resolve(__dirname, '..');
  const server = await preview({ root: path.join(root, 'apps/admin'), base: '/wallet-admin/', configFile: path.join(root, 'apps/admin/vite.config.ts'), preview: { host: '127.0.0.1', port: 0 } });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ticket = { id: 'ticket-1', reference: 'TKT-1', subject: 'Meter issue', status: 'open', priority: 'normal', category: 'general', requester_actor_type: 'customer', requester_name: 'Test customer', customer_id: 'customer-1', meter_context: [{ meter_id: 'MTR-1', station_id: 'TUNGA' }], last_message_at: '2026-10-30T10:00:00Z', support_ticket_messages: [] };
  const session = { id: 'chat-1', display_name: 'Test customer', requester_actor_type: 'customer', customer_id: 'customer-1', status: 'active', unread_for_staff: 0, meter_context: [{ meter_id: 'MTR-1', station_id: 'TUNGA' }], last_message_at: '2026-10-30T10:00:00Z' };
  try {
    const context = await browser.newContext({ viewport: { width: 1100, height: 800 }, serviceWorkers: 'block' });
    await context.addInitScript(() => {
      localStorage.setItem('beverly.staff.access_token', 'test-token');
      localStorage.setItem('beverly.staff.user', JSON.stringify({ id: 'staff', role: 'super-admin', full_name: 'Test staff' }));
      localStorage.setItem('beverly.staff.permissions', JSON.stringify(['wallet.support.manage', 'wallet.customers.view']));
    });
    await context.route('**/api/**', route => {
      const p = new URL(route.request().url()).pathname;
      let body = {};
      if (p.endsWith('/admin/me')) body = { user: { id: 'staff', role: 'super-admin', full_name: 'Test staff' }, permissions: ['wallet.support.manage', 'wallet.customers.view'] };
      else if (p.endsWith('/support/tickets/ticket-1')) body = ticket;
      else if (p.endsWith('/support/tickets/stats')) body = { total: 1, open: 1 };
      else if (p.endsWith('/support/tickets')) body = { tickets: [ticket] };
      else if (p.endsWith('/support/chat/sessions')) body = { sessions: [session] };
      else if (p.endsWith('/support/chat/chat-1/messages')) body = { messages: [] };
      else if (p.endsWith('/customers/customer-1')) body = { customer: { full_name: 'Test customer', phone: '123', status: 'active' } };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/wallet-admin/support`);
    await page.locator('tr').filter({ hasText: 'TKT-1' }).click();
    const details = page.getByLabel('Requester details');
    await details.getByText('MTR-1 · TUNGA').waitFor();
    await details.getByText('123').waitFor();
    await page.screenshot({ path: path.join(process.env.TEMP || '.', 'beverly-admin-support-check.png') });
    assert.equal(await details.getByRole('link', { name: 'Open customer profile' }).getAttribute('href'), '/wallet-admin/customers/customer-1');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: /Live chat/ }).click();
    await page.getByRole('button', { name: /Test customer/ }).click();
    await page.getByLabel('Requester details').getByText('MTR-1 · TUNGA').waitFor();
    await page.screenshot({ path: path.join(process.env.TEMP || '.', 'beverly-admin-chat-check.png') });
    await context.close();
    console.log('Admin support context browser checks passed.');
  } finally { await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
