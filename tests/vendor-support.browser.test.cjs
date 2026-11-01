'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..', 'dist', 'wallet-vendor');
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const user = { id: 'vendor-user', vendor_organization_id: 'org', role: 'vendor', full_name: 'Test vendor', organization_name: 'Test shop', mfa_enrolled: true, mfa_verified: true, password_reset_required: false, vend_credential_configured: true };
function reply(route, data) { return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) }); }

(async () => {
  assert.ok(fs.existsSync(path.join(root, 'index.html')), 'Build vendor first.');
  const server = http.createServer((req, res) => {
    const relative = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/wallet-vendor\/?/, '');
    const target = path.resolve(root, relative || 'index.html');
    const file = target.startsWith(root) && fs.existsSync(target) && fs.statSync(target).isFile() ? target : path.join(root, 'index.html');
    res.writeHead(200, { 'content-type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(edge) ? { executablePath: edge } : {}) });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(profile => {
      localStorage.setItem('beverly.vendor.access_token', 'test-token');
      localStorage.setItem('beverly.vendor.user', JSON.stringify(profile));
    }, user);
    let payload;
    await context.route('**/api/v1/**', route => {
      const p = new URL(route.request().url()).pathname;
      if (p.endsWith('/vendor/me')) return reply(route, user);
      if (p.endsWith('/vendor/support/meters')) return reply(route, { meters: [{ meter_id: 'SOLD-1', station_id: 'TUNGA' }, { meter_id: 'ASSIGNED-1', station_id: 'TUNGA' }] });
      if (p.endsWith('/vendor/support/tickets') && route.request().method() === 'POST') { payload = route.request().postDataJSON(); return reply(route, { id: 'ticket', reference: 'TKT-1' }); }
      if (p.endsWith('/vendor/support/tickets')) return reply(route, { tickets: [] });
      if (p.endsWith('/faqs/categories')) return reply(route, { categories: [] });
      if (p.endsWith('/faqs')) return reply(route, { faqs: [] });
      return reply(route, {});
    });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/wallet-vendor/help`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'New ticket', exact: true }).click();
    await page.getByLabel('SOLD-1 · TUNGA').check();
    await page.getByLabel('ASSIGNED-1 · TUNGA').check();
    await page.screenshot({ path: path.join(process.env.TEMP || '.', 'beverly-vendor-support-check.png') });
    await page.locator('#support-subject').fill('Meter problem');
    await page.locator('#support-description').fill('Please investigate this issue.');
    await page.getByRole('button', { name: 'Send support request' }).click();
    await page.waitForFunction(() => !document.querySelector('.support-modal-backdrop'));
    assert.deepEqual(payload.meter_context, [{ meter_id: 'SOLD-1', station_id: 'TUNGA' }, { meter_id: 'ASSIGNED-1', station_id: 'TUNGA' }]);
    await page.getByRole('button', { name: 'Open support chat' }).click();
    await page.getByLabel('No meter involved').check();
    await context.close();
    console.log('Vendor support browser checks passed.');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
