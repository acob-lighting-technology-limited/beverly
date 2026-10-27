"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");

function staticFile(url) {
  const pathname = decodeURIComponent(String(url || "/").split("?")[0]);
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const candidate = path.resolve(dist, relative);
  return candidate.startsWith(dist) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()
    ? candidate
    : path.join(dist, "index.html");
}

function contentType(file) {
  if (file.endsWith(".js")) return "text/javascript";
  if (file.endsWith(".css")) return "text/css";
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".svg")) return "image/svg+xml";
  if (file.endsWith(".json")) return "application/json";
  return "text/html";
}

async function runBrowserAudit() {
  console.log("=== Starting Beverly CRM SparkMeter Live End-to-End & UI Audit ===");

  assert(fs.existsSync(path.join(dist, "index.html")), "Build must exist before browser audit");

  const server = http.createServer((request, response) => {
    const file = staticFile(request.url);
    response.writeHead(200, { "Content-Type": contentType(file) });
    response.end(fs.readFileSync(file));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    serviceWorkers: "block",
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Ignore favicon or non-critical 404s
      if (!text.includes("favicon") && !text.includes("sw.js")) {
        consoleErrors.push(text);
      }
    }
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  // Mock API routes
  await page.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ status: 200, body: "" }));
  await page.route("https://fonts.gstatic.com/**", (r) => r.fulfill({ status: 204, body: "" }));

  const sparkMeterOem = {
    id: "e1532892-e09d-44f9-a9cb-b99b5c9ebecf",
    slug: "sparkmeter",
    name: "SparkMeter",
    displayName: "SparkMeter",
    status: "active",
    isSeedDefault: false,
    vendingStrategy: "direct_credit",
    communityCount: 8,
    meterCount: 3074,
    capabilities: {
      smart_grid_telemetry: true,
      remote_relay_control: true,
      grid_energy_audit: true,
      mesh_network_health: true,
      direct_credit_balance: true,
    },
  };

  const calinmeterOem = {
    id: "calinmeter",
    slug: "calinmeter",
    name: "Calinmeter",
    displayName: "Calinmeter",
    status: "active",
    isSeedDefault: true,
    vendingStrategy: "sts_token",
    communityCount: 5,
    capabilities: {
      sts_token_generation: true,
      gprs_remote_push: true,
    },
  };

  let activeOem = sparkMeterOem;

  await page.route("**/api/**", async (route) => {
    const url = route.request().url().toLowerCase();
    const method = route.request().method();

    if (url.includes("/user/login")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          code: 0,
          data: { token: "station-alert-test", userId: "admin", userName: "ACB(admin)", roleId: "super-admin" },
          result: { token: "station-alert-test", userId: "admin", userName: "ACB(admin)", roleId: "super-admin" }
        })
      });
    }

    if (url.includes("/auth/me")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          code: 0,
          data: { userId: "admin", userName: "ACB(admin)", roleId: "super-admin" },
          result: { userId: "admin", userName: "ACB(admin)", roleId: "super-admin" }
        })
      });
    }

    if (url.includes("/user/read")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          code: 0,
          data: { data: [{ userId: "admin", name: "ACB(admin)", roleId: "super-admin" }], total: 1 },
          result: { data: [{ userId: "admin", name: "ACB(admin)", roleId: "super-admin" }], total: 1 }
        })
      });
    }

    if (url.includes("/system/oem/list")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          code: 0,
          oems: [calinmeterOem, sparkMeterOem],
          data: { oems: [calinmeterOem, sparkMeterOem] },
          result: { oems: [calinmeterOem, sparkMeterOem] }
        }),
      });
    }

    if (url.includes("/notifications/gateway-health/diagnose")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          code: 0,
          result: {
            gatewayId: "GW-SUL-BS01",
            status: "NOVA Uplink Online",
            signalDbm: -72,
            packetLossPercent: 0.6,
            pingLatencyMs: 38,
            backhaul: "MTN Business 4G",
            checkedAt: new Date().toISOString(),
          },
        }),
      });
    }

    if (url.includes("/notifications/gateway-health")) {
      const isSpark = activeOem.slug === "sparkmeter";
      const alerts = isSpark
        ? [
            {
              id: "nova-alert-gw-sul-bs01",
              gateway: "GW-SUL-BS01",
              gatewayName: "Sule Market Base Station (NOVA Base Station)",
              station: "Sule",
              kind: "degraded",
              status: "false",
              successRate: 94.6,
              rssiDbm: -92,
              packetLossPercent: 5.4,
              startedAt: new Date(Date.now() - 14400000).toISOString(),
              lastReportedAt: new Date(Date.now() - 240000).toISOString(),
              source: "sparkmeter-nova",
              system: "NOVA",
            },
            {
              id: "nova-orphan-smrsd-04-000823f5",
              gateway: "SMRSD-04-000823F5",
              gatewayName: "Mesh Node Outage: Kazeem Adekunle (SMRSD-04-000823F5)",
              station: "Sule",
              kind: "down",
              status: "false",
              successRate: 0,
              rssiDbm: -102,
              packetLossPercent: 100,
              startedAt: new Date(Date.now() - 17640000).toISOString(),
              lastReportedAt: new Date(Date.now() - 17640000).toISOString(),
              source: "sparkmeter-nova-mesh",
              system: "NOVA",
              failureReason: "Deep Orphan / Potential Power Line Cut",
              recommendedAction: "Inspect Line Breaker / Feeder Spur 2",
            },
            {
              id: "nova-core-sync-health",
              gateway: "NOVA-CLOUD-CORE",
              gatewayName: "SparkMeter NOVA Telemetry Pipeline",
              station: "All Grids (Central Cloud)",
              kind: "recovered",
              status: "true",
              successRate: 99.8,
              rssiDbm: -68,
              packetLossPercent: 0.2,
              startedAt: new Date(Date.now() - 7200000).toISOString(),
              endedAt: new Date(Date.now() - 360000).toISOString(),
              lastReportedAt: new Date().toISOString(),
              source: "sparkmeter-nova-cloud",
              system: "NOVA",
            },
          ]
        : [];

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          code: 0,
          data: { data: alerts, total: alerts.length },
          result: { data: alerts, total: alerts.length },
          meta: {
            checkedAt: new Date().toISOString(),
            gatewayCount: 8,
            eventIds: ["nova-alert-gw-sul-bs01", "nova-orphan-smrsd-04-000823f5"],
            oem: isSpark ? "sparkmeter" : "calinmeter",
            systemName: isSpark ? "SparkMeter NOVA" : "Calinmeter",
          },
        }),
      });
    }

    if (url.includes("/dashboard/readpanelgroup")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          code: 0,
          data: {
            totalAccountCount: 3074,
            totalPurchaseTimes: 18420,
            totalPurchaseUnit: 142580.4,
            totalPurchaseMoney: 52750000.00,
            activeGridSites: 8,
            vendingStrategy: "direct_credit"
          },
          result: {
            totalAccountCount: 3074,
            totalPurchaseTimes: 18420,
            totalPurchaseUnit: 142580.4,
            totalPurchaseMoney: 52750000.00,
            activeGridSites: 8,
            vendingStrategy: "direct_credit"
          }
        })
      });
    }

    if (url.includes("/dashboard/readlinechart")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          code: 0,
          data: {
            xData: ["May 2026", "Jun 2026", "Jul 2026", "Aug 2026", "Sep 2026", "Oct 2026"],
            yData: [4600000, 6900000, 8180000, 9920000, 11300000, 11850000],
            labels: ["May 2026", "Jun 2026", "Jul 2026", "Aug 2026", "Sep 2026", "Oct 2026"],
            values: [4600000, 6900000, 8180000, 9920000, 11300000, 11850000],
            title: "Equivalent in Naira (₦) · All Time Since Inception"
          },
          result: {
            xData: ["May 2026", "Jun 2026", "Jul 2026", "Aug 2026", "Sep 2026", "Oct 2026"],
            yData: [4600000, 6900000, 8180000, 9920000, 11300000, 11850000],
            labels: ["May 2026", "Jun 2026", "Jul 2026", "Aug 2026", "Sep 2026", "Oct 2026"],
            values: [4600000, 6900000, 8180000, 9920000, 11300000, 11850000],
            title: "Equivalent in Naira (₦) · All Time Since Inception"
          }
        })
      });
    }

    if (url.includes("/oem/telemetry/power-quality")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          code: 0,
          summary: {
            meanVoltageV: 228.2,
            gridFrequencyHz: 49.98,
            averagePowerFactor: 0.92,
            totalActivePowerKw: 418.5,
            totalConnectedMeters: 3074,
            unbalancedPhaseCount: 0,
            underVoltageCount: 2,
            overVoltageCount: 0,
          },
          stations: [
            { siteCode: "OTU-COSTAIN", siteName: "OTU-COSTAIN", activePowerKw: 88.4, phaseAVolts: 228.5, phaseBVolts: 227.1, phaseCVolts: 229.0, frequencyHz: 49.99, powerFactor: 0.94, status: "stable" },
            { siteCode: "ADEBAYO", siteName: "Adebayo", activePowerKw: 46.2, phaseAVolts: 224.2, phaseBVolts: 225.0, phaseCVolts: 223.8, frequencyHz: 50.01, powerFactor: 0.91, status: "stable" }
          ],
          timeline24h: {
            labels: ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00"],
            voltagePhaseA: [228, 227, 229, 226, 228, 229],
            frequencyHz: [50.0, 49.98, 50.02, 49.99, 50.01, 50.0],
          },
        }),
      });
    }

    if (url.includes("/oem/telemetry/load-curves")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          code: 0,
          intervals: [
            { time: "00:00", demandKw: 120.4, peakKw: 135.0, baseloadKw: 95.0 },
            { time: "06:00", demandKw: 210.8, peakKw: 240.0, baseloadKw: 110.0 },
            { time: "12:00", demandKw: 340.5, peakKw: 380.0, baseloadKw: 125.0 },
            { time: "18:00", demandKw: 418.5, peakKw: 450.0, baseloadKw: 130.0 },
          ],
          peakDemandKw: 418.5,
          baseloadDemandKw: 95.0,
        }),
      });
    }

    if (url.includes("/oem/grid-control/list")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          code: 0,
          meters: [
            { serialNumber: "SMRSD-04-00080001", customerName: "Adeleke Farms", siteCode: "OTU-COSTAIN", relayState: "connected", currentLoadWatts: 1420, powerLimitWatts: 3000, lastUpdated: new Date().toISOString() },
            { serialNumber: "SMRSD-04-00080002", customerName: "Oluwole Bakery", siteCode: "ADEBAYO", relayState: "connected", currentLoadWatts: 2850, powerLimitWatts: 5000, lastUpdated: new Date().toISOString() },
          ],
          totalMeters: 3074,
          connectedCount: 3042,
          disconnectedCount: 32,
        }),
      });
    }

    if (url.includes("/oem/analytics/energy-audit")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          code: 0,
          summary: {
            totalSites: 8,
            totalTotalizerKwh: 145200,
            totalBilledKwh: 138650,
            totalLossKwh: 6550,
            systemLossPercent: 4.5,
            theftIncidentCount: 1,
          },
          sites: [
            { siteCode: "OTU-COSTAIN", siteName: "Otu-Costain", totalizerKwh: 32400, customerBilledKwh: 31200, lossKwh: 1200, lossPercent: 3.7, classification: "normal" },
            { siteCode: "SULE", siteName: "Sule", totalizerKwh: 18500, customerBilledKwh: 16200, lossKwh: 2300, lossPercent: 12.4, classification: "critical_investigate" }
          ],
        }),
      });
    }

    if (url.includes("/oem/mesh/gateway-status")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          code: 0,
          summary: {
            totalGateways: 8,
            onlineGateways: 8,
            offlineGateways: 0,
            avgLatencyMs: 44,
            avgPacketDeliveryRate: 98.6,
            avgRssiDbm: -76,
            overallSignalQuality: "Excellent",
            totalMeshNodes: 3074,
            totalOrphanedMeters: 10,
          },
          gateways: [
            { gatewayId: "GW-OTC-BS01", siteCode: "OTU-COSTAIN", gatewayName: "Costain Central Base Station", status: "online", pingLatencyMs: 42, packetDeliverySuccessRate: 99.4, avgRssiDbm: -74, connectedNodes: 320, orphanedCount: 1 },
            { gatewayId: "GW-SUL-BS01", siteCode: "SULE", gatewayName: "Sule Market Base Station", status: "online", pingLatencyMs: 86, packetDeliverySuccessRate: 94.6, avgRssiDbm: -92, connectedNodes: 142, orphanedCount: 3 }
          ],
          orphanedMeters: [
            { meterSerial: "SMRSD-04-0008440F", siteCode: "OTU-COSTAIN", customerName: "Alhaji Musa Garba", inactiveMinutes: 170, lastRssiDbm: -98, severity: "warning" },
          ],
        }),
      });
    }

    // Default mock response
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ code: 0, data: [], result: { data: [], total: 0 } }),
    });
  });

  try {
    // Step 1: Login
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.fill('[data-testid="login-user-id"]', "admin");
    await page.fill('[data-testid="login-password"]', "admin");
    await page.click('[data-testid="login-submit"]');

    await page.waitForSelector(".bw-header-brand");
    console.log("✓ Authenticated and arrived at OEM Hub");

    // Select SparkMeter OEM card
    const sparkCard = page.locator(".oem-card").filter({ hasText: "SparkMeter" });
    await sparkCard.first().locator(".oem-card__surface").click();
    activeOem = sparkMeterOem;

    await page.waitForSelector(".navbar");
    console.log("✓ Arrived at SparkMeter CRM workspace");

    // AUDIT 1: Verify Navbar has NO .oem-workspace-pill button and is single-row
    const pillCount = await page.locator(".oem-workspace-pill").count();
    assert.equal(pillCount, 0, "Navbar must NOT contain .oem-workspace-pill button");
    console.log("✓ Verified .oem-workspace-pill button is completely removed from navbar");

    // Verify navbar layout alignment: Search, Bell, User Chip must share vertical center
    const searchBox = await page.locator(".toolbar-search").boundingBox();
    const bellBox = await page.locator(".station-bell").boundingBox();
    const userBox = await page.locator(".bw-user-chip-btn").boundingBox();

    assert(searchBox && bellBox && userBox, "Navbar controls must all be present");
    const yDelta1 = Math.abs(searchBox.y - bellBox.y);
    const yDelta2 = Math.abs(bellBox.y - userBox.y);
    assert(yDelta1 < 12, `Search and Bell should be horizontally aligned (delta=${yDelta1}px)`);
    assert(yDelta2 < 12, `Bell and User menu should be horizontally aligned (delta=${yDelta2}px)`);
    console.log("✓ Navbar layout audit passed: Single row without secondary wrapping (Y-alignment perfect)");

    // AUDIT 1.5: Verify Dashboard Stat Cards for SparkMeter
    await page.waitForSelector(".dashboard-card-grid");
    const dashboardCardsText = await page.locator(".dashboard-card-grid").innerText();
    console.log("DASHBOARD CARDS TEXT:\n", dashboardCardsText);
    const lower = dashboardCardsText.toLowerCase();
    assert(lower.includes("total billed energy"), "Dashboard must contain 'Total Billed Energy'");
    assert(lower.includes("equivalent in naira"), "Dashboard must contain 'Equivalent in Naira'");
    assert(lower.includes("since inception"), "Dashboard must display 'Since Inception' period badge");
    assert(lower.includes("kwh"), "Dashboard must display 'kWh' unit for billed energy");
    assert(dashboardCardsText.includes("₦"), "Dashboard must display '₦' symbol for equivalent in Naira");
    assert(!lower.includes("vending strategy"), "Dashboard must NOT contain 'Vending Strategy' card");
    assert(!lower.includes("mesh telemetry"), "Dashboard must NOT contain 'Mesh Telemetry' card");
    console.log("✓ SparkMeter Dashboard stat cards verified: 'Total Billed Energy (kWh)' and 'Equivalent in Naira (₦)' with 'Since Inception' period badge present");

    // AUDIT 2: Verify Sidebar has SparkMeter Smart Grid sections and NO STS routes
    const sidebarText = await page.locator(".sidebar-container").innerText();
    console.log("SIDEBAR TEXT:\n", sidebarText);
    assert(sidebarText.includes("Smart Grid Telemetry"), "Sidebar must include Smart Grid Telemetry");
    assert(sidebarText.includes("Relay & Load Limiting"), "Sidebar must include Relay & Load Limiting");
    assert(sidebarText.includes("Energy Balance & Theft"), "Sidebar must include Energy Balance & Theft");
    assert(sidebarText.includes("Gateway & Mesh Health"), "Sidebar must include Gateway & Mesh Health");

    assert(!sidebarText.includes("Token Generate"), "STS Token Generate must NOT be visible for SparkMeter");
    console.log("✓ Sidebar capability gating audit passed: Smart grid sections visible, STS tokens hidden");

    // AUDIT 3: Notification Bell for SparkMeter NOVA Status
    await page.click(".station-bell");
    await page.waitForSelector(".station-alert-popover");

    const popoverTitle = await page.locator(".station-alert-title strong").innerText();
    assert.equal(popoverTitle, "SparkMeter NOVA Status", `Expected 'SparkMeter NOVA Status', got '${popoverTitle}'`);
    console.log("✓ Bell popover header correctly displays 'SparkMeter NOVA Status'");

    // Check Degraded Base Station alert
    await page.getByRole("tab", { name: /Degraded/ }).click();
    await page.locator(".station-alert-popover").getByText("Sule Market Base Station", { exact: false }).waitFor();
    console.log("✓ Degraded NOVA Base Station alert (GW-SUL-BS01) verified");

    // Check Ping NOVA button & diagnostic execution
    const pingBtn = page.getByRole("button", { name: "📡 Ping NOVA" }).first();
    assert.equal(await pingBtn.count(), 1, "Ping NOVA button must be present");
    await pingBtn.click();
    await page.locator(".station-alert-diag-banner").waitFor({ timeout: 5000 });
    const diagText = await page.locator(".station-alert-diag-banner").innerText();
    assert(diagText.includes("NOVA Uplink Online") || diagText.includes("Signal"), "Diagnostic banner must report NOVA Uplink Online");
    console.log("✓ Live '📡 Ping NOVA' diagnostic test passed with status banner:", diagText);

    // Verify footer link points to #/mesh/gateways
    const footerLink = page.locator(".station-alert-popover footer a");
    const footerHref = await footerLink.getAttribute("href");
    assert.equal(footerHref, "#/mesh/gateways", "Footer must link to #/mesh/gateways for SparkMeter");
    const footerText = await footerLink.innerText();
    assert(footerText.includes("NOVA Mesh & Base Station monitor"), "Footer link text must mention NOVA Mesh monitor");
    console.log("✓ Bell popover footer link correctly targets NOVA Mesh monitor");

    // Click footer link to navigate to #/mesh/gateways
    await footerLink.click();
    await page.waitForFunction(() => window.location.hash === "#/mesh/gateways");
    console.log("✓ Successfully navigated to #/mesh/gateways from notification footer");

    // AUDIT 4: Test All 5 SparkMeter Screens Load & Render Cleanly
    const testPages = [
      { hash: "#/telemetry/power-quality", expectText: "Power Quality", name: "Power Quality Hub" },
      { hash: "#/telemetry/demand-curves", expectText: "Demand", name: "Demand Curves Hub" },
      { hash: "#/grid-control/remote-relay", expectText: "3,074", name: "Remote Relay & Load Limiting" },
      { hash: "#/analytics/energy-audit", expectText: "Energy Audit", name: "Site Energy Audit & Anti-Theft" },
      { hash: "#/mesh/gateways", expectText: "Base Station", name: "Gateway & RF Mesh Health" },
    ];

    for (const p of testPages) {
      await page.evaluate((targetHash) => { window.location.hash = targetHash; }, p.hash);
      await page.waitForTimeout(600);
      const content = await page.locator(".content-page").innerText();
      console.log(`PAGE CONTENT FOR ${p.hash} (len=${content.length}):\n`, content.slice(0, 150));
      if (content.length === 0) {
        console.log("ERRORS:", consoleErrors);
        console.log("HTML SNIPPET:", (await page.locator(".content-page").innerHTML()).slice(0, 300));
        console.log("CURRENT HASH IN PAGE:", await page.evaluate(() => window.location.hash));
      }
      assert(content.includes(p.expectText) || content.includes(p.name), `Page ${p.hash} failed to render expected text`);
      console.log(`✓ Screen ${p.name} (${p.hash}) rendered cleanly`);
    }

    // AUDIT 5: Responsiveness across Tablet and Mobile viewports
    const viewports = [
      { name: "Tablet Portrait", width: 768, height: 1024 },
      { name: "Mobile iPhone 14", width: 390, height: 844 },
      { name: "Small Android", width: 360, height: 740 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(400);

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      if (scrollWidth > vp.width + 2) {
        const overflowing = await page.evaluate((width) => {
          const els = Array.from(document.querySelectorAll("*"));
          return els
            .filter((el) => {
              const rect = el.getBoundingClientRect();
              return rect.right > width + 2 || el.offsetWidth > width + 2;
            })
            .map((el) => ({
              tag: el.tagName,
              cls: typeof el.className === "string" ? el.className.slice(0, 60) : "",
              id: el.id,
              right: Math.round(el.getBoundingClientRect().right),
              offsetWidth: el.offsetWidth,
            }))
            .slice(0, 10);
        }, vp.width);
        console.error(`Overflow details for ${vp.name}:`, JSON.stringify(overflowing, null, 2));
      }
      assert(scrollWidth <= vp.width + 2, `Viewport ${vp.name} (${vp.width}px) has horizontal overflow: scrollWidth=${scrollWidth}px`);

      // Test mobile bell popover bounds
      await page.click(".station-bell");
      await page.waitForSelector(".station-alert-popover");
      const popoverBox = await page.locator(".station-alert-popover").boundingBox();
      assert(popoverBox, `Popover must be visible on ${vp.name}`);
      assert(popoverBox.x >= 0, `Popover must not bleed off left edge on ${vp.name}`);
      assert(popoverBox.x + popoverBox.width <= vp.width + 10, `Popover must fit inside screen on ${vp.name}`);

      // Close scrim
      await page.click(".station-alert-scrim");
      await page.waitForTimeout(200);

      console.log(`✓ Responsiveness audit passed on ${vp.name} (${vp.width}x${vp.height}) - Zero overflow`);
    }

    assert.equal(consoleErrors.length, 0, `Unexpected browser console errors:\n${consoleErrors.join("\n")}`);

    console.log("\n==========================================================================");
    console.log("🎉 LIVE SPARKMETER CRM BROWSER AUDIT PASSED WITH 100% SUCCESS! 🎉");
    console.log("==========================================================================\n");
  } finally {
    await browser.close();
    server.close();
  }
}

runBrowserAudit().catch((err) => {
  console.error("Browser audit failed:", err);
  process.exit(1);
});
