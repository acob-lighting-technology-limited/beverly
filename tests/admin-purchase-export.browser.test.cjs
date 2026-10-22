"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist", "wallet-admin");
const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const actors = [
  { value: "vendor:v1", label: "Vendor · Alpha Shop", description: "Alpha Limited v1" },
  { value: "customer:c1", label: "Customer · Ada One", description: "c1" },
  { value: "customer:c2", label: "Customer · Bola Two", description: "c2" },
];
const purchases = [
  { id: "p1", actor_type: "vendor", actor_id: "v1", customer_name: "Buyer", meter_id: "M1", station_id: "TUNGA", meter_type: "single_phase", amount_minor: 10000, energy_amount_minor: 9300, vat_amount_minor: 700, units_kwh: 1, purchase_mode: "wallet", status: "delivered", created_at: "2026-10-19T10:00:00Z" },
  { id: "p2", actor_type: "vendor", actor_id: "v1", customer_name: "Buyer", meter_id: "M2", station_id: "TUNGA", meter_type: "single_phase", amount_minor: 20000, energy_amount_minor: 18600, vat_amount_minor: 1400, units_kwh: 2, purchase_mode: "wallet", status: "delivered", created_at: "2026-10-20T10:00:00Z" },
  { id: "p3", actor_type: "customer", actor_id: "c1", customer_name: "Ada One", meter_id: "M3", station_id: "TUNGA", meter_type: "single_phase", amount_minor: 30000, energy_amount_minor: 27900, vat_amount_minor: 2100, units_kwh: 3, purchase_mode: "wallet", status: "delivered", created_at: "2026-10-20T11:00:00Z" },
];
const meterOrders = [
  { id: "m1", customer_id: "c1", customer_name_snapshot: "Ada One", meter_type: "single_phase", property_address: "North Street", service_area: "Tunga", contact_phone: "08000000000", amount_minor: 5000000, status: "paid", payment_reference: "ORDER-FIRST", technician_name: null, notes: null, created_at: "2026-10-19T10:00:00Z" },
  { id: "m2", customer_id: "c2", customer_name_snapshot: "Bola Two", meter_type: "three_phase", property_address: "South Street", service_area: "Tunga", contact_phone: "08100000000", amount_minor: 7000000, status: "installed", payment_reference: "ORDER-SECOND", technician_name: null, notes: null, created_at: "2026-10-20T10:00:00Z" },
];
const wallets = [
  { id: "w1", owner_type: "vendor", owner_id: "v1", owner_name: "Alpha Shop", status: "active", currency: "NGN", balance_minor: 100000, holds_minor: 0, available_minor: 100000, created_at: "2026-10-19T10:00:00Z" },
  { id: "w2", owner_type: "customer", owner_id: "c1", owner_name: "Ada One", status: "active", currency: "NGN", balance_minor: 200000, holds_minor: 0, available_minor: 200000, created_at: "2026-10-20T10:00:00Z" },
];

function startServer() {
  const server = http.createServer((request, response) => {
    const relative = decodeURIComponent((request.url || "/").split("?")[0]).replace(/^\/wallet-admin\/?/, "");
    const requested = path.resolve(dist, relative || "index.html");
    const safe = requested.startsWith(path.resolve(dist)) && fs.existsSync(requested) && fs.statSync(requested).isFile();
    const file = safe ? requested : path.join(dist, "index.html");
    const type = file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : file.endsWith(".png") ? "image/png" : "text/html";
    response.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    fs.createReadStream(file).pipe(response);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

(async () => {
  assert.ok(fs.existsSync(path.join(dist, "index.html")), "build wallet-admin before browser verification");
  const server = await startServer();
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(fs.existsSync(edge) ? { executablePath: edge } : {}) });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    await context.addInitScript(() => {
      localStorage.setItem("beverly.staff.access_token", "browser-test-token");
      localStorage.setItem("beverly.staff.user", JSON.stringify({ id: "staff-1", email: "staff@example.test", full_name: "Export Tester", role: "developer" }));
      localStorage.setItem("beverly.staff.permissions", JSON.stringify(["wallet.vending.monitor", "wallet.vendors.review", "wallet.funding.view"]));
    });
    const requests = [];
    await context.route("**/api/v1/admin/**", async (route) => {
      const url = new URL(route.request().url());
      const pathname = url.pathname;
      const json = (body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      if (pathname.endsWith("/me")) return json({ user: { id: "staff-1", full_name: "Export Tester", role: "developer" }, permissions: ["wallet.vending.monitor", "wallet.vendors.review", "wallet.funding.view"] });
      if (pathname.endsWith("/stations")) return json({ stations: [{ stationId: "TUNGA", name: "Tunga" }] });
      if (pathname.endsWith("/purchases/actors")) return json({ actors });
      if (pathname.endsWith("/purchases/summary")) return json({ totalCount: 3, successCount: 3, failedCount: 0, refundedCount: 0, totalValueMinor: 60000, failedValueMinor: 0, refundedValueMinor: 0 });
      if (pathname.endsWith("/purchases")) {
        requests.push(url.searchParams.toString());
        const matching = purchases.filter((row) =>
          (!url.searchParams.get("actorType") || row.actor_type === url.searchParams.get("actorType"))
          && (!url.searchParams.get("actorId") || row.actor_id === url.searchParams.get("actorId"))
          && (!url.searchParams.get("status") || row.status === url.searchParams.get("status")));
        return json({ purchases: matching, nextCursor: null });
      }
      if (pathname.endsWith("/meter-orders/stats")) return json({ total: 2 });
      if (pathname.endsWith("/meter-orders")) {
        const secondPage = url.searchParams.has("cursor");
        return json({ orders: [meterOrders[secondPage ? 1 : 0]], nextCursor: secondPage ? null : "cursor2" });
      }
      if (pathname.endsWith("/wallets/summary")) return json({ walletCount: 2, totalFloatMinor: 300000, totalHoldsMinor: 0, vendorFloatMinor: 100000, customerFloatMinor: 200000, byStatus: { active: 2 }, byOwnerType: { vendor: 1, customer: 1 } });
      if (pathname.endsWith("/wallets")) {
        const secondPage = url.searchParams.has("cursor");
        return json({ wallets: [wallets[secondPage ? 1 : 0]], nextCursor: secondPage ? null : "cursor2" });
      }
      return json({});
    });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/wallet-admin/purchases`, { waitUntil: "networkidle" });
    await page.locator(".bw-export-wizard-trigger").click();
    const dialog = page.getByRole("dialog", { name: "Token Purchases export" });
    const accountSelect = dialog.locator(".bw-export-actor-scope select").last();
    await dialog.getByLabel("Account type").selectOption("vendor");
    assert.equal(await accountSelect.locator("option").count(), 2);
    await dialog.getByLabel("Account type").selectOption("customer");
    assert.equal(await accountSelect.locator("option").count(), 3);
    await dialog.getByRole("button", { name: "Continue" }).click();
    assert.equal(await dialog.getByText("Vendor Name").count(), 0, "customer fields must exclude vendor-only columns");
    assert.equal(await dialog.getByText("Vendor Business").count(), 0, "customer fields must exclude vendor-only columns");
    assert.match(await dialog.locator(".bw-export-step-title p").innerText(), /13 fields selected for customers/);
    await dialog.getByRole("button", { name: "Back" }).click();
    await dialog.getByLabel("Account type").selectOption("");
    assert.equal(await accountSelect.locator("option").count(), 4);
    await accountSelect.selectOption("customer:c1");
    await dialog.getByRole("button", { name: "Continue" }).click();
    assert.equal(await dialog.getByText("Vendor Name").count(), 0, "selected customer must exclude vendor-only columns");
    await dialog.getByRole("button", { name: "Back" }).click();
    await dialog.getByLabel("Account type").selectOption("vendor");
    await dialog.getByPlaceholder("Search vendors").fill("Alpha Limited");
    assert.equal(await accountSelect.locator("option").count(), 2);
    await accountSelect.selectOption("vendor:v1");
    await dialog.getByRole("button", { name: "Continue" }).click();
    await dialog.getByRole("button", { name: "Continue" }).click();
    await dialog.getByRole("button", { name: "Continue" }).click();
    await dialog.getByRole("radio", { name: "One CSV per day, zipped" }).check();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      dialog.getByRole("button", { name: "Export CSV" }).click(),
    ]);
    assert.match(download.suggestedFilename(), /beverly-admin-purchases-daily-.*\.zip$/);
    const archive = fs.readFileSync(await download.path());
    assert.match(archive.toString("utf8"), /beverly-admin-purchases-2026-10-19\.csv/);
    assert.match(archive.toString("utf8"), /beverly-admin-purchases-2026-10-20\.csv/);
    assert.ok(!archive.toString("utf8").includes("M3"), "customer purchase must not leak into vendor archive");
    assert.ok(requests.some((query) => query.includes("actorType=vendor") && query.includes("actorId=v1")), "export request must apply selected actor");
    await page.locator(".bw-export-wizard-trigger").click();
    await dialog.getByLabel("Transaction status").selectOption("failed");
    await dialog.getByRole("button", { name: "Continue" }).click();
    await dialog.getByRole("button", { name: "Continue" }).click();
    await dialog.getByRole("button", { name: "Continue" }).click();
    await dialog.getByRole("button", { name: "Export CSV" }).click();
    assert.match(await dialog.getByRole("status").innerText(), /No records match these filters/);
    assert.equal(await dialog.getByRole("heading", { name: "Choose record scope" }).count(), 1, "empty export must return to editable scope");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, "mobile layout must not overflow");
    await page.goto(`http://127.0.0.1:${server.address().port}/wallet-admin/meter-orders`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Export", exact: true }).click();
    const meterDialog = page.getByRole("dialog", { name: "Meter Orders export" });
    await meterDialog.getByRole("button", { name: "Continue" }).click();
    await meterDialog.getByRole("button", { name: "Continue" }).click();
    await meterDialog.getByRole("button", { name: "Continue" }).click();
    const [meterDownload] = await Promise.all([
      page.waitForEvent("download"),
      meterDialog.getByRole("button", { name: "Export CSV" }).click(),
    ]);
    const meterCsv = fs.readFileSync(await meterDownload.path(), "utf8");
    assert.match(meterCsv, /ORDER-FIRST/, "first meter page must export");
    assert.match(meterCsv, /ORDER-SECOND/, "later meter pages must export");
    await page.goto(`http://127.0.0.1:${server.address().port}/wallet-admin/wallets`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Export", exact: true }).click();
    const walletDialog = page.getByRole("dialog", { name: "Wallets export" });
    await walletDialog.getByRole("button", { name: "Continue" }).click();
    await walletDialog.getByRole("button", { name: "Continue" }).click();
    await walletDialog.getByRole("button", { name: "Continue" }).click();
    const [walletDownload] = await Promise.all([
      page.waitForEvent("download"),
      walletDialog.getByRole("button", { name: "Export CSV" }).click(),
    ]);
    const walletCsv = fs.readFileSync(await walletDownload.path(), "utf8");
    assert.match(walletCsv, /w1/, "first wallet page must export");
    assert.match(walletCsv, /w2/, "later wallet pages must export");
    await context.close();
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
  console.log("admin purchase export browser verification passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
