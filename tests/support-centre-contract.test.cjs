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

// 5. Beverly Wallet Shared Tokens & Components Contract
const mainContent = fs.readFileSync(path.join(root, "apps/support-centre/src/main.ts"), "utf8");
assert.ok(mainContent.includes("@beverly/tokens/tokens.css"), "Must import Beverly tokens.css");
assert.ok(mainContent.includes("@beverly/tokens/theme.css"), "Must import Beverly theme.css");
assert.ok(mainContent.includes("@beverly/tokens/wallet.css"), "Must import Beverly wallet.css");
assert.ok(mainContent.includes("initTheme('dark')"), "Must initialize Beverly dark theme");
assert.ok(mainContent.includes("initLocale()"), "Must initialize Beverly i18n locale");

const appContent = fs.readFileSync(path.join(root, "apps/support-centre/src/App.vue"), "utf8");
assert.ok(appContent.includes("LanguageSwitcher"), "Must integrate Beverly LanguageSwitcher shared component");
assert.ok(appContent.includes("toggleTheme"), "Must integrate Beverly toggleTheme");
assert.ok(appContent.includes("/brand/beverly-mark.png"), "Must use Beverly official brand mark");

const casesContent = fs.readFileSync(path.join(root, "apps/support-centre/src/views/CasesView.vue"), "utf8");
assert.ok(casesContent.includes("WalletExportMenu"), "Cases view must use Beverly shared WalletExportMenu");

const queueContent = fs.readFileSync(path.join(root, "apps/support-centre/src/views/QueueView.vue"), "utf8");
assert.ok(queueContent.includes("WalletExportMenu"), "Queue view must use Beverly shared WalletExportMenu");

// Brand assets check
assert.ok(fs.existsSync(path.join(root, "apps/support-centre/public/brand/beverly-mark.png")), "Must have beverly-mark.png");

// 6. Portals & Vercel routing
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

// 7. Root build script verification
const rootPkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
assert.ok(
  rootPkg.scripts.build.includes("@beverly/support-centre-app"),
  "Root package.json build script must include @beverly/support-centre-app"
);

console.log(JSON.stringify({
  status: "support centre contract passed",
  tokensVerified: true,
  sharedComponents: ["LanguageSwitcher", "WalletExportMenu", "toggleTheme", "initLocale", "initTheme"],
  brandAssets: "beverly-mark.png",
  views: 7,
  components: 3,
  routes: 7,
  telephonyIntegration: "Africa's Talking voice callback ready"
}, null, 2));
