"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("playwright");

async function main() {
  const { preview } = await import("vite");
  const root = path.resolve(__dirname, "..");
  const server = await preview({ root: path.join(root, "apps/admin"), base: "/wallet-admin/", configFile: path.join(root, "apps/admin/vite.config.ts"), preview: { host: "127.0.0.1", port: 0 } });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const customerId = "22222222-2222-4222-8222-222222222222";
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    await context.addInitScript(() => {
      localStorage.setItem("beverly.staff.access_token", "synthetic-token");
      localStorage.setItem("beverly.staff.user", JSON.stringify({ id: "staff", role: "super-admin", full_name: "Test Operator" }));
      localStorage.setItem("beverly.staff.permissions", JSON.stringify(["wallet.customers.view", "wallet.vending.monitor"]));
    });
    await context.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());
      let body = {};
      if (url.pathname.endsWith("/admin/me")) body = { user: { id: "staff", role: "super-admin" }, permissions: ["wallet.customers.view", "wallet.vending.monitor"] };
      else if (url.pathname.endsWith(`/customers/${customerId}/meters`)) body = { meters: [
        { id: "a", meter_id: "METER-A", station_id: "SITE-A", status: "approved", nickname: "Main" },
        { id: "b", meter_id: "METER-B", station_id: "SITE-B", status: "approved" },
        { id: "c", meter_id: "METER-C", station_id: "SITE-A", status: "pending" },
      ] };
      else if (url.pathname.endsWith(`/customers/${customerId}/purchases`)) {
        body = { purchases: url.searchParams.get("scope") === "linked" ? [
          { id: "p-a", meter_id: "METER-A", station_id: "SITE-A", status: "delivered", amount_minor: 100000, created_at: "2026-10-29T10:00:00Z" },
          { id: "p-b", meter_id: "METER-B", station_id: "SITE-B", status: "delivered", amount_minor: 200000, created_at: "2026-10-28T10:00:00Z" },
        ] : [{ id: "p-old", meter_id: "METER-OLD", station_id: "SITE-A", status: "delivered", amount_minor: 150000, created_at: "2026-10-27T10:00:00Z" }], nextCursor: null };
      } else if (url.pathname.endsWith(`/customers/${customerId}`)) body = { customer: { id: customerId, full_name: "Test Customer", status: "active", kyc_tier: 0, kyc_status: "unverified", station_ids: ["SITE-A", "SITE-B"], created_at: "2026-10-01T00:00:00Z" }, wallet: null, balance_minor: 0, available_minor: 0, stats: { meterCount: 2, purchaseCount: 0, purchaseValueMinor: 0, fundingCount: 0, fundingValueMinor: 0 } };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/wallet-admin/customers/${customerId}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.getByRole('button', { name: /linked meters/i }).click();
    await page.getByText('METER-A', { exact: true }).waitFor();
    await page.getByText('METER-B', { exact: true }).waitFor();
    await page.getByRole('button', { name: /^purchases$/i }).click();
    await page.getByLabel('Select meter').selectOption('METER-B');
    await page.getByRole('table').getByText('METER-B', { exact: true }).waitFor();
    assert.equal(await page.getByRole('table').getByText('METER-A', { exact: true }).count(), 0);
    assert.match(await page.locator('main').innerText(), /2,000\.00/);
    assert.equal(await page.getByLabel('Select meter').locator('option[value="METER-C"]').count(), 0);
    assert((await page.evaluate(() => document.documentElement.scrollWidth)) <= 392);
    await page.getByLabel('Purchase scope').selectOption('account');
    await page.getByRole('table').getByText('METER-OLD', { exact: true }).waitFor();
    assert.equal(await page.getByRole('table').getByText('METER-B', { exact: true }).count(), 0);
    console.log('PASS linked meters and meter purchase analytics');
  } finally { await browser.close(); await new Promise((resolve) => server.httpServer.close(resolve)); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
