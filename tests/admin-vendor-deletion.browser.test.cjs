"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const dist = path.resolve(__dirname, "../dist/wallet-admin");
const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const vendor = { id: "00000000-0000-4000-8000-000000000001", legal_name: "Test Vendor", trading_name: "Test Shop",
  contact_email: "vendor@example.test", contact_phone: "08000000000", risk_level: "low", status: "approved",
  station_id: "KYAKALE", approved_at: null, created_at: "2026-09-28T14:02:00Z" };

(async () => {
  assert.ok(fs.existsSync(path.join(dist, "index.html")), "build wallet-admin first");
  const server = http.createServer((req, res) => {
    const relative = decodeURIComponent((req.url || "/").split("?")[0]).replace(/^\/wallet-admin\/?/, "");
    const requested = path.resolve(dist, relative || "index.html");
    const file = requested.startsWith(dist) && fs.existsSync(requested) && fs.statSync(requested).isFile() ? requested : path.join(dist, "index.html");
    res.writeHead(200, { "Content-Type": file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html" });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(edge) ? { executablePath: edge } : {}) });
  const context = await browser.newContext({ viewport: { width: 487, height: 571 } });
  await context.addInitScript(() => {
    localStorage.setItem("beverly.staff.access_token", "browser-test-token");
    localStorage.setItem("beverly.staff.user", JSON.stringify({ id: "staff-1", role: "super-admin" }));
    localStorage.setItem("beverly.staff.permissions", JSON.stringify(["wallet.vendors.manage", "wallet.vendors.review"]));
  });
  let eligible = false;
  let deleted = false;
  const requests = [];
  await context.route("**/api/v1/admin/**", (route) => {
    const url = new URL(route.request().url());
    requests.push(`${route.request().method()} ${url.pathname}`);
    const json = (body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname.endsWith("/me")) return json({ user: { id: "staff-1", role: "super-admin" }, permissions: ["wallet.vendors.manage", "wallet.vendors.review"] });
    if (url.pathname.endsWith("/vendors/summary")) return json({ total: deleted ? 0 : 1, byStatus: { approved: deleted ? 0 : 1 } });
    if (url.pathname.endsWith("/vendors/deletion-check")) return json({ canDelete: eligible, blockers: eligible ? [] : ["Settle the vendor wallet balance first."] });
    if (url.pathname.endsWith(`/vendors/${vendor.id}/deletion-check`)) return json({ canDelete: eligible, blockers: eligible ? [] : ["Settle the vendor wallet balance first."] });
    if (url.pathname.endsWith(`/vendors/${vendor.id}`) && route.request().method() === "DELETE") {
      const body = route.request().postDataJSON();
      assert.equal(body.confirmation, vendor.legal_name);
      assert.equal(body.reason, "Duplicate vendor profile");
      deleted = true;
      return json({ ok: true, cleanupPending: 0 });
    }
    if (url.pathname.endsWith("/vendors")) return json({ vendors: deleted ? [] : [vendor] });
    if (url.pathname.endsWith("/stations")) return json({ stations: [] });
    return json({});
  });
  const page = await context.newPage();
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await page.goto(`${base}/wallet-admin/vendors`);
    const card = page.locator(".bw-tc").filter({ hasText: vendor.legal_name });
    await card.getByRole("button", { name: "Vendor actions" }).click();
    await card.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByText("Settle the vendor wallet balance first.").waitFor();
    assert.equal(await page.getByRole("button", { name: "Delete vendor" }).isDisabled(), true);
    assert.equal(requests.some((request) => request.startsWith("DELETE ")), false);
    await page.getByRole("button", { name: "Cancel" }).click();
    eligible = true;
    await card.getByRole("button", { name: "Vendor actions" }).click();
    await card.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByText("Complete these steps first:").waitFor({ state: "hidden" });
    await page.getByPlaceholder("e.g. duplicate vendor record").fill("Duplicate vendor profile");
    await page.getByPlaceholder(vendor.legal_name).fill(vendor.legal_name);
    await page.getByRole("button", { name: "Delete vendor" }).click();
    await page.getByText(`${vendor.legal_name} deleted.`).waitFor();
    assert.equal(deleted, true);
  } finally {
    await context.close(); await browser.close(); await new Promise((resolve) => server.close(resolve));
  }
  console.log("Vendor deletion eligibility and confirmation verified on mobile.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
