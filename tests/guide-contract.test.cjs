#!/usr/bin/env node
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function read(relPath) {
  const full = path.join(root, relPath);
  assert.ok(fs.existsSync(full), `Expected file to exist: ${relPath}`);
  return fs.readFileSync(full, "utf8");
}

console.log("Verifying Beverly Guide implementation contracts...");

// 1. Master prompt exists and has required sections
const masterPrompt = read("docs/BEVERLY_GUIDE_MASTER_PROMPT.md");
assert.ok(masterPrompt.includes("# Beverly Guide Master Prompt"), "Missing title in master prompt");
assert.ok(masterPrompt.includes("oklch(0.45 0.2 142)"), "Master prompt missing light primary token");
assert.ok(masterPrompt.includes("oklch(0.65 0.15 142)"), "Master prompt missing dark primary token");
assert.ok(masterPrompt.includes("Kinetic Motion Primitives"), "Master prompt missing motion section");
assert.ok(masterPrompt.includes("prefers-reduced-motion"), "Master prompt missing accessibility rule");
assert.ok(masterPrompt.includes("Avatar-Only Navigation Architecture"), "Master prompt missing avatar-only section");
assert.ok(masterPrompt.includes("Flow Pixels Humanizer Engine Voice Specification"), "Master prompt missing humanizer engine section");
console.log("✓ docs/BEVERLY_GUIDE_MASTER_PROMPT.md verified");

// 2. Guide color tokens CSS
const guideCss = read("apps/admin/src/styles/guide-tokens.css");
assert.ok(guideCss.includes("oklch(0.45 0.2 142)"), "guide-tokens.css missing light primary");
assert.ok(guideCss.includes("oklch(0.65 0.15 142)"), "guide-tokens.css missing dark primary");
assert.ok(guideCss.includes("oklch(0.46 0.01 75)"), "guide-tokens.css missing enhanced contrast muted-foreground");
assert.ok(guideCss.includes("guide-grid-pattern"), "guide-tokens.css missing grid pattern");
assert.ok(guideCss.includes('data-theme="executive"'), "guide-tokens.css missing executive theme support");
assert.ok(guideCss.includes('data-theme="contrast"'), "guide-tokens.css missing contrast theme support");
console.log("✓ apps/admin/src/styles/guide-tokens.css verified");

// 3. Motion components exist
const motionComponents = [
  "apps/admin/src/components/guide/Eyebrow.vue",
  "apps/admin/src/components/guide/Reveal.vue",
  "apps/admin/src/components/guide/MaskText.vue",
  "apps/admin/src/components/guide/SpotlightCard.vue",
  "apps/admin/src/components/guide/CountUp.vue",
  "apps/admin/src/components/guide/Stagger.vue"
];
for (const comp of motionComponents) {
  const src = read(comp);
  assert.ok(src.length > 50, `${comp} is too short`);
}
console.log(`✓ All ${motionComponents.length} kinetic motion components verified`);

// 4. Content files exist, match schema, and pass Flow Pixels Humanizer Engine checks
const adminContent = read("apps/admin/src/lib/guide/content.ts");
assert.ok(adminContent.includes("guideModuleGroups"), "content.ts missing guideModuleGroups");
assert.ok(adminContent.includes("guideFaqGroups"), "content.ts missing guideFaqGroups");
assert.ok(adminContent.includes("firstWeekSteps"), "content.ts missing firstWeekSteps");

const crmContent = read("src/data/guide-content.js");
assert.ok(crmContent.includes("guideModuleGroups"), "guide-content.js missing guideModuleGroups");
assert.ok(crmContent.includes("guideFaqGroups"), "guide-content.js missing guideFaqGroups");

// Flow Pixels Humanizer Engine contract: Prohibit banned AI words/phrases
const bannedAiWords = [
  "operational nervous system",
  "seamlessly",
  "delve into",
  "supercharge",
  "unleash",
  "mission-critical",
  "tapestry",
  "testament to",
  "game-changer",
  "cutting-edge",
  "things people ask"
];
for (const banned of bannedAiWords) {
  const regex = new RegExp(banned, "i");
  assert.ok(!regex.test(adminContent), `admin content.ts contains banned AI phrase: "${banned}"`);
  assert.ok(!regex.test(crmContent), `crm guide-content.js contains banned AI phrase: "${banned}"`);
}
console.log("✓ Content models verified & 100% Flow Pixels Humanizer compliant");

// 5. Admin View & Routing (Avatar-Only Placement)
const adminView = read("apps/admin/src/views/Guide.vue");
assert.ok(adminView.includes("AppShell"), "Guide.vue should use AppShell");
assert.ok(adminView.includes("SpotlightCard"), "Guide.vue should use SpotlightCard");
assert.ok(adminView.includes("Eyebrow"), "Guide.vue should use Eyebrow");

const adminRouter = read("apps/admin/src/router/index.ts");
assert.ok(adminRouter.includes("path: '/guide'"), "Admin router missing /guide path");
assert.ok(adminRouter.includes("views/Guide.vue"), "Admin router missing Guide.vue import");

const appShell = read("apps/admin/src/components/AppShell.vue");
// Avatar menu only:
assert.ok(appShell.includes('RouterLink to="/guide" class="bw-user-menu-item"'), "AppShell missing Guide in avatar menu");
assert.ok(appShell.includes("Beverly Guide"), "AppShell missing Beverly Guide account menu label");
// Zero presence in sidebar and topbar:
assert.ok(!appShell.includes("{ to: '/guide'"), "AppShell standardNavGroups must NOT contain /guide");
assert.ok(!appShell.includes('class="bw-icon-btn topbar-utility" title="Beverly Guide"'), "AppShell topbar must NOT contain Guide button");
console.log("✓ Admin Guide view, router, and Avatar-Only AppShell integration verified");

// 6. CRM Guide Page & Routing (Avatar-Only Placement)
const crmGuide = read("src/components/GuidePage.vue");
assert.ok(crmGuide.includes("guideModuleGroups"), "GuidePage.vue missing module import");

const routeManifest = read("src/data/route-manifest.js");
assert.ok(routeManifest.includes("#/guide"), "route-manifest missing #/guide");
assert.ok(routeManifest.includes("GuidePage"), "route-manifest missing GuidePage component");
assert.ok(routeManifest.includes("hideFromSidebar: true"), "route-manifest must set hideFromSidebar: true for #/guide");

const { routeGroups } = require("../src/data/route-manifest.js");
const superAdminGroups = routeGroups("super-admin");
assert.ok(!superAdminGroups.some((g) => g.name === "Guide"), "CRM sidebar routeGroups must NOT contain Guide group");
assert.ok(!superAdminGroups.some((g) => g.routes.some((item) => item.hash === "#/guide")), "CRM sidebar items must NOT contain #/guide");

const appVue = read("src/App.vue");
assert.ok(appVue.includes("import GuidePage"), "App.vue missing GuidePage import");
assert.ok(appVue.includes("GuidePage,"), "App.vue missing GuidePage component registration");
assert.ok(appVue.includes("<GuidePage"), "App.vue missing GuidePage template tag");
assert.ok(appVue.includes("openGuide"), "App.vue missing openGuide method");
assert.ok(appVue.includes('@click="openGuide"'), "App.vue user dropdown missing openGuide trigger");
assert.ok(appVue.split("\n").length < 1200, "App.vue must remain strictly under 1200 lines");
console.log("✓ CRM GuidePage, route manifest, and Avatar-Only App.vue integration verified");

// 7. Vercel deployment rewrites
const vercel = JSON.parse(read("vercel.json"));
const guideRedirect = vercel.redirects.find((r) => r.source === "/guide");
assert.ok(guideRedirect, "vercel.json missing /guide redirect");
assert.strictEqual(guideRedirect.destination, "/wallet-admin/guide");

const guideRewrite = vercel.rewrites.find((r) => r.source === "/guide");
assert.ok(guideRewrite, "vercel.json missing /guide rewrite");
assert.strictEqual(guideRewrite.destination, "/wallet-admin/index.html");
console.log("✓ vercel.json routing & redirects verified");

console.log("\nAll Beverly Guide contracts passed cleanly! (7/7 suites passing)");
