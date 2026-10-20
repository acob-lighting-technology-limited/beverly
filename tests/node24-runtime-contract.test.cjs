"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8").trim();
const packageJson = JSON.parse(read("package.json"));

assert.equal(packageJson.engines?.node, "24.x", "Vercel must select Node 24 from package.json");
assert.equal(packageJson.packageManager, "pnpm@10.28.0", "pnpm must remain pinned for repeatable installs");
assert.equal(read(".nvmrc"), "24.13.1", "NVM must select the approved Node 24 release");
assert.equal(read(".node-version"), "24.13.1", "other version managers must select the approved Node 24 release");
assert.match(read("tools/node-version-check.cjs"), /EXPECTED_NODE_MAJOR = 24/, "runtime guard must reject non-Node-24 runtimes");
assert.match(read("tools/vercel-deploy-preflight.cjs"), /nodeEngine !== "24\.x"/, "Vercel preflight must reject a non-Node-24 deployment contract");
assert.equal(JSON.parse(read("vercel.json")).env?.ENABLE_EXPERIMENTAL_COREPACK, "1", "Vercel must enable Corepack for the pinned pnpm version");
assert.match(read(".npmrc"), /^engine-strict=true$/m, "installs must fail clearly when the wrong Node major is active");

console.log("node 24 runtime contract passed");
