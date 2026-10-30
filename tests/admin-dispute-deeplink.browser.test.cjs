"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("playwright");

async function main() {
  const { preview } = await import("vite");
  const root = path.resolve(__dirname, "..");
  const server = await preview({ root: path.join(root, "apps/admin"), base: "/wallet-admin/", configFile: path.join(root, "apps/admin/vite.config.ts"), preview: { host: "127.0.0.1", port: 0 } });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const disputeId = "11111111-1111-4111-8111-111111111111";
  const dispute = { id: disputeId, reference: "DISP-2026-00006", subject: "Meter issue", description: "Case details", status: "open", created_at: "2026-10-29T00:00:00Z", dispute_messages: [] };
  try {
    const context = await browser.newContext({ serviceWorkers: "block" });
    await context.addInitScript(() => {
      localStorage.setItem("beverly.staff.access_token", "synthetic-token");
      localStorage.setItem("beverly.staff.user", JSON.stringify({ id: "staff", role: "super-admin", full_name: "Test Operator" }));
      localStorage.setItem("beverly.staff.permissions", JSON.stringify(["wallet.disputes.manage"]));
    });
    await context.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());
      let body = {};
      if (url.pathname.endsWith("/admin/me")) body = { user: { id: "staff", role: "super-admin", full_name: "Test Operator" }, permissions: ["wallet.disputes.manage"] };
      else if (url.pathname.endsWith("/admin/notifications")) body = { notifications: [{ id: "notification-1", type: "dispute_created", title: "New dispute opened", body: "DISP-2026-00006: Meter issue", read: true, created_at: "2026-10-29T00:00:00Z", metadata: { path: "/disputes", disputeId } }], nextCursor: null, unreadCount: 0 };
      else if (url.pathname.endsWith(`/admin/disputes/${disputeId}`)) body = dispute;
      else if (url.pathname.endsWith("/admin/disputes")) body = { disputes: [] };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/wallet-admin/notifications`);
    await page.getByRole("button", { name: /New dispute opened/ }).click();
    await page.getByRole("button", { name: "Open update" }).click();
    await page.getByRole("dialog").getByText("DISP-2026-00006").waitFor({ timeout: 5000 });
    assert.match(page.url(), new RegExp(`dispute=${disputeId}`));
    assert.equal(await page.getByRole("dialog").getByText("Case details").count(), 1);
    console.log("PASS legacy notification opens its dispute");
  } finally { await browser.close(); await new Promise((resolve) => server.httpServer.close(resolve)); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
