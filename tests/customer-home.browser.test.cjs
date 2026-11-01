"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

function startServer() {
  const dist = path.join(root, "dist", "wallet-customer");
  assert.ok(fs.existsSync(path.join(dist, "index.html")), "build wallet-customer first");
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent((request.url || "/").split("?")[0]);
    const relative = pathname.replace(/^\/wallet-customer\/?/, "");
    const requested = path.resolve(dist, relative || "index.html");
    const file = requested.startsWith(path.resolve(dist)) && fs.existsSync(requested) && fs.statSync(requested).isFile()
      ? requested : path.join(dist, "index.html");
    response.writeHead(200, { "content-type": file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html", "cache-control": "no-store" });
    fs.createReadStream(file).pipe(response);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

function reply(route, body) {
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}

function customer() {
  return { id: "customer-1", full_name: "Ada Customer", email: "ada@example.test", kyc_tier: 0, kyc_status: "unverified", status: "active", email_verified_at: "2026-09-30T10:00:00.000Z" };
}

(async () => {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(edge) ? { executablePath: edge } : {}) });
  try {
    const url = `http://127.0.0.1:${server.address().port}/wallet-customer/`;
    const noneContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await noneContext.addInitScript((profile) => {
      localStorage.setItem("beverly.customer.access_token", "test-token");
      localStorage.setItem("beverly.customer.profile", JSON.stringify(profile));
    }, customer());
    await noneContext.route("**/api/v1/customer/**", (route) => {
      const pathName = new URL(route.request().url()).pathname;
      if (pathName.endsWith("/me")) return reply(route, customer());
      if (pathName.endsWith("/wallet")) return reply(route, { balance_minor: 0, available_minor: 0, holds_minor: 0 });
      if (pathName.includes("/wallet/ledger")) return reply(route, { entries: [] });
      if (pathName.endsWith("/meters")) return reply(route, { meters: [] });
      if (pathName.endsWith("/meters/balances")) return reply(route, { balances: [] });
      if (pathName.includes("/transactions")) return reply(route, { purchases: [] });
      return reply(route, {});
    });
    const nonePage = await noneContext.newPage();
    await nonePage.goto(url, { waitUntil: "domcontentloaded" });
    await nonePage.getByText("No meter connected").waitFor({ timeout: 5_000 });
    await nonePage.getByRole("link", { name: "Add meter" }).waitFor({ timeout: 5_000 });
    await nonePage.getByRole('link', { name: 'View all activity' }).click();
    await nonePage.locator('.bw-t-cards').getByText('No wallet entries yet.').waitFor();
    await nonePage.locator('button[aria-controls="customer-wallet-filter-panel"]').click();
    await nonePage.locator('#customer-wallet-filter-panel').waitFor();
    await nonePage.screenshot({ path: path.join(process.env.TEMP || '.', 'beverly-customer-wallet-check.png') });
    await noneContext.close();

    const meterContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await meterContext.addInitScript((profile) => {
      localStorage.setItem("beverly.customer.access_token", "test-token");
      localStorage.setItem("beverly.customer.profile", JSON.stringify(profile));
    }, customer());
    await meterContext.route("**/api/v1/customer/**", (route) => {
      const pathName = new URL(route.request().url()).pathname;
      if (pathName.endsWith("/me")) return reply(route, customer());
      if (pathName.endsWith("/wallet")) return reply(route, { balance_minor: 0, available_minor: 0, holds_minor: 0 });
      if (pathName.includes("/wallet/ledger")) return reply(route, { entries: [{ id: 'entry-1', entry_type: 'wallet_credit', direction: 'credit', amount_minor: 100000, balance_after_minor: 100000, created_at: '2026-10-30T10:00:00Z' }] });
      if (pathName.endsWith("/meters")) return reply(route, { meters: [{ id: "meter-link", meter_id: "MTR-1", nickname: "Home", status: "approved" }] });
      if (pathName.endsWith("/meters/balances")) return reply(route, { balances: [{ meterId: "MTR-1", status: "available", balanceKwh: 12.5, readingDate: "2026-09-29", reportedAt: "2026-09-29T10:00:00.000Z" }] });
      if (pathName.includes("/transactions")) return reply(route, { purchases: [{ id: "purchase-1" }] });
      return reply(route, {});
    });
    const meterPage = await meterContext.newPage();
    await meterPage.goto(url, { waitUntil: "domcontentloaded" });
    await meterPage.getByText("Meter balance").waitFor({ timeout: 5_000 });
    await meterPage.getByText("12.5 kWh").waitFor({ timeout: 5_000 });
    await meterPage.getByText("Reported").waitFor({ timeout: 5_000 });
    await meterPage.locator('.bw-t-cards').getByText('wallet credit').waitFor();
    await meterPage.screenshot({ path: path.join(process.env.TEMP || '.', 'beverly-customer-home-check.png') });
    await meterPage.getByText("You're all set!").waitFor({ timeout: 5_000 });
    assert.equal(await meterPage.getByText("Raise your account limit").count(), 0, "optional KYC must not block onboarding completion");
    await meterPage.reload({ waitUntil: "domcontentloaded" });
    assert.equal(await meterPage.getByText("You're all set!").count(), 0, "completion celebration must show once per customer");
    await meterPage.goto(`${url}meters`, { waitUntil: 'domcontentloaded' });
    await meterPage.getByText('Home', { exact: true }).first().waitFor();
    await meterPage.screenshot({ path: path.join(process.env.TEMP || '.', 'beverly-customer-meters-check.png') });
    await meterPage.getByRole('link', { name: 'Usage', exact: true }).click();
    await meterPage.getByText('Your usage').waitFor();
    await meterContext.close();

    const failureContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await failureContext.addInitScript((profile) => {
      localStorage.setItem('beverly.customer.access_token', 'test-token');
      localStorage.setItem('beverly.customer.profile', JSON.stringify(profile));
    }, customer());
    await failureContext.route('**/api/v1/customer/**', (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.endsWith('/me')) return reply(route, customer());
      if (pathname.endsWith('/wallet')) return reply(route, { balance_minor: 123400, available_minor: 123400, holds_minor: 0 });
      if (pathname.includes('/wallet/ledger')) return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
      if (pathname.endsWith('/meters')) return reply(route, { meters: [] });
      if (pathname.endsWith('/meters/balances')) return reply(route, { balances: [] });
      return reply(route, {});
    });
    const failurePage = await failureContext.newPage();
    await failurePage.goto(url, { waitUntil: 'domcontentloaded' });
    await failurePage.getByRole('alert').filter({ hasText: 'Activity unavailable' }).waitFor();
    assert.equal(await failurePage.getByText('₦1,234.00').first().isVisible(), true, 'ledger failure must not hide the balance');
    await failurePage.goto(`${url}wallet`, { waitUntil: 'domcontentloaded' });
    await failurePage.getByRole('alert').filter({ hasText: 'Ledger unavailable' }).waitFor();
    assert.equal(await failurePage.getByText('₦1,234.00').first().isVisible(), true);
    await failureContext.close();

    const historyContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await historyContext.addInitScript((profile) => {
      localStorage.setItem('beverly.customer.access_token', 'test-token');
      localStorage.setItem('beverly.customer.profile', JSON.stringify(profile));
    }, customer());
    await historyContext.route('**/api/v1/customer/**', (route) => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.pathname.endsWith('/me')) return reply(route, customer());
      if (requestUrl.pathname.endsWith('/wallet')) return reply(route, { balance_minor: 0, available_minor: 0, holds_minor: 0 });
      if (requestUrl.pathname.includes('/wallet/ledger')) {
        const offset = Number(requestUrl.searchParams.get('offset') || 0);
        const entries = Array.from({ length: offset ? 1 : 100 }, (_, i) => ({ id: `entry-${offset + i}`, entry_type: offset ? 'older_credit' : 'wallet_credit', direction: 'credit', amount_minor: 100, balance_after_minor: 100, created_at: '2026-10-30T10:00:00Z' }));
        return reply(route, { entries });
      }
      return reply(route, {});
    });
    const historyPage = await historyContext.newPage();
    await historyPage.goto(`${url}wallet`, { waitUntil: 'domcontentloaded' });
    await historyPage.getByRole('button', { name: 'Load older entries' }).click();
    await historyPage.getByRole('button', { name: 'Load older entries' }).waitFor({ state: 'hidden' });
    await historyPage.locator('button[aria-controls="customer-wallet-filter-panel"]').click();
    await historyPage.getByPlaceholder('Search memo, type...').fill('older');
    await historyPage.locator('.bw-t-cards').getByText('older credit').waitFor();
    await historyContext.close();

    const usageContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await usageContext.addInitScript((profile) => {
      localStorage.setItem('beverly.customer.access_token', 'test-token');
      localStorage.setItem('beverly.customer.profile', JSON.stringify(profile));
    }, customer());
    await usageContext.route('**/api/v1/customer/**', (route) => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.pathname.endsWith('/me')) return reply(route, customer());
      if (requestUrl.pathname.endsWith('/usage/telemetry')) {
        return reply(route, {
          meter_id: requestUrl.searchParams.get('meter_id') || 'MTR-1', meters: ['MTR-1', 'MTR-2'],
          oem: { id: null, slug: 'test', displayName: 'Test', supportsLive: false, supportedDataItems: ['power'] },
          current: { power: null, credit_balance: null, total_consumption: null, relay_status: 'Unavailable', captured_at: null },
          today_kwh: null, wallet_balance_minor: null, series: [],
        });
      }
      return reply(route, {});
    });
    const usagePage = await usageContext.newPage();
    await usagePage.goto(`${url}usage`, { waitUntil: 'domcontentloaded' });
    const selector = usagePage.getByRole('combobox', { name: 'Select meter' });
    await selector.waitFor();
    await selector.selectOption('MTR-2');
    await usagePage.getByText('No telemetry recorded for MTR-2', { exact: false }).waitFor();
    await usagePage.screenshot({ path: path.join(process.env.TEMP || '.', 'beverly-customer-usage-check.png') });
    assert.equal(await usagePage.locator('input[placeholder="Enter meter number"]').count(), 0);
    assert.equal(await usagePage.getByLabel('Power', { exact: true }).getByText('Unavailable').count(), 1);
    await usageContext.close();

    const supportContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await supportContext.addInitScript((profile) => {
      localStorage.setItem('beverly.customer.access_token', 'test-token');
      localStorage.setItem('beverly.customer.profile', JSON.stringify(profile));
    }, customer());
    let ticketPayload;
    await supportContext.route('**/api/v1/**', async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.endsWith('/customer/me')) return reply(route, customer());
      if (pathname.endsWith('/customer/support/meters')) return reply(route, { meters: [{ meter_id: 'MTR-1', station_id: 'TUNGA' }, { meter_id: 'MTR-2', station_id: 'TUNGA' }] });
      if (pathname.endsWith('/customer/support/tickets') && route.request().method() === 'POST') {
        ticketPayload = route.request().postDataJSON();
        return reply(route, { id: 'ticket', reference: 'TKT-1' });
      }
      if (pathname.endsWith('/customer/support/tickets')) return reply(route, { tickets: [] });
      if (pathname.endsWith('/faqs/categories')) return reply(route, { categories: [] });
      if (pathname.endsWith('/faqs')) return reply(route, { faqs: [] });
      return reply(route, {});
    });
    const supportPage = await supportContext.newPage();
    await supportPage.goto(`${url}help`, { waitUntil: 'domcontentloaded' });
    await supportPage.getByRole('button', { name: 'New ticket', exact: true }).click();
    await supportPage.getByLabel('No meter involved').check();
    await supportPage.screenshot({ path: path.join(process.env.TEMP || '.', 'beverly-customer-support-check.png') });
    await supportPage.locator('input[placeholder="e.g. Token not received"]').fill('Token problem');
    await supportPage.locator('textarea[placeholder="Tell us what happened…"]').fill('Please review this issue.');
    await supportPage.getByRole('button', { name: 'Submit ticket' }).click();
    await supportPage.waitForFunction(() => !document.querySelector('.bw-modal-backdrop'));
    assert.deepEqual(ticketPayload.meter_context, []);
    await supportPage.getByRole('button', { name: 'Open support chat' }).click();
    await supportPage.getByLabel('No meter involved').check();
    assert.equal(await supportPage.getByRole('dialog', { name: 'Support chat' }).count(), 1);
    await supportContext.close();
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
  console.log(JSON.stringify({ status: "Customer home browser verification passed" }));
})().catch((error) => { console.error(error); process.exitCode = 1; });
