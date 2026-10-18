#!/usr/bin/env node
/**
 * Generates tests/TEST_INVENTORY.md and docs/openapi.yaml from the code.
 *
 *   node tests/scripts/generateInventory.js
 *
 * Routes come from tests/helpers/routeInventory.js (the same parser the route
 * matrix uses), so the inventory, the OpenAPI document and the tests never
 * disagree about which endpoints exist. Per-route side effects (cache
 * namespaces bumped/read, queues fed, models touched) are found by a static
 * scan of the handler's source. The real backend/.env is never read.
 */
const fs = require("fs");
const path = require("path");
const Module = require("module");

const ROOT = path.resolve(__dirname, "../..");
process.env.NODE_ENV = "test";
process.env.TENANCY_MODE = "";

// dotenv → no-op, so loading models never reads backend/.env
const origLoad = Module._load;
Module._load = function load(request, ...rest) {
  if (request === "dotenv") return { config: () => ({ parsed: {} }) };
  return origLoad.call(this, request, ...rest);
};
require(path.join(ROOT, "node_modules/module-alias"))(ROOT);

const { routeInventory } = require("../helpers/routeInventory");

// ------------------------------------------------------------------ handler scan
const controllerSource = {};
const handlerBody = (handlerExpr) => {
  const m = handlerExpr.match(/^(\w+)\.(\w+)$/);
  if (!m) return null;
  const [, , fn] = m;
  for (const file of fs.readdirSync(path.join(ROOT, "src/controller"))) {
    if (!file.endsWith(".js")) continue;
    controllerSource[file] = controllerSource[file] || fs.readFileSync(path.join(ROOT, "src/controller", file), "utf8");
    const src = controllerSource[file];
    const start = src.search(new RegExp(`(exports\\.${fn}\\s*=|\\b${fn}\\s*=\\s*asynchandeler|^const ${fn}\\s*=)`, "m"));
    if (start === -1) continue;
    const rest = src.slice(start + 1);
    const next = rest.search(/\n(exports\.\w+\s*=|  \w+\s*=\s*asynchandeler)/);
    return { file, body: src.slice(start, next === -1 ? undefined : start + 1 + next) };
  }
  return null;
};

const uniq = (a) => [...new Set(a)].sort();
const scan = (body = "") => ({
  bumps: uniq([...body.matchAll(/bumpNsVersion\(\s*"([^"]+)"/g)].map((m) => m[1]).concat(/bumpNsVersion\(\s*NS\w*\s*\)/.test(body) ? ["<module NS>"] : [])),
  reads: /buildCacheKey|getCache\(/.test(body),
  jobs: uniq([...body.matchAll(/(\w+Queue)\.(add|addBulk)\(\s*"?([\w-]*)"?/g)].map((m) => `${m[1]}${m[3] ? `:${m[3]}` : ""}`)),
  audit: /logAudit\(/.test(body),
  models: uniq([...body.matchAll(/\b([A-Z]\w*|\w+Model)\.(find\w*|create|update\w*|delete\w*|aggregate|bulkWrite|countDocuments|exists|insertMany)\(/g)].map((m) => m[1]).filter((n) => !["Promise", "Object", "Array", "JSON", "Math", "Number", "String", "Date"].includes(n))),
  transaction: /withTransaction|startTransaction/.test(body),
});

// ------------------------------------------------------------------ models
const loadModels = () => {
  const mongoose = require("mongoose");
  for (const dir of ["src/models", "src/models/platform"]) {
    for (const f of fs.readdirSync(path.join(ROOT, dir))) if (f.endsWith(".js")) require(path.join(ROOT, dir, f));
  }
  const SECRET = /password|token|secret|apiKey|otp/i;
  return mongoose.modelNames().sort().map((name) => {
    const M = mongoose.model(name);
    const s = M.schema;
    const fields = [];
    const secrets = [];
    s.eachPath((p, t) => {
      if (["_id", "__v"].includes(p)) return;
      const o = t.options || {};
      const flags = [];
      if (o.required) flags.push("required");
      if (o.unique) flags.push("unique");
      if (o.enum) flags.push(`enum: ${(Array.isArray(o.enum) ? o.enum : o.enum.values || []).join("/")}`);
      if (o.immutable) flags.push("immutable");
      if (o.min !== undefined) flags.push(`min ${Array.isArray(o.min) ? o.min[0] : o.min}`);
      if (SECRET.test(p)) secrets.push(p);
      fields.push(`\`${p}\` ${t.instance}${flags.length ? ` (${flags.join(", ")})` : ""}`);
    });
    const indexes = s.indexes().map(([f, o]) => `${JSON.stringify(f)}${o?.unique ? " unique" : ""}${o?.expireAfterSeconds !== undefined ? ` ttl=${o.expireAfterSeconds}` : ""}`);
    const hooks = [];
    for (const [k, arr] of s.s.hooks._pres) for (const h of arr) if (!["validateBeforeSave", "shardingPlugin", "saveSubdocs", "validateRestoreSubdocs"].includes(h.fn.name)) hooks.push(`pre ${k}${h.fn.name ? ` ${h.fn.name}` : ""}`);
    for (const [k] of s.s.hooks._posts) hooks.push(`post ${k}`);
    return {
      name,
      collection: M.collection.collectionName,
      scoped: Boolean(s.path("tenantId")),
      fields,
      indexes,
      hooks: uniq(hooks),
      virtuals: Object.keys(s.virtuals).filter((v) => v !== "id"),
      secrets,
    };
  });
};

// ------------------------------------------------------------------ write
const routes = routeInventory();
const rows = routes.map((r) => {
  const handler = r.chain[r.chain.length - 1];
  const found = handlerBody(handler);
  return { ...r, handler, controller: found?.file, effects: scan(found?.body) };
});

const md = [];
md.push("# Test inventory (generated)");
md.push("");
md.push("Generated by `node tests/scripts/generateInventory.js` from the source; do not edit by hand.");
md.push(`Routes: **${rows.length}** · Models: see below · Risk ranking at the end.`);
md.push("");
md.push("Legend — auth: `staff` (authGuard, staff audience), `shopper` (shopperGuard), `guestOrAuth`, `optional` (optionalAuth), `public`, `webhook` (webhookKey), `platform` (platformGuard). Permission: the `[module, action]` that `authorize()` (or the first pair of `authorizeAny()`) requires. Effects are a static scan of the handler: cache namespaces bumped (`bump`), cache read (`cache`), queue jobs, audit event, models touched, transaction.");
md.push("");
let group = "";
for (const r of rows.sort((a, b) => a.file.localeCompare(b.file) || a.path.localeCompare(b.path))) {
  if (r.file !== group) {
    group = r.file;
    md.push("", `## ${group.replace("src/routes/", "")}`, "", "| Method | Path | Auth | Permission | Middleware | Handler | Effects |", "|---|---|---|---|---|---|---|");
  }
  const mw = [...r.routerUse, ...r.chain.slice(0, -1)].filter((m) => !/^authGuard$|^authorize/.test(m)).join(", ") || "—";
  const e = r.effects;
  const effects = [
    e.bumps.length && `bump: ${e.bumps.join(", ")}`,
    e.reads && "cache",
    e.jobs.length && `jobs: ${e.jobs.join(", ")}`,
    e.audit && "audit",
    e.transaction && "txn",
    e.models.length && `models: ${e.models.join(", ")}`,
  ].filter(Boolean).join("; ") || "—";
  md.push(`| ${r.method} | \`${r.fullPath}\` | ${r.auth} | ${r.permission ? `${r.permission[0]}:${r.permission[1]}` : r.platformManaged ? "platform-managed (403)" : "—"} | ${mw.replace(/\|/g, "\\|")} | ${r.handler}${r.controller ? ` (${r.controller})` : ""} | ${effects.replace(/\|/g, "\\|")} |`);
}

md.push("", "## Models", "");
const models = loadModels();
for (const m of models) {
  md.push(`### ${m.name} — \`${m.collection}\` (${m.scoped ? "tenant-scoped" : "GLOBAL"})`, "");
  md.push(`- Fields: ${m.fields.join("; ")}`);
  md.push(`- Indexes: ${m.indexes.join("; ") || "none"}`);
  md.push(`- Hooks: ${m.hooks.join("; ") || "none"}`);
  if (m.virtuals.length) md.push(`- Virtuals: ${m.virtuals.join(", ")}`);
  if (m.secrets.length) md.push(`- **Never expose:** ${m.secrets.join(", ")}`);
  md.push("");
}

md.push(fs.readFileSync(path.join(__dirname, "inventory.static.md"), "utf8"));
fs.writeFileSync(path.join(ROOT, "tests/TEST_INVENTORY.md"), md.join("\n"));

// ------------------------------------------------------------------ OpenAPI
const y = [];
const q = (s) => JSON.stringify(s);
y.push("openapi: 3.0.3");
y.push("info:");
y.push("  title: Velor backend API");
y.push("  version: \"phase1-generated\"");
y.push("  description: >-");
y.push("    Generated from the route source by tests/scripts/generateInventory.js.");
y.push("    Every response uses SuccessEnvelope (2xx) or ErrorEnvelope (4xx/5xx);");
y.push("    tests/contract/envelope.test.js checks every route against them.");
y.push("servers:");
y.push("  - url: /api/v1");
y.push("components:");
y.push("  securitySchemes:");
y.push("    staffBearer: { type: http, scheme: bearer, bearerFormat: JWT, description: \"aud=staff, carries sub/tid/tv\" }");
y.push("    shopperBearer: { type: http, scheme: bearer, bearerFormat: JWT, description: \"aud=shopper\" }");
y.push("    platformBearer: { type: http, scheme: bearer, bearerFormat: JWT }");
y.push("  parameters:");
y.push("    Tenant: { name: x-tenant, in: header, required: false, schema: { type: string }, description: \"store slug; required in strict tenancy for tenant routes\" }");
y.push("  schemas:");
y.push("    SuccessEnvelope:");
y.push("      type: object");
y.push("      required: [status, statusCode, message]");
y.push("      properties:");
y.push("        status: { type: string, enum: [OK] }");
y.push("        statusCode: { type: integer, minimum: 200, maximum: 299 }");
y.push("        message: { type: string }");
y.push("        data: {}");
y.push("    ErrorEnvelope:");
y.push("      type: object");
y.push("      required: [statusCode, message]");
y.push("      properties:");
y.push("        statusCode: { type: integer, minimum: 400, maximum: 599 }");
y.push("        message: { type: string }");
y.push("        code: { type: string, description: \"machine-readable, e.g. TENANT_CONTEXT_REQUIRED\" }");
y.push("  responses:");
y.push("    Success: { description: OK, content: { application/json: { schema: { $ref: \"#/components/schemas/SuccessEnvelope\" } } } }");
y.push("    Error: { description: Error, content: { application/json: { schema: { $ref: \"#/components/schemas/ErrorEnvelope\" } } } }");
y.push("paths:");
const byPath = {};
for (const r of rows) {
  const p = (r.fullPath.replace(/^\/api\/v1/, "") || "/").replace(/:(\w+)/g, "{$1}").replace(/\*/g, "{wildcard}");
  (byPath[p] = byPath[p] || []).push(r);
}
for (const p of Object.keys(byPath).sort()) {
  y.push(`  ${q(p)}:`);
  for (const r of byPath[p]) {
    y.push(`    ${r.method.toLowerCase()}:`);
    y.push(`      operationId: ${q(`${r.method.toLowerCase()}_${p.replace(/[^\w]+/g, "_")}`)}`);
    y.push(`      tags: [${q(r.file.replace(/^src\/routes\/(api|platform)\//, "").replace(/\.api\.js$|\.js$/, ""))}]`);
    const sec = { staff: "staffBearer", shopper: "shopperBearer", platform: "platformBearer" }[r.auth];
    y.push(sec ? `      security: [{ ${sec}: [] }]` : "      security: []");
    if (r.permission) y.push(`      x-permission: ${q(`${r.permission[0]}:${r.permission[1]}`)}`);
    if (r.rateLimited.length) y.push(`      x-rate-limit: [${r.rateLimited.map(q).join(", ")}]`);
    const params = [...p.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    y.push("      parameters:");
    y.push("        - $ref: \"#/components/parameters/Tenant\"");
    for (const name of params) y.push(`        - { name: ${q(name)}, in: path, required: true, schema: { type: string } }`);
    if (["POST", "PUT", "PATCH"].includes(r.method)) {
      y.push("      requestBody:");
      y.push(`        content: { ${r.upload ? "multipart/form-data" : "application/json"}: { schema: { type: object } } }`);
    }
    y.push("      responses:");
    y.push("        \"200\": { $ref: \"#/components/responses/Success\" }");
    if (r.method === "POST") y.push("        \"201\": { $ref: \"#/components/responses/Success\" }");
    y.push("        \"400\": { $ref: \"#/components/responses/Error\" }");
    if (r.auth !== "public") y.push("        \"401\": { $ref: \"#/components/responses/Error\" }");
    if (r.permissionGuarded) y.push("        \"403\": { $ref: \"#/components/responses/Error\" }");
    y.push("        \"404\": { $ref: \"#/components/responses/Error\" }");
    if (r.rateLimited.length) y.push("        \"429\": { $ref: \"#/components/responses/Error\" }");
  }
}
fs.mkdirSync(path.join(ROOT, "docs"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "docs/openapi.yaml"), `${y.join("\n")}\n`);

console.log(`wrote tests/TEST_INVENTORY.md (${rows.length} routes, ${models.length} models) and docs/openapi.yaml`);
process.exit(0);
