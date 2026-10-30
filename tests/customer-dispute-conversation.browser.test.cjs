'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
(async () => {
  const { preview } = await import('vite');
  const root = path.resolve(__dirname, '..');
  const server = await preview({ root: path.join(root, 'apps/customer'), base: '/wallet-customer/', configFile: path.join(root, 'apps/customer/vite.config.ts'), preview: { host: '127.0.0.1', port: 0 } });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const caseId = '11111111-1111-4111-8111-111111111111';
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
    let attached = false;
    const profile = { id: 'customer', full_name: 'Test Customer', kyc_tier: 0, status: 'active' };
    await context.addInitScript(profile => { localStorage.setItem('beverly.customer.access_token', 'test-token'); localStorage.setItem('beverly.customer.profile', JSON.stringify(profile)); }, profile);
    await context.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      let body = {};
      const dispute = { id: caseId, reference: 'DISP-1', subject: 'Meter issue', status: 'open', description: 'Token issue', created_at: '2026-10-29T00:00:00Z', dispute_messages: [{ id: 'm1', sender_actor_type: 'staff', body: 'We are investigating.', created_at: '2026-10-29T00:00:00Z' }], evidence: attached ? [{ path: 'proof', url: 'https://storage.example.test/proof' }] : [] };
      if (url.pathname.endsWith('/customer/me')) body = profile;
      else if (url.pathname.endsWith('/customer/notifications')) body = { notifications: [{ id: 'notification', type: 'dispute_update', title: 'Dispute update', body: 'Support replied to your dispute.', read: true, metadata: { path: `/disputes?dispute=${caseId}` }, created_at: '2026-10-29T00:00:00Z' }], nextCursor: null, unreadCount: 0 };
      else if (url.pathname.endsWith(`/customer/disputes/${caseId}`)) body = dispute;
      else if (url.pathname.endsWith('/customer/disputes')) body = { disputes: [dispute] };
      else if (url.pathname.endsWith('/customer/receipts')) body = { receipts: [] };
      else if (url.pathname.endsWith(`/customer/disputes/${caseId}/evidence/upload-url`)) body = { signed_url: 'https://storage.example.test/upload', path: 'proof' };
      else if (url.pathname.endsWith(`/customer/disputes/${caseId}/evidence/activate`)) { attached = true; body = { evidence: dispute.evidence }; }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await context.route('https://storage.example.test/upload', route => route.fulfill({ status: 200, body: '' }));
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/wallet-customer/disputes`);
    await page.getByRole('button', { name: /Meter issue/ }).click();
    await page.getByText('We are investigating.').waitFor({ timeout: 5000 });
    assert.equal(await page.getByText('No messages yet.').count(), 0);
    assert.equal(await page.getByText('Add attachment', { exact: true }).count(), 2);
    await page.locator('input[type=file]').setInputFiles({ name: 'proof.pdf', mimeType: 'application/pdf', buffer: Buffer.from('synthetic proof') });
    await page.locator('button').filter({ hasText: 'Add attachment' }).click();
    await page.getByRole('link', { name: 'Attachment 1' }).waitFor({ timeout: 5000 });
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/wallet-customer/notifications`);
    await page.getByRole('button', { name: /Support replied to your dispute/ }).click();
    await page.getByRole('button', { name: 'Open update' }).click();
    await page.getByText('We are investigating.').waitFor({ timeout: 5000 });
    console.log('Customer dispute conversation and attachment controls passed');
  } finally { await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
