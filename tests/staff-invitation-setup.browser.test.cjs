"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist", "wallet-admin");
const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

function startServer() {
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const relative = pathname.replace(/^\/wallet-admin\/?/, "");
    const requested = path.resolve(dist, relative || "index.html");
    const safe = requested.startsWith(path.resolve(dist)) && fs.existsSync(requested) && fs.statSync(requested).isFile();
    const file = safe ? requested : path.join(dist, "index.html");
    const type = file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html";
    response.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    fs.createReadStream(file).pipe(response);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

(async () => {
  assert.ok(fs.existsSync(path.join(dist, "index.html")), "Build wallet-admin before running this browser test.");
  const server = await startServer();
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(edge) ? { executablePath: edge } : {}) });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const context = await browser.newContext();
    await context.addInitScript(() => {
      localStorage.setItem("beverly.staff.access_token", "existing-session");
      localStorage.setItem("beverly.staff.user", JSON.stringify({ id: "existing-admin", email: "admin@acoblighting.com", role: "super-admin", password_reset_required: false }));
    });
    await context.route("**/api/v1/admin/me", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: { id: "existing-admin", email: "admin@acoblighting.com", role: "super-admin", password_reset_required: false }, permissions: [] }),
    }));
    const page = await context.newPage();
    await page.goto(`${base}/wallet-admin/setup-account#access_token=invitation-test-token`);
    await page.getByRole("heading", { name: "Set up your account" }).waitFor({ timeout: 10000 });
    assert.equal(new URL(page.url()).pathname, "/wallet-admin/setup-account");
    assert.equal(new URL(page.url()).hash, "", "The recovery token must be cleared from browser history.");
    await context.close();

    const inviteContext = await browser.newContext();
    let usedInvitationToken = false;
    await inviteContext.route("**/api/v1/admin/account-setup", (route) => {
      usedInvitationToken = route.request().headers().authorization === "Bearer invitation-test-token";
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    const invitePage = await inviteContext.newPage();
    await invitePage.goto(`${base}/wallet-admin/setup-account#access_token=invitation-test-token`);
    await invitePage.getByLabel("Password", { exact: true }).fill("AcoB!2026SecurePass1");
    await invitePage.getByLabel("Confirm password").fill("AcoB!2026SecurePass1");
    await invitePage.getByRole("button", { name: "Set password" }).click();
    await invitePage.getByRole("heading", { name: "Your password is set" }).waitFor();
    assert.equal(usedInvitationToken, true, "Password setup must authorize with the invitation token.");
    await inviteContext.close();

    const adminContext = await browser.newContext();
    await adminContext.addInitScript(() => {
      localStorage.setItem("beverly.staff.access_token", "admin-test-token");
      localStorage.setItem("beverly.staff.user", JSON.stringify({ id: "admin-1", email: "admin@acoblighting.com", role: "super-admin", password_reset_required: false }));
    });
    let staff = { auth_user_id: "staff-1", user_id: "staff-1", user_name: "Ada Okonkwo", email: "ada@acoblighting.com", role_key: "account", station_id: "TUNGA", station_ids: ["TUNGA"], last_sign_in_at: null, confirmed_at: "2026-10-01T00:00:00Z" };
    let createdStaffPayload = null;
    const savedEdits = [];
    let deletedWithConfirmation = false;
    await adminContext.route("**/api/v1/admin/**", async (route) => {
      const url = new URL(route.request().url());
      const pathname = url.pathname;
      const method = route.request().method();
      const json = (body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      if (pathname.endsWith("/me")) return json({ user: { id: "admin-1", email: "admin@acoblighting.com", role: "super-admin", password_reset_required: false }, permissions: ["wallet.access.manage"] });
      if (pathname.endsWith("/access/staff-status")) return json({ staff: [staff] });
      if (pathname.endsWith("/access")) return json({ catalog: [], roles: [{ role_key: "super-admin", role_name: "Super Admin" }, { role_key: "account", role_name: "Account" }, { role_key: "finance-checker", role_name: "Finance Checker" }], permissions: [], staff: [staff] });
      if (pathname.endsWith("/stations")) return json({ stations: [{ stationId: "TUNGA", name: "Tunga", oemId: null, oemName: null, status: "active" }, { stationId: "GARKI", name: "Garki", oemId: null, oemName: null, status: "active" }], count: 2 });
      if (pathname.endsWith("/access/users") && method === "POST") {
        createdStaffPayload = route.request().postDataJSON();
        return json({ ok: true, invitationDelivery: { status: "sent" } });
      }
      if (pathname.endsWith("/access/users/staff-1") && method === "PATCH") {
        const edit = route.request().postDataJSON();
        savedEdits.push(edit);
        staff = { ...staff, role_key: edit.roleKey, station_id: edit.allStations ? null : edit.stationIds[0], station_ids: edit.allStations ? ["*"] : edit.stationIds };
        return json({ ok: true });
      }
      if (pathname.endsWith("/access/users/staff-1") && method === "DELETE") {
        deletedWithConfirmation = route.request().postDataJSON()?.confirmation === "DELETE";
        return json({ ok: true });
      }
      return json({});
    });
    const adminPage = await adminContext.newPage();
    await adminPage.goto(`${base}/wallet-admin/roles`);
    await adminPage.getByRole("button", { name: /^Staff\s+1$/ }).click();
    await adminPage.getByRole("button", { name: "Add staff" }).click();
    await adminPage.getByPlaceholder("Ada Okonkwo").fill("Bola Yusuf");
    await adminPage.getByPlaceholder("ada@acoblighting.com").fill("bola@acoblighting.com");
    await adminPage.locator(".ac-invite .msel-all").getByRole("checkbox").check();
    await adminPage.getByRole("button", { name: "Send Invite" }).click();
    assert.deepEqual(createdStaffPayload, { email: "bola@acoblighting.com", fullName: "Bola Yusuf", roleKey: "account", stationIds: [], allStations: true });
    await adminPage.locator(".ac-staff-summary").filter({ hasText: "Ada Okonkwo" }).click();
    await adminPage.locator(".ac-staff-card select").selectOption("finance-checker");
    await adminPage.locator(".ac-staff-card .msel-row").filter({ hasText: "GARKI" }).getByRole("checkbox").check();
    await adminPage.locator(".ac-staff-card").getByRole("button", { name: "Save Changes" }).click();
    assert.deepEqual(savedEdits[0], { roleKey: "finance-checker", stationIds: ["TUNGA", "GARKI"], allStations: false });
    await adminPage.getByRole("group", { name: "Staff view" }).getByRole("button", { name: "Table" }).click();
    await adminPage.locator(".ac-table-detail-row .msel-all").getByRole("checkbox").check();
    await adminPage.locator(".ac-table-detail-row").getByRole("button", { name: "Save Changes" }).click();
    assert.deepEqual(savedEdits[1], { roleKey: "finance-checker", stationIds: [], allStations: true });
    await adminPage.locator(".ac-table-detail-row").getByRole("button", { name: "Delete permanently" }).click();
    await adminPage.locator(".ac-dialog").getByRole("button", { name: "Delete permanently" }).click();
    assert.equal(deletedWithConfirmation, true, "Permanent deletion must send explicit confirmation.");
    await adminContext.close();
    console.log("Staff invitation, saved staff edits, and confirmed deletion work in the admin UI.");
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
