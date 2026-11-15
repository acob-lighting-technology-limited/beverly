"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

function main() {
  const referenceJs = read("api/reference.js");
  const supabaseService = read("backend/src/services/supabase-service.js");
  const pkg = JSON.parse(read("package.json"));

  // 1. CRM sign-in is gated by users.portal_access ('crm'). The legacy role
  //    allowlist only applies while the portal_access column is not deployed.
  assert.match(
    supabaseService,
    /const CRM_STAFF_ROLES = new Set\(\[[\s\S]*?operations-officer[\s\S]*?\]\)/,
    "supabase-service must keep the legacy CRM role list as the pre-migration fallback"
  );
  assert.match(
    supabaseService,
    /if \(!actor\?\.crmAllowed\) \{/,
    "signInWithPassword must reject every account without CRM portal access"
  );
  const { crmPortalAllowed } = require("../backend/src/services/supabase-service.js");
  assert.equal(crmPortalAllowed("account", ["crm"]), true, "portal_access with crm allows CRM");
  assert.equal(crmPortalAllowed("account", ["staff_wallet", "call"]), false, "portal_access without crm blocks CRM");
  assert.equal(crmPortalAllowed("custom-auditor", ["crm"]), true, "custom roles can be granted CRM");
  assert.equal(crmPortalAllowed("super-admin", []), true, "super admins always reach CRM");
  assert.equal(crmPortalAllowed("vendor", undefined), false, "vendors never reach CRM");
  assert.equal(crmPortalAllowed("account", undefined), true, "legacy role list applies before the migration");
  assert.equal(crmPortalAllowed("finance-checker", undefined), false, "legacy role list still blocks finance checkers");

  // 2. Verify /api/auth/session rejects vendor & customer accounts
  assert.match(
    referenceJs,
    /if \(!localActor && actor\?\.crmAllowed !== true\)/,
    "/api/auth/session must reject accounts without CRM portal access"
  );

  // 3. Verify /api/user/login response handling refuses session cookies for vendor & customer accounts
  assert.match(
    referenceJs,
    /const crmAllowed = result\.body\?\.data\?\.crmAllowed === true[\s\S]*?if \(!crmAllowed\)/,
    "/api/user/login must refuse session creation without CRM portal access"
  );

  // 4. Verify test script registration in package.json
  assert.match(
    pkg.scripts["test:auth"],
    /tests\/crm-vendor-login-block\.test\.cjs/,
    "package.json test:auth script must register tests/crm-vendor-login-block.test.cjs"
  );

  console.log({
    status: "crm vendor login block contract passed",
    endpoints: ["/api/user/login", "/api/auth/session"],
    blockedRoles: "every account without CRM portal access",
  });
}

main();
