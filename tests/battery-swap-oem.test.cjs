"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifestContent = fs.readFileSync(path.join(root, "src/data/route-manifest.js"), "utf8");
const appContent = fs.readFileSync(path.join(root, "src/App.vue"), "utf8");
const shellChromeContent = fs.readFileSync(path.join(root, "src/data/shell-chrome.mjs"), "utf8");
const oemCapContent = fs.readFileSync(path.join(root, "src/components/oem-hub/oem-capabilities.mjs"), "utf8");
const serviceContent = fs.readFileSync(path.join(root, "src/services/yunhe-battery-service.js"), "utf8");
const storeContent = fs.readFileSync(path.join(root, "src/stores/battery-fleet-store.js"), "utf8");
const mapContent = fs.readFileSync(path.join(root, "src/components/battery-swap/BatteryGprsMap.vue"), "utf8");
const tokenContent = fs.readFileSync(path.join(root, "src/styles/acob-battery-swap-tokens.css"), "utf8");

// 1. Route manifest registration for standalone battery swap pages
assert.ok(manifestContent.includes('#/battery-swap/map'), "Route hash #/battery-swap/map missing in route-manifest.js");
assert.ok(manifestContent.includes('#/battery-swap/fleet'), "Route hash #/battery-swap/fleet missing in route-manifest.js");
assert.ok(manifestContent.includes('#/battery-swap/crm'), "Route hash #/battery-swap/crm missing in route-manifest.js");
assert.ok(manifestContent.includes('#/battery-swap/stations'), "Route hash #/battery-swap/stations missing in route-manifest.js");
assert.ok(manifestContent.includes('#/battery-swap/diagnostics'), "Route hash #/battery-swap/diagnostics missing in route-manifest.js");
assert.ok(manifestContent.includes('group: "Battery Swap"'), "Battery Swap group missing in route-manifest.js");
assert.ok(manifestContent.includes('["#/battery-swap/", "battery_swap_operations"]'), "Capability mapping missing in routeCapabilityByHashPrefix");

// 2. App.vue standalone component registrations & detached sidebar
assert.ok(appContent.includes('BsvMapPage'), "App.vue missing BsvMapPage");
assert.ok(appContent.includes('BsvFleetPage'), "App.vue missing BsvFleetPage");
assert.ok(appContent.includes('BsvCrmPage'), "App.vue missing BsvCrmPage");
assert.ok(appContent.includes('BsvStationsPage'), "App.vue missing BsvStationsPage");
assert.ok(appContent.includes('BsvDiagnosticsPage'), "App.vue missing BsvDiagnosticsPage");
assert.ok(appContent.includes('battery-swap-app-host'), "App.vue missing battery-swap-app-host class");
assert.ok(appContent.includes('sidebar--battery-swap'), "App.vue missing sidebar--battery-swap class");

// 3. Shell chrome & OEM capabilities
assert.ok(shellChromeContent.includes('"Battery Swap"'), "shell-chrome.mjs missing group icon or section label");
assert.ok(oemCapContent.includes('"battery_swap_operations"'), "oem-capabilities.mjs missing battery_swap_operations key");

// 4. Yunhe battery client: server-side credentials, no fabricated data (AGENTS.md section 4)
const portalServiceContent = fs.readFileSync(path.join(root, "apps/battery-swap/src/services/yunhe-battery-service.js"), "utf8");
const portalStoreContent = fs.readFileSync(path.join(root, "apps/battery-swap/src/stores/battery-fleet-store.js"), "utf8");
for (const [label, content] of [["CRM root service", serviceContent], ["portal service", portalServiceContent]]) {
  for (const name of ["fetchYunheBatteries", "fetchYunheStations", "setBatteryFets", "rebootBatteryDTU", "YunheUnavailableError"]) {
    assert.ok(content.includes(name), label + " missing " + name);
  }
  assert.ok(content.includes('"/api/v1/pue/yunhe"'), label + " must call the Beverly gateway");
  assert.ok(!/yunheznkj.com/.test(content), label + " must not contact Yunhe directly");
  assert.ok(!/login_name|DEFAULT_AUTH|loginToYunhe/.test(content), label + " must not hold or send vendor credentials");
  assert.ok(!/getSyntheticGatewayResponse|operational fallback|fallback session/i.test(content), label + " must not fabricate data or sessions");
}
const normalizeEol = (text) => text.split(String.fromCharCode(13)).join("");
assert.strictEqual(normalizeEol(serviceContent), normalizeEol(portalServiceContent), "CRM root and portal Yunhe services must stay identical");
// The portal store no longer holds demo data or browser persistence. (The CRM root copy still does and is due to be retired.)
assert.ok(!/seedFleetData|localStorage.setItem/.test(portalStoreContent), "portal fleet store must not seed demo data or persist fleet records in the browser");
assert.ok(fs.existsSync(path.join(root, "apps/battery-swap/src/stores/pue-registry-store.js")), "portal must read riders, bikes, batteries and stations from the registry store");

// No Yunhe credentials or vendor hosts anywhere in browser source.
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/.(vue|js|mjs|ts)$/.test(entry.name)) out.push(full);
  }
  return out;
}
for (const file of [...walk(path.join(root, "apps/battery-swap/src")), ...walk(path.join(root, "src/components/battery-swap")), ...walk(path.join(root, "src/services"))]) {
  const text = fs.readFileSync(file, "utf8");
  assert.ok(!/MIYAJI/.test(text), file + " contains a Yunhe login name");
  assert.ok(!/yunheznkj.com/.test(text), file + " contacts the vendor directly");
}

// Hardware commands: confirmed by the platform before any state change, and never swallowed.
assert.ok(!/catch (_) {}/.test(portalStoreContent), "fleet store must not swallow command errors");
assert.ok(!/Remote FET command warning|Remote DTU reboot warning/.test(portalStoreContent), "fleet store must not downgrade command failures to warnings");
assert.ok(portalStoreContent.includes("liveStatus"), "fleet store must track whether live data is available");
assert.ok(!/lastSyncTime: new Date/.test(portalStoreContent), "lastSyncTime must stay null until a real sync");

// 5. Battery Fleet Store State & Actions
assert.ok(storeContent.includes('useBatteryFleetStore'), "useBatteryFleetStore missing");
assert.ok(storeContent.includes('syncLiveYunheTelemetry'), "syncLiveYunheTelemetry action missing");
assert.ok(storeContent.includes('executeSwap'), "executeSwap action missing");
assert.ok(storeContent.includes('toggleBikeMotorPower'), "toggleBikeMotorPower action missing");
assert.ok(storeContent.includes('recordPayment'), "recordPayment action missing");

// 6. Interactive Leaflet GPS Map Component
assert.ok(mapContent.includes('leaflet-host'), "Leaflet host div missing in map component");
assert.ok(mapContent.includes('initMap'), "initMap method missing");
assert.ok(mapContent.includes('renderMarkers'), "renderMarkers method missing");
assert.ok(mapContent.includes('fitBikes'), "fitBikes method missing");

// 7. Scoped ACOB Design Tokens
assert.ok(tokenContent.includes('--acob-brand:        #008000;'), "ACOB brand token missing");
assert.ok(tokenContent.includes('--acob-brand-mint:   #7dfc9a;'), "ACOB mint token missing");
assert.ok(tokenContent.includes('--acob-bg:           #f4f8f5;'), "Light theme ground #f4f8f5 missing");
assert.ok(tokenContent.includes('--acob-bg:           #03090a;'), "Dark theme ground #03090a missing");

// 8. Standalone Battery Swap Portal (apps/battery-swap)
const portalPkg = JSON.parse(fs.readFileSync(path.join(root, "apps/battery-swap/package.json"), "utf8"));
assert.strictEqual(portalPkg.name, "@beverly/battery-swap-app", "Portal package name mismatch");
assert.ok(fs.existsSync(path.join(root, "apps/battery-swap/src/App.vue")), "apps/battery-swap/src/App.vue missing");
assert.ok(fs.existsSync(path.join(root, "apps/battery-swap/src/router/index.ts")), "apps/battery-swap/src/router/index.ts missing");

const vercelConfig = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
assert.ok(vercelConfig.redirects.some(r => r.source === "/battery-swap"), "vercel.json missing /battery-swap redirect");
assert.ok(vercelConfig.rewrites.some(r => r.source === "/battery-swap/:path*"), "vercel.json missing /battery-swap rewrite");

assert.ok(appContent.includes('batterySwapUrl'), "App.vue missing batterySwapUrl computed property");
assert.ok(appContent.includes('resolvePostLoginRedirect'), "App.vue missing resolvePostLoginRedirect");

const landingPortalsContent = fs.readFileSync(path.join(root, "apps/wallet-landing/src/portals.ts"), "utf8");
assert.ok(landingPortalsContent.includes("batterySwap: 'http://localhost:5177/'"), "landing portals.ts missing dev portal");
assert.ok(landingPortalsContent.includes("batterySwap: '/battery-swap/'"), "landing portals.ts missing prod portal");

console.log("All Battery Swap standalone operations, detached sidebar & ACOB design tokens checks passed! (100% GREEN)");
