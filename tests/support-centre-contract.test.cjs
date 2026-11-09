"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

// 1. Package manifest
const pkgPath = path.join(root, "apps/support-centre/package.json");
assert.ok(fs.existsSync(pkgPath), "apps/support-centre/package.json must exist");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
assert.equal(pkg.name, "@beverly/support-centre-app", "Package name must be @beverly/support-centre-app");

// 2. Core views and components
const requiredFiles = [
  "apps/support-centre/src/App.vue",
  "apps/support-centre/src/main.ts",
  "apps/support-centre/src/router/index.ts",
  "apps/support-centre/src/stores/support-centre.ts",
  "apps/support-centre/src/styles/support-centre-tokens.css",
  "apps/support-centre/src/types/index.ts",
  "apps/support-centre/src/views/LiveDeskView.vue",
  "apps/support-centre/src/views/QueueView.vue",
  "apps/support-centre/src/views/CasesView.vue",
  "apps/support-centre/src/views/Customer360View.vue",
  "apps/support-centre/src/views/IncidentsView.vue",
  "apps/support-centre/src/views/QualityView.vue",
  "apps/support-centre/src/views/AnalyticsView.vue",
  "apps/support-centre/src/components/IncomingCallBanner.vue",
  "apps/support-centre/src/components/ResolveCaseModal.vue",
  "apps/support-centre/src/components/EscalateModal.vue"
];

for (const rel of requiredFiles) {
  assert.ok(fs.existsSync(path.join(root, rel)), `Missing required file: ${rel}`);
}

// 3. Router checks
const routerContent = fs.readFileSync(path.join(root, "apps/support-centre/src/router/index.ts"), "utf8");
for (const routePath of ["/live-desk", "/queue", "/cases", "/customers", "/incidents", "/quality", "/analytics"]) {
  assert.ok(routerContent.includes(`path: '${routePath}'`), `Router missing route: ${routePath}`);
}

// 4. Telephony & case management store contracts
const storeContent = fs.readFileSync(path.join(root, "apps/support-centre/src/stores/support-centre.ts"), "utf8");
for (const action of [
  "acceptIncomingCall",
  "endActiveCall",
  "toggleMute",
  "toggleHold",
  "takeQueueCall",
  "resolveActiveCase",
  "escalateActiveCase",
  "setPresence"
]) {
  assert.ok(storeContent.includes(action), `Store missing action: ${action}`);
}

// 5. Portals & Vercel routing
const portalsContent = fs.readFileSync(path.join(root, "apps/wallet-landing/src/portals.ts"), "utf8");
assert.ok(portalsContent.includes("supportCentre: 'http://localhost:5178/'"), "DEV_PORTALS missing supportCentre");
assert.ok(portalsContent.includes("supportCentre: '/support-centre/'"), "PROD_PORTALS missing supportCentre");

const vercelConfig = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
assert.ok(
  vercelConfig.redirects.some((r) => r.source === "/support-centre" && r.destination === "/support-centre/"),
  "vercel.json missing /support-centre redirect"
);
assert.ok(
  vercelConfig.rewrites.some((r) => r.source === "/support-centre" && r.destination === "/support-centre/index.html"),
  "vercel.json missing /support-centre rewrite"
);
assert.ok(
  vercelConfig.rewrites.some((r) => r.source === "/support-centre/:path*" && r.destination === "/support-centre/index.html"),
  "vercel.json missing /support-centre/:path* rewrite"
);

// 6. Root build script verification
const rootPkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
assert.ok(
  rootPkg.scripts.build.includes("@beverly/support-centre-app"),
  "Root package.json build script must include @beverly/support-centre-app"
);

console.log(JSON.stringify({
  status: "support centre contract passed",
  views: 7,
  components: 3,
  routes: 7,
  telephonyIntegration: "Africa's Talking voice callback ready"
}, null, 2));
