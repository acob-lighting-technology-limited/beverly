'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..', 'dist', 'wallet-vendor');
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const user = { id: 'test-user', vendor_organization_id: 'test-org', role: 'vendor', full_name: 'Test vendor', organization_name: 'Test shop', mfa_enrolled: true, mfa_verified: true, password_reset_required: false, vend_credential_configured: true, kyc_tier: 0, kyc_status: 'unverified' };
const policy = { vendor_enabled: false, vendor: { tier2: { identity: ['national_id'], selfie: false, address: [] } } };
const meter = { meterId: '123456789', customerName: 'Test customer', stationId: 'TUNGA', tariffId: 'T1', liveVerified: true, isThreePhase: false };
const preview = { amountMinor: 100000, energyAmountMinor: 93023, taxAmountMinor: 6977, vatRateBasisPoints: 750, units: 2.6, effectivePricePerKwh: 350 };

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
    for (const scenario of [{ enabled: false, required: false }, { enabled: true, required: false }, { enabled: true, required: true }]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await context.addInitScript(profile => {
        localStorage.setItem('beverly.vendor.access_token', 'test-token');
        localStorage.setItem('beverly.vendor.user', JSON.stringify(profile));
      }, user);
      await context.route('**/api/v1/**', route => {
        const endpoint = new URL(route.request().url()).pathname;
        let data = {};
        if (endpoint.endsWith('/vendor/me')) data = user;
        if (endpoint.endsWith('/vendor/kyc/policy')) data = { policy: { ...policy, vendor_enabled: scenario.enabled }, required: scenario.required };
        if (endpoint.endsWith('/vendor/kyc/status')) data = { kyc_tier: 0, kyc_status: 'unverified', review: null, documents: [], policy: {} };
        if (endpoint.endsWith('/vendor/vend/preview')) data = { meter, preview };
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
      });
      const page = await context.newPage();
      const base = `http://127.0.0.1:${server.address().port}/wallet-vendor`;
      await page.goto(`${base}/vend`, { waitUntil: 'domcontentloaded' });
      if (scenario.required) {
        await page.getByText('Complete verification before vending.').waitFor();
        assert.match(page.url(), /\/kyc\?/);
      } else {
        await page.locator('#vend-meter-id').fill('123456789');
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
        await page.getByRole('button', { name: 'Preview', exact: true }).click();
        const confirm = page.locator('.vend-preview-card button.primary');
        await confirm.waitFor();
        assert.equal(await confirm.isEnabled(), true, 'Tier 0 can proceed when verification is not required.');
        assert.equal(await page.getByText('Tier 1 verification required').count(), 0);
      }
      if (!scenario.enabled) {
        await page.goto(`${base}/kyc`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { name: 'Verification is off' }).waitFor();
        assert.equal(await page.locator('input[type=file]').count(), 0);
        assert.equal(await page.getByRole('link', { name: 'Continue to vending' }).count(), 1);
      }
      await context.close();
    }
    console.log('Vendor KYC browser checks passed.');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
