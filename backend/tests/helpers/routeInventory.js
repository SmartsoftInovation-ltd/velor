/**
 * The route inventory, read from the source of src/routes at test time.
 *
 * Every route file is parsed (no code runs) and each `_.route(path).method(...)`
 * or `_.method(path, ...)` call becomes one entry:
 *
 *   { file, method, path, fullPath, chain: ["authGuard", "authorize(\"x\", \"view\")", ...],
 *     routerUse: [...], auth, permission, guards }
 *
 * Because it is derived from the code, a new route is picked up by the
 * cross-cutting matrix tests (tests/contract/routeMatrix.test.js) without
 * anyone remembering to list it. TEST_INVENTORY.md is generated from the same
 * function (tests/scripts/generateInventory.js).
 */
const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");

const ROOT = path.resolve(__dirname, "../..");
const ROUTES = path.join(ROOT, "src/routes");
const BASE = "/api/v1";

const readMounts = () => {
  const index = fs.readFileSync(path.join(ROUTES, "index.js"), "utf8");
  const varFile = {};
  for (const m of index.matchAll(/const (\w+) = require\("\.\/api\/([\w.-]+)"\)/g)) varFile[m[1]] = m[2];
  const mounts = {};
  for (const m of index.matchAll(/_\.use\("([^"]+)", (?:require\("\.\/api\/([\w.-]+)"\)|(\w+))\)/g)) {
    const file = m[2] || varFile[m[3]];
    if (file) mounts[`api/${file.replace(/\.js$/, "")}`] = m[1];
  }
  for (const m of index.matchAll(/_\.use\((\w+)\);/g)) {
    if (varFile[m[1]]) mounts[`api/${varFile[m[1]].replace(/\.js$/, "")}`] = "";
  }
  const platform = fs.readFileSync(path.join(ROUTES, "platform/index.js"), "utf8");
  for (const m of platform.matchAll(/_\.use\("([^"]+)", require\("\.\/([\w.-]+)"\)\)/g)) {
    mounts[`platform/${m[2]}`] = `/platform${m[1]}`;
  }
  return mounts;
};

const HTTP = ["get", "post", "put", "patch", "delete"];

const parseFile = (dir, file, mount) => {
  const src = fs.readFileSync(path.join(ROUTES, dir, file), "utf8");
  const ast = parser.parse(src, { sourceType: "script" });
  const text = (n) => src.slice(n.start, n.end).replace(/\s+/g, " ");
  const routerUse = [];
  const out = [];

  const visit = (node) => {
    if (!node || typeof node.type !== "string") return;
    if (node.type === "CallExpression" && node.callee.type === "MemberExpression") {
      const method = node.callee.property.name;
      const obj = node.callee.object;
      if (HTTP.includes(method)) {
        let routePath;
        let args;
        if (obj.type === "Identifier") {
          routePath = node.arguments[0]?.value;
          args = node.arguments.slice(1);
        } else if (obj.type === "CallExpression") {
          let o = obj;
          while (o.type === "CallExpression" && o.callee.property?.name !== "route") o = o.callee.object;
          routePath = o.arguments?.[0]?.value;
          args = node.arguments;
        }
        if (typeof routePath === "string") {
          out.push({ file: `src/routes/${dir}/${file}`, method: method.toUpperCase(), path: `${mount}${routePath}`, chain: args.map(text), routerUse: [...routerUse] });
        }
      }
      if (method === "use" && obj.type === "Identifier") routerUse.push(...node.arguments.map(text));
    }
    for (const key of Object.keys(node)) {
      if (key === "loc") continue;
      const value = node[key];
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value.type === "string") visit(value);
    }
  };
  visit(ast.program);
  return out;
};

const classify = (route) => {
  const all = [...route.routerUse, ...route.chain];
  const has = (re) => all.some((m) => re.test(m));
  const auth = has(/^platformGuard$/)
    ? "platform"
    : has(/^authGuard$/)
      ? "staff"
      : has(/^shopperGuard$/)
        ? "shopper"
        : has(/^guestOrAuth$/)
          ? "guestOrAuth"
          : has(/^optionalAuth$/)
            ? "optional"
            : has(/^resolveWebhookTenant$/)
              ? "webhook"
              : "public";
  const perm = all.find((m) => /^authorize\(/.test(m));
  const any = all.find((m) => /^authorizeAny\(/.test(m));
  // The [module, action] pair that lets a user through (the first one, for authorizeAny)
  const permission = perm
    ? perm.match(/authorize\(\s*"([^"]+)",\s*"([^"]+)"/)?.slice(1)
    : any
      ? any.match(/\[\s*"([^"]+)",\s*"([^"]+)"/)?.slice(1) || (any.includes("SALES_READERS") ? ["retail-sales", "view"] : null)
      : has(/^authorizeSalesCreate$/)
        ? ["retail-sales", "add"]
        : null;
  const permissionGuarded = Boolean(perm) || has(/^authorizeAny\(/) || has(/^authorizeSalesCreate$/) || has(/^platformManaged$/);
  return {
    auth,
    platformManaged: has(/^platformManaged$/),
    permission,
    permissionGuarded,
    rateLimited: all.filter((m) => /Limiter$/.test(m)),
    upload: has(/FileUpload|Upload\(/),
    validated: has(/^validate|^validateBody|^validateQuery|^validateCustomer/),
  };
};

let cached = null;

const routeInventory = () => {
  if (cached) return cached;
  const mounts = readMounts();
  const routes = [];
  for (const dir of ["api", "platform"]) {
    for (const file of fs.readdirSync(path.join(ROUTES, dir)).sort()) {
      if (file === "index.js" || !file.endsWith(".js")) continue;
      const mount = mounts[`${dir}/${file.replace(/\.js$/, "")}`];
      if (mount === undefined) continue; // not mounted anywhere
      routes.push(...parseFile(dir, file, mount));
    }
  }
  cached = routes.map((r) => ({ ...r, fullPath: `${BASE}${r.path}`.replace(/\/$/, "") || BASE, ...classify(r) }));
  return cached;
};

// Fills :params with a value ("*" wildcards become "x")
const concretePath = (route, value = "000000000000000000000000") =>
  route.fullPath.replace(/:(\w+)/g, value).replace(/\*/g, "x");

module.exports = { routeInventory, concretePath, BASE };
