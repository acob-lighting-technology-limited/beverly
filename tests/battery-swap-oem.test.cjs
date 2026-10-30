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

// 4. Yunhe Battery Service Contracts
assert.ok(serviceContent.includes('export const YUNHE_GPS_BASE_URL = "https://hk-battery-services.yunheznkj.com"'), "Base GPS URL missing");
assert.ok(serviceContent.includes('export const YUNHE_SWAP_BASE_URL = "https://zhjt.yunheznkj.com"'), "Base Swap URL missing");
assert.ok(serviceContent.includes('loginToYunhe'), "loginToYunhe function missing");
assert.ok(serviceContent.includes('callBusinessGateway'), "callBusinessGateway function missing");
assert.ok(serviceContent.includes('callCommandGateway'), "callCommandGateway function missing");

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

console.log("All Battery Swap standalone operations, detached sidebar & ACOB design tokens checks passed! (100% GREEN)");
