"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

/** Verify the built screen against synthetic HTTP boundary responses only. */
async function main() {
  const { preview } = await import("vite");
  const root = path.resolve(__dirname, "..");
  const server = await preview({
    root: path.join(root, "apps/admin"),
    base: '/wallet-admin/',
    configFile: path.join(root, "apps/admin/vite.config.ts"),
    preview: { host: "127.0.0.1", port: 0, strictPort: false },
  });
  const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(edge) ? { executablePath: edge } : {}) });
  try {
    const context = await browser.newContext({ serviceWorkers: "block" });
    await context.addInitScript(() => {
      localStorage.setItem("beverly.staff.access_token", "synthetic-browser-token");
      localStorage.setItem("beverly.staff.user", JSON.stringify({ id: "test-staff", role: "developer", full_name: "Test Operator", password_reset_required: false }));
      localStorage.setItem("beverly.staff.permissions", JSON.stringify(["dev.console"]));
    });
    let catalogUnavailable = true;
    let raceMode = false;
    let telemetryMode = "normal";
    let releaseHeldTelemetry;
    const raceCounts = { meters: 0, telemetry: 0 };
    const heldRaceRequests = [];
    let firstRaceReady;
    const firstRaceRequests = new Promise((resolve) => { firstRaceReady = resolve; });
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname !== "127.0.0.1") return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (url.pathname.endsWith("/admin/me")) return json({ user: { id: "test-staff", role: "developer", full_name: "Test Operator", password_reset_required: false }, permissions: ["dev.console"] });
      if (url.pathname.endsWith("/admin/dev/oem")) return catalogUnavailable
        ? json({ message: "Registry unavailable" }, 503)
        : json({ oems: [{ id: "synthetic-sparkmeter", slug: "sparkmeter", displayName: "SparkMeter", status: "draft", vendingStrategy: "unsupported", capabilities: { inventory_reads_observed: true, vending: false } }] });
      if (url.pathname.endsWith("/oem/installations")) return json({ installations: [
        { id: "11111111-1111-4111-8111-111111111111", tenantId: "tenant-1", displayName: "North Site", status: "active", environment: "sandbox" },
        { id: "22222222-2222-4222-8222-222222222222", tenantId: "tenant-1", displayName: "South Site", status: "active", environment: "sandbox" },
      ] });
      if (raceMode && url.pathname.includes("/oem/installations/11111111-1111-4111-8111-111111111111/") && !url.searchParams.has("after")) {
        const kind = url.pathname.endsWith("/meters") ? "meters" : url.pathname.endsWith("/telemetry") ? "telemetry" : null;
        if (kind) {
          raceCounts[kind]++;
          const requestNumber = raceCounts[kind];
          if (requestNumber === 1) {
            if (raceCounts.meters && raceCounts.telemetry) firstRaceReady();
            await new Promise((resolve) => heldRaceRequests.push(resolve));
          }
          if (kind === "meters") return json({ meters: [{ id: requestNumber === 1 ? "old" : "new", serial: requestNumber === 1 ? "RACE-A-OLD" : "RACE-A-NEW", siteId: "SITE-A", status: "active", lastSeenAt: "2026-10-18T12:00:00.000Z" }], nextCursor: null });
          return json({ readings: [{ id: requestNumber === 1 ? "old" : "new", externalSiteId: "SITE-A", externalMeterId: requestNumber === 1 ? "RACE-A-OLD" : "RACE-A-NEW", readingAt: "2026-10-18T12:00:00.000Z", energyKwh: null, voltageAvg: null, currentAvg: null, meterState: "on" }], nextCursor: null });
        }
      }
      if (url.pathname.endsWith("/oem/installations/22222222-2222-4222-8222-222222222222/meters")) return json({ meters: [{ id: "south", serial: "SOUTH-METER", siteId: "SITE-S", status: "active", lastSeenAt: "2026-10-18T12:00:00.000Z" }], nextCursor: null });
      if (url.pathname.endsWith("/oem/installations/22222222-2222-4222-8222-222222222222/telemetry")) return json({ readings: [{ id: "south", externalSiteId: "SITE-S", externalMeterId: "SOUTH-METER", readingAt: "2026-10-18T12:00:00.000Z", energyKwh: null, voltageAvg: null, currentAvg: null, meterState: "on" }], nextCursor: null });
      if (url.pathname.endsWith("/oem/installations/22222222-2222-4222-8222-222222222222/reconciliation")) return json({ snapshot: null });
      if (url.pathname.endsWith("/oem/installations/11111111-1111-4111-8111-111111111111/meters")) return json(url.searchParams.has("after")
        ? { meters: [{ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", externalId: "meter-2", serial: "SERIAL-2", siteId: "SITE-8", status: "active", lastSeenAt: "2026-10-18T11:00:00.000Z" }], nextCursor: null }
        : { meters: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", externalId: "METER-9", serial: "SERIAL-1", siteId: "SITE-7", status: "active", lastSeenAt: "2026-10-18T10:00:00.000Z" }], nextCursor: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
      if (url.pathname.endsWith("/oem/installations/11111111-1111-4111-8111-111111111111/reconciliation")) return json({ snapshot: null });
      if (url.pathname.endsWith("/oem/installations/11111111-1111-4111-8111-111111111111/telemetry") && telemetryMode === "error") return json({ message: "Synthetic outage" }, 503);
      if (url.pathname.endsWith("/oem/installations/11111111-1111-4111-8111-111111111111/telemetry") && telemetryMode === "empty") return json({ readings: [], nextCursor: null });
      if (url.pathname.endsWith("/oem/installations/11111111-1111-4111-8111-111111111111/telemetry") && telemetryMode === "held") await new Promise((resolve) => { releaseHeldTelemetry = resolve; });
      if (url.pathname.endsWith("/oem/installations/11111111-1111-4111-8111-111111111111/telemetry") && url.searchParams.has("after")) return json({ readings: [{
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", externalSiteId: "SITE-8", externalMeterId: "METER-10",
        readingAt: "2026-10-18T11:00:00.000Z", energyKwh: null, energyInterpretation: "provider_total_unknown_semantics",
        voltageAvg: null, currentAvg: null, meterState: "off",
      }], nextCursor: null });
      if (url.pathname.endsWith("/oem/installations/11111111-1111-4111-8111-111111111111/telemetry")) return json({ readings: [{
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", externalSiteId: "SITE-7", externalMeterId: "METER-9",
        readingAt: "2026-10-18T10:00:00.000Z", energyKwh: 24.5, energyInterpretation: "provider_total_unknown_semantics",
        voltageAvg: 229.1, currentAvg: 1.2, powerFactorAvg: null, providerCreditBalance: 700,
        meterState: "on", readingType: "customer", receivedAt: "2026-10-18T10:02:00.000Z",
      }], nextCursor: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
      return json({});
    });
    const page = await context.newPage();
    const address = server.httpServer.address();
    await page.goto(`http://127.0.0.1:${address.port}/wallet-admin/dev/oem`, { waitUntil: "networkidle" });
    await page.getByText("OEM catalog is unavailable.", { exact: true }).waitFor({ timeout: 5000 });
    assert.equal(await page.getByRole("heading", { name: "SparkMeter", exact: true }).count(), 0, "failed API must not fabricate provider capabilities");
    catalogUnavailable = false;
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "SparkMeter", exact: true }).waitFor();
    await page.getByText("Not available", { exact: true }).waitFor({ timeout: 5000 });
    assert.equal(await page.getByRole("button", { name: /Add OEM Brand|Save Connection|Test API Connection/ }).count(), 0, "unsupported configuration must not offer simulated writes");
    assert.doesNotMatch(await page.locator('main').count() ? await page.locator('main').innerText() : await page.locator('body').innerText(), /STS Token|Direct Credit|Grounded OEM Context Active/);
    await page.getByRole("button", { name: /North Site/ }).click();
    await page.getByRole("table", { name: "Telemetry readings" }).getByText("METER-9").waitFor();
    const telemetryText = await page.getByRole("table", { name: "Telemetry readings" }).innerText();
    assert.match(telemetryText, /SITE-7/);
    assert.match(telemetryText, /SERIAL-1/);
    assert.match(telemetryText, /24\.5/);
    assert.match(telemetryText, /unclassified/i);
    assert.match(telemetryText, /229\.1/);
    assert.match(telemetryText, /1\.2/);
    assert.match(telemetryText, /on/);
    assert.doesNotMatch(telemetryText, /₦|bill|consumption/i);
    await page.getByRole("button", { name: "Load more meters" }).click();
    await page.getByRole("table", { name: /Meter inventory/ }).getByText("SERIAL-2").waitFor();
    await page.getByRole("button", { name: "Load more readings" }).click();
    await page.getByRole("table", { name: "Telemetry readings" }).getByText("METER-10").waitFor();
    assert.equal(await page.getByRole("button", { name: /Load more (meters|readings)/ }).count(), 0);
    raceMode = true;
    await page.getByRole("button", { name: /North Site/ }).click();
    await firstRaceRequests;
    await page.getByRole("button", { name: /South Site/ }).click();
    await page.getByRole("table", { name: "Telemetry readings" }).getByText("SOUTH-METER").waitFor();
    await page.getByRole("button", { name: /North Site/ }).click();
    await page.getByRole("table", { name: "Telemetry readings" }).getByText("RACE-A-NEW").waitFor();
    await page.getByRole("table", { name: "Meter inventory" }).getByText("RACE-A-NEW").waitFor();
    for (const release of heldRaceRequests) release();
    await page.waitForTimeout(200);
    assert.equal(await page.getByText("RACE-A-OLD").count(), 0, "stale first selection must not replace the newest selection");
    raceMode = false;
    telemetryMode = "error";
    await page.getByRole("button", { name: /North Site/ }).click();
    await page.getByText("Scoped telemetry is unavailable.", { exact: true }).waitFor();
    telemetryMode = "empty";
    await page.getByRole("button", { name: /North Site/ }).click();
    await page.getByText("No telemetry readings in this installation.", { exact: true }).waitFor();
    telemetryMode = "held";
    await page.getByRole("button", { name: /North Site/ }).click();
    await page.getByText("Loading scoped telemetry…", { exact: true }).waitFor();
    while (!releaseHeldTelemetry) await new Promise((resolve) => setTimeout(resolve, 10));
    releaseHeldTelemetry();
    await page.getByRole("table", { name: "Telemetry readings" }).getByText("METER-9", { exact: false }).waitFor();
    await context.close();
    console.log("OEM catalog, inventory, telemetry, paging, and selection browser test passed");
  } finally {
    await browser.close();
    await new Promise((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()));
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
