"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const dist = path.resolve(__dirname, "../dist/wallet-admin");
const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

(async () => {
  assert.ok(fs.existsSync(path.join(dist, "index.html")), "build wallet-admin first");
  const server = http.createServer((req, res) => {
    const relative = decodeURIComponent((req.url || "/").split("?")[0]).replace(/^\/wallet-admin\/?/, "");
    const requested = path.resolve(dist, relative || "index.html");
    const file = requested.startsWith(dist) && fs.existsSync(requested) && fs.statSync(requested).isFile() ? requested : path.join(dist, "index.html");
    const type = file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(edge) ? { executablePath: edge } : {}) });
  const context = await browser.newContext({ viewport: { width: 495, height: 587 } });
  await context.addInitScript(() => {
    localStorage.setItem("beverly.staff.access_token", "browser-test-token");
    localStorage.setItem("beverly.staff.user", JSON.stringify({ id: "staff-1", email: "admin@example.test", full_name: "Admin", role: "super-admin" }));
    localStorage.setItem("beverly.staff.permissions", JSON.stringify(["wallet.announcements.manage"]));
  });
  const seen = [];
  await context.route("**/api/v1/admin/**", (route) => {
    const url = new URL(route.request().url());
    seen.push(`${route.request().method()} ${url.pathname}${url.search}`);
    const json = (body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname.endsWith("/me")) return json({ user: { id: "staff-1", full_name: "Admin", role: "super-admin" }, permissions: ["wallet.announcements.manage"] });
    if (url.pathname.endsWith("/announcements/stations")) return json({ stations: [{ stationId: "MILE9", stationName: "Mile 9 & 10" }, { stationId: "TUNGA", stationName: "Tunga" }] });
    if (url.pathname.endsWith("/announcements/recipients")) return json({ recipients: [{ key: "customer:00000000-0000-4000-8000-000000000001", id: "00000000-0000-4000-8000-000000000001", type: "customer", name: "Ada", email: "ada@example.test", station_ids: ["MILE9"] }], summary: { customers: 1, vendors: 0, staff: 0, total: 1 }, email_summary: { customers: 1, vendors: 0, staff: 0, total: 1 }, notification_summary: { customers: 1, vendors: 0, staff: 0, total: 1 } });
    if (url.pathname.endsWith("/announcements/preview")) return json({ html: "<html><body><h1>Service update</h1><p>Hi Ada,</p></body></html>" });
    if (url.pathname.endsWith("/announcements")) return json({ announcements: [] });
    if (url.pathname.endsWith("/push/config")) return json({ available: false, publicKey: null });
    if (url.pathname.endsWith("/notifications")) {
      const status = url.searchParams.get("status");
      const cursor = url.searchParams.get("cursor");
      const count = status === "unread" ? 1 : cursor ? 1 : 20;
      return json({ notifications: Array.from({ length: count }, (_, index) => ({ id: `${cursor ? "next" : "first"}-${index}`, type: "funding_approval", title: `Alert ${cursor ? 21 : index + 1}`, body: "Review funding", read: status !== "unread", created_at: "2026-11-09T12:00:00Z" })), nextCursor: status === "unread" || cursor ? null : "2026-11-09T12:00:00Z|00000000-0000-4000-8000-000000000001", unreadCount: 1, totalCount: status === "unread" ? 1 : 21 });
    }
    return json({});
  });
  const page = await context.newPage();
  try {
    await page.goto(`${base}/wallet-admin/announcements`);
    await page.getByRole("heading", { name: "New announcement" }).waitFor();
    await page.getByRole("button", { name: /All permitted stations/ }).click();
    await page.getByRole("checkbox", { name: "Mile 9 & 10" }).check();
    await page.getByRole("button", { name: /1 stations selected/ }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByPlaceholder("Service update").fill("Service update");
    await page.getByPlaceholder("Write the message recipients receive...").fill("Important update");
    await page.getByRole("button", { name: "Bold" }).click();
    assert.match(await page.getByPlaceholder("Write the message recipients receive...").inputValue(), /\*\*Text\*\*/);
    await page.locator('input[type="file"]').setInputFiles({ name: "notice.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nTest") });
    await page.getByText("Remove notice.pdf").waitFor();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.locator('iframe[title="Recipient email preview"]').waitFor();
    assert.ok(seen.some((entry) => entry.includes("/announcements/preview")));
    await page.goto(`${base}/wallet-admin/notifications`);
    await page.getByText("Page 1 · 21 notifications").waitFor();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByText("Page 2 · 21 notifications").waitFor();
    await page.getByRole("button", { name: "unread", exact: true }).click();
    await page.getByText("Page 1 · 1 unread notifications").waitFor();
    assert.ok(seen.some((entry) => entry.includes("status=unread")));
  } finally {
    await context.close();
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
  console.log("Announcement composer and notification pages verified on mobile.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
