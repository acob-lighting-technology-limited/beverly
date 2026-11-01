'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const dist = path.resolve(__dirname, '..', 'dist', 'wallet-admin');
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const requirement = { identity: ['national_id'], selfie: false, address: [] };
let policy = { customer_enabled: false, vendor_enabled: false, customer_scope: 'all', vendor_scope: 'all', customer_enforced_from: null, vendor_enforced_from: null, allowed_mime_types: ['image/png'], customer: { tier1: requirement, tier2: requirement }, vendor: { tier2: requirement } };

(async () => {
  assert.ok(fs.existsSync(path.join(dist, 'index.html')), 'Build admin first.');
  const server = http.createServer((req, res) => {
    const relative = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/wallet-admin\/?/, '');
    const target = path.resolve(dist, relative || 'index.html');
    const file = target.startsWith(dist) && fs.existsSync(target) && fs.statSync(target).isFile() ? target : path.join(dist, 'index.html');
    res.writeHead(200, { 'content-type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(edge) ? { executablePath: edge } : {}) });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(() => {
      localStorage.setItem('beverly.staff.access_token', 'test-token');
      localStorage.setItem('beverly.staff.user', JSON.stringify({ id: 'staff', email: 'test@example.test', full_name: 'Test', role: 'developer' }));
      localStorage.setItem('beverly.staff.permissions', JSON.stringify(['wallet.kyc.settings.manage']));
    });
    await context.route('**/api/v1/admin/**', route => {
      const request = route.request();
      const p = new URL(request.url()).pathname;
      let data = {};
      if (p.endsWith('/me')) data = { user: { id: 'staff', role: 'developer' }, permissions: ['wallet.kyc.settings.manage'] };
      if (p.endsWith('/kyc/settings')) data = { policy: { tier0DailyLimitMinor: 100, tier1DailyLimitMinor: 200, tier2DailyLimitMinor: null, tier0MeterLimit: 1, tier1MeterLimit: 2, tier2MeterLimit: 3, version: 1 } };
      if (p.endsWith('/kyc/settings/history')) data = { history: [] };
      if (p.endsWith('/kyc-policy')) { if (request.method() === 'PUT') policy = request.postDataJSON().policy; data = { policy }; }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/wallet-admin/kyc-settings`, { waitUntil: 'domcontentloaded' });
    const customer = page.locator('label.availability-control').filter({ hasText: 'Customer KYC' }).getByRole('checkbox');
    const vendor = page.locator('label.availability-control').filter({ hasText: 'Vendor KYC' }).getByRole('checkbox');
    await customer.check(); await vendor.check();
    await page.getByRole('button', { name: 'Save rollout' }).click();
    await page.getByText('KYC requirements updated for customers and vendors.').first().waitFor();
    assert.equal(policy.customer_enabled, true); assert.equal(policy.vendor_enabled, true);
    await page.reload();
    await customer.waitFor();
    assert.equal(await customer.isChecked(), true); assert.equal(await vendor.isChecked(), true);
    await customer.uncheck(); await vendor.uncheck();
    await page.getByRole('button', { name: 'Save rollout' }).click();
    await page.waitForFunction(() => document.body.textContent.includes('KYC requirements saved'));
    assert.equal(policy.customer_enabled, false); assert.equal(policy.vendor_enabled, false);
    await context.close();
    console.log('Admin KYC rollout browser checks passed.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
