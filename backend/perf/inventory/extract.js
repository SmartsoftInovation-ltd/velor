/**
 * Static extractor for MODE: inventory.
 *
 * Walks every .js file in src/ with @babel/parser, finds every database
 * operation (Mongoose model calls, native collection calls, populate,
 * aggregate pipelines with $lookup), resolves which model / collection it
 * hits, which exported function contains it, which routes / jobs reach that
 * function (call graph across files), and the query shape (filter keys, sort,
 * projection, limit/skip, populate, regex, loops).
 *
 * Pure static analysis: it does not touch any database. index.js combines
 * this with the live index list of the perf DB (guarded) to flag sorts and
 * filters that no tenantId-leading index serves.
 */
const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;

const ROOT = path.join(__dirname, "..", "..");
const SRC = path.join(ROOT, "src");

const READ_OPS = ["find", "findOne", "findById", "aggregate", "countDocuments", "estimatedDocumentCount", "distinct", "exists"];
const WRITE_OPS = [
  "updateOne", "updateMany", "findOneAndUpdate", "findByIdAndUpdate", "findOneAndDelete", "findByIdAndDelete",
  "findOneAndReplace", "replaceOne", "deleteOne", "deleteMany", "bulkWrite", "findByIdAndRemove", "findOneAndRemove",
];
const INSERT_OPS = ["create", "insertMany", "insertOne"];
const ALL_OPS = new Set([...READ_OPS, ...WRITE_OPS, ...INSERT_OPS]);
const CHAIN = new Set(["sort", "skip", "limit", "select", "lean", "populate", "session", "collation", "hint", "allowDiskUse", "projection", "toArray", "exec", "cursor", "batchSize", "maxTimeMS", "setOptions", "where", "countDocuments"]);

const listJs = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return listJs(full);
    return e.name.endsWith(".js") ? [full] : [];
  });

const rel = (f) => path.relative(ROOT, f);
const src = (node, max = 160) => {
  try {
    const s = generate(node, { compact: true, comments: false }).code;
    return s.length > max ? `${s.slice(0, max)}…` : s;
  } catch {
    return "?";
  }
};

const parse = (code) =>
  parser.parse(code, { sourceType: "unambiguous", plugins: ["optionalChaining", "nullishCoalescingOperator", "classProperties", "topLevelAwait"], errorRecovery: true });

// ---------------------------------------------------------------- models
/** model file -> { exportKey|"default": modelName }, modelName -> collection */
const loadModelMeta = () => {
  require("module-alias/register");
  const mongoose = require("mongoose");
  const byFile = {};
  for (const f of listJs(path.join(SRC, "models"))) {
    const before = new Set(mongoose.modelNames());
    let exp;
    try {
      exp = require(f);
    } catch (e) {
      exp = null;
    }
    const map = {};
    const isModel = (m) => m && typeof m === "function" && m.modelName && m.collection;
    if (isModel(exp)) map.default = exp.modelName;
    else if (exp && typeof exp === "object") {
      for (const [k, v] of Object.entries(exp)) if (isModel(v)) map[k] = v.modelName;
    }
    const added = mongoose.modelNames().filter((n) => !before.has(n));
    byFile[f] = { exports: map, defined: added };
  }
  const collections = Object.fromEntries(mongoose.modelNames().map((n) => [n, mongoose.model(n).collection.collectionName]));
  const tenantScoped = Object.fromEntries(mongoose.modelNames().map((n) => [n, !!mongoose.model(n).schema.path("tenantId")]));
  return { byFile, collections, tenantScoped };
};

// ---------------------------------------------------------------- module resolution
const resolveRequire = (fromFile, spec) => {
  let base;
  if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(fromFile), spec);
  else return null;
  for (const c of [base, `${base}.js`, path.join(base, "index.js")]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
};

// ---------------------------------------------------------------- per-file analysis
const fnNameOf = (p) => {
  // name of the function node at path p
  const n = p.node;
  if (n.id && n.id.name) return n.id.name;
  let cur = p.parentPath;
  while (cur) {
    const c = cur.node;
    if (cur.isVariableDeclarator()) return c.id.name || null;
    if (cur.isAssignmentExpression()) {
      const l = c.left;
      if (l.type === "MemberExpression") return l.property.name || l.property.value || null;
      if (l.type === "Identifier") return l.name;
      return null;
    }
    if (cur.isObjectProperty() || cur.isClassProperty()) return c.key.name || c.key.value || null;
    if (cur.isCallExpression() || cur.isArrowFunctionExpression() || cur.isFunctionExpression() || cur.isAwaitExpression()) {
      // asyncHandler(async () => {}) or schema.pre("find", fn) — keep walking for wrappers
      if (cur.isCallExpression()) {
        const callee = c.callee;
        // schema.pre/post hook: name it after the hook
        if (callee.type === "MemberExpression" && ["pre", "post"].includes(callee.property.name)) {
          const ev = c.arguments[0];
          const evs = ev ? (ev.type === "ArrayExpression" ? ev.elements.map((e) => e.value).join("|") : ev.value) : "?";
          return `hook:${callee.property.name}(${evs})`;
        }
        if (callee.type === "MemberExpression" && ["schedule"].includes(callee.property.name)) return "cron.schedule";
        // only walk through wrapper calls whose argument is this function
        if (!c.arguments.includes(p.node) && !c.arguments.some((a) => a === (cur === p.parentPath ? p.node : null))) {
          // function passed somewhere other than as a wrapper arg (e.g. arr.map(fn)) — not a named fn
          if (!(c.arguments.length && c.arguments.some((a) => a.type === "ArrowFunctionExpression" || a.type === "FunctionExpression"))) return null;
        }
        const callName = callee.type === "Identifier" ? callee.name : callee.property && callee.property.name;
        if (!/^(async[Hh]andl?er|asynchandeler|asyncHandeler|asyncHandler|catchAsync|wrap)$/.test(callName || "")) return null;
      }
      cur = cur.parentPath;
      continue;
    }
    if (cur.isClassMethod() || cur.isObjectMethod()) return c.key.name;
    return null;
  }
  return null;
};

const analyzeFile = (file, modelMeta) => {
  const code = fs.readFileSync(file, "utf8");
  const ast = parse(code);
  const lines = code.split("\n");

  // local identifier -> modelName ; local identifier -> {file, exportName} for functions
  const modelVars = {};
  const importedFns = {};
  const thisModel = (modelMeta.byFile[file] && modelMeta.byFile[file].defined[0]) || null;

  const bindRequire = (id, reqFile, member) => {
    const meta = modelMeta.byFile[reqFile];
    if (id.type === "Identifier") {
      if (meta) {
        const key = member || "default";
        if (meta.exports[key]) modelVars[id.name] = meta.exports[key];
        else if (!member && Object.keys(meta.exports).length === 1) modelVars[id.name] = Object.values(meta.exports)[0];
      } else importedFns[id.name] = { file: reqFile, name: member || "*", ns: !member };
    } else if (id.type === "ObjectPattern") {
      for (const prop of id.properties) {
        if (prop.type !== "ObjectProperty") continue;
        const key = prop.key.name || prop.key.value;
        const local = prop.value.type === "Identifier" ? prop.value.name : prop.value.left && prop.value.left.name;
        if (!local) continue;
        if (meta && meta.exports[key]) modelVars[local] = meta.exports[key];
        else if (!meta) importedFns[local] = { file: reqFile, name: key };
      }
    }
  };

  traverse(ast, {
    VariableDeclarator(p) {
      let init = p.node.init;
      if (!init) return;
      let member = null;
      if (init.type === "MemberExpression" && init.object.type === "CallExpression") {
        member = init.property.name;
        init = init.object;
      }
      if (init.type === "CallExpression" && init.callee.name === "require" && init.arguments[0] && init.arguments[0].type === "StringLiteral") {
        const r = resolveRequire(file, init.arguments[0].value);
        if (r) bindRequire(p.node.id, r, member);
      }
      // const X = mongoose.model("Name")
      if (init.type === "CallExpression" && init.callee.type === "MemberExpression" && init.callee.property.name === "model" && init.arguments.length === 1 && init.arguments[0].type === "StringLiteral") {
        if (p.node.id.type === "Identifier") modelVars[p.node.id.name] = init.arguments[0].value;
      }
      // const X = mongoose.model("Name", schema) in model files
      if (init.type === "CallExpression" && init.callee.type === "MemberExpression" && init.callee.property.name === "model" && init.arguments.length >= 2 && init.arguments[0].type === "StringLiteral") {
        if (p.node.id.type === "Identifier") modelVars[p.node.id.name] = init.arguments[0].value;
      }
    },
  });

  const functions = {}; // name -> {calls:Set<string>, line}
  const ops = [];
  const routes = [];

  const enclosingNamed = (p) => {
    // returns [nearestName, topLevelName]
    let nearest = null;
    let top = null;
    let cur = p.getFunctionParent();
    while (cur) {
      const n = fnNameOf(cur);
      if (n && !nearest) nearest = n;
      if (n) top = n;
      cur = cur.parentPath && cur.parentPath.getFunctionParent();
    }
    return [nearest, top];
  };

  const resolveModelExpr = (obj, p) => {
    // returns {model, collection, native}
    if (!obj) return null;
    if (obj.type === "Identifier") {
      if (modelVars[obj.name]) return { model: modelVars[obj.name] };
      // local alias: const M = cond ? A : B or Model param
      const b = p.scope.getBinding(obj.name);
      if (b && b.path.isVariableDeclarator() && b.path.node.init) {
        const init = b.path.node.init;
        if (init.type === "Identifier" && modelVars[init.name]) return { model: modelVars[init.name] };
        if (init.type === "ConditionalExpression") {
          const a = resolveModelExpr(init.consequent, p);
          const c = resolveModelExpr(init.alternate, p);
          if (a || c) return { model: [a && a.model, c && c.model].filter(Boolean).join("|") };
        }
        if (init.type === "MemberExpression" && init.property.name === "collection") {
          const r = resolveModelExpr(init.object, p);
          if (r) return { ...r, native: true };
        }
        // const coll = mongoose.connection.db.collection("x")
        if (init.type === "CallExpression" && init.callee.type === "MemberExpression" && init.callee.property.name === "collection" && init.arguments[0] && init.arguments[0].type === "StringLiteral") {
          return { collection: init.arguments[0].value, native: true };
        }
      }
      return null;
    }
    if (obj.type === "ThisExpression") {
      return thisModel ? { model: thisModel, viaThis: true } : null;
    }
    if (obj.type === "MemberExpression") {
      const prop = obj.property.name;
      if (prop === "collection") {
        const r = resolveModelExpr(obj.object, p);
        return r ? { ...r, native: true } : null;
      }
      if (prop === "constructor" && obj.object.type === "ThisExpression" && thisModel) return { model: thisModel, viaThis: true };
      if (prop === "model" && obj.object.type === "ThisExpression" && thisModel) return { model: thisModel, viaThis: true };
      // models.Sales, mongoose.models.Sales
      if (obj.object.type === "MemberExpression" && obj.object.property.name === "models") return { model: prop };
      if (obj.object.type === "Identifier" && obj.object.name === "models") return { model: prop };
      return null;
    }
    if (obj.type === "CallExpression" && obj.callee.type === "MemberExpression") {
      const cp = obj.callee.property.name;
      if (cp === "model" && obj.arguments[0] && obj.arguments[0].type === "StringLiteral") return { model: obj.arguments[0].value };
      if (cp === "model" && obj.callee.object.type === "ThisExpression") return thisModel ? { model: thisModel, viaThis: true } : null;
      if (cp === "collection" && obj.arguments[0] && obj.arguments[0].type === "StringLiteral") return { collection: obj.arguments[0].value, native: true };
    }
    return null;
  };

  // resolve an identifier to an object/array literal in scope (one level), plus mutations
  const resolveLiteral = (node, p, depth = 0) => {
    if (!node || depth > 3) return { node, extraKeys: [] };
    if (node.type === "Identifier") {
      const b = p.scope.getBinding(node.name);
      if (!b) return { node, extraKeys: [] };
      const extraKeys = [];
      for (const ref of b.referencePaths) {
        const par = ref.parentPath;
        // filter.x = ... / filter[x] = ...
        if (par.isMemberExpression() && par.node.object === ref.node && par.parentPath.isAssignmentExpression() && par.parentPath.node.left === par.node) {
          extraKeys.push(par.node.computed ? (par.node.property.type === "StringLiteral" ? par.node.property.value : `[${src(par.node.property, 40)}]`) : par.node.property.name);
          // filter.$or = [...] -> look inside
          const rv = par.parentPath.node.right;
          if (rv) extraKeys.push(...regexHints(rv));
        }
        // pipeline.push({...})
        if (par.isMemberExpression() && par.node.object === ref.node && ["push", "unshift", "splice"].includes(par.node.property.name) && par.parentPath.isCallExpression()) {
          for (const a of par.parentPath.node.arguments) extraKeys.push({ pushed: a });
        }
        // Object.assign(filter, {...})
        if (par.isCallExpression() && par.node.arguments[0] === ref.node && src(par.node.callee) === "Object.assign") {
          for (const a of par.node.arguments.slice(1)) if (a.type === "ObjectExpression") extraKeys.push(...a.properties.map((x) => (x.key ? x.key.name || x.key.value : "...")));
        }
      }
      for (const v of b.constantViolations || []) {
        if (v.isAssignmentExpression() && v.node.right) extraKeys.push({ reassigned: v.node.right });
      }
      const init = b.path.isVariableDeclarator() ? b.path.node.init : null;
      if (init && (init.type === "ObjectExpression" || init.type === "ArrayExpression")) return { node: init, extraKeys, resolved: true };
      if (init && (init.type === "ConditionalExpression" || init.type === "LogicalExpression")) {
        // cond ? {a} : {} -> union of both branches' keys
        const branches = init.type === "ConditionalExpression" ? [init.consequent, init.alternate] : [init.left, init.right];
        const objs = branches.map((x) => resolveLiteral(x, b.path, depth + 1)).filter((r) => r.node && r.node.type === "ObjectExpression");
        if (objs.length) {
          const merged = { type: "ObjectExpression", properties: objs.flatMap((r) => r.node.properties) };
          return { node: merged, extraKeys: [...extraKeys, ...objs.flatMap((r) => r.extraKeys)], resolved: true, conditional: true };
        }
      }
      if (init && init.type === "Identifier") {
        const r = resolveLiteral(init, b.path, depth + 1);
        return { ...r, extraKeys: [...r.extraKeys, ...extraKeys] };
      }
      if (init && init.type === "CallExpression") return { node: init, extraKeys, call: true };
      return { node: init || node, extraKeys };
    }
    return { node, extraKeys: [] };
  };

  const regexHints = (node) => {
    const out = [];
    const s = src(node, 4000);
    if (/\$regex/.test(s) || /new RegExp\(/.test(s) || /^\/.*\/[gimsuy]*$/.test(s)) out.push("$regex");
    if (/\$options:\s*"i"|\$options:'i'|"i"\)/.test(s)) out.push("regex:i");
    if (/\$where/.test(s)) out.push("$where");
    if (/\$nin/.test(s)) out.push("$nin");
    if (/\$ne\b/.test(s)) out.push("$ne");
    if (/\$text/.test(s)) out.push("$text");
    if (/\$expr/.test(s)) out.push("$expr");
    if (/\$or\b/.test(s)) out.push("$or");
    return out;
  };

  let objPath = null; // path used to resolve spreads in objKeys
  const objKeys = (node, depth = 0) => {
    if (!node || node.type !== "ObjectExpression") return [];
    const ks = [];
    for (const pr of node.properties) {
      if (pr.type === "SpreadElement") {
        if (objPath && depth < 3) {
          let arg = pr.argument;
          if (arg.type === "ConditionalExpression") arg = arg.consequent;
          if (arg.type === "LogicalExpression") arg = arg.right;
          if (arg.type === "ObjectExpression") {
            ks.push(...objKeys(arg, depth + 1));
            continue;
          }
          const r = resolveLiteral(arg, objPath);
          if (r.node && r.node.type === "ObjectExpression") {
            ks.push(...objKeys(r.node, depth + 1), ...r.extraKeys.filter((x) => typeof x === "string"));
            continue;
          }
        }
        ks.push(`...${src(pr.argument, 40)}`);
        continue;
      }
      const k = pr.key.name || pr.key.value || (pr.computed ? `[${src(pr.key, 30)}]` : "?");
      const v = pr.value;
      if (k === "$or" || k === "$and" || k === "$nor") {
        const inner = v.type === "ArrayExpression" ? v.elements.flatMap((e) => objKeys(e)) : [src(v, 40)];
        ks.push(`${k}(${[...new Set(inner)].join(",")})`);
      } else if (v && v.type === "ObjectExpression") {
        const ops = v.properties.map((x) => (x.key ? x.key.name || x.key.value : "")).filter((x) => x && x.startsWith("$"));
        ks.push(ops.length ? `${k}{${ops.join(",")}}` : k);
      } else ks.push(k);
    }
    return ks;
  };

  const inLoop = (p) => {
    let cur = p.parentPath;
    const fnBoundary = p.getFunctionParent();
    while (cur) {
      if (cur.isForStatement() || cur.isForOfStatement() || cur.isForInStatement() || cur.isWhileStatement() || cur.isDoWhileStatement()) return "for";
      if (cur.isFunction()) {
        const par = cur.parentPath;
        if (par && par.isCallExpression() && par.node.callee.type === "MemberExpression" && ["map", "forEach", "reduce", "filter", "flatMap", "some", "every"].includes(par.node.callee.property.name)) {
          return `.${par.node.callee.property.name}()`;
        }
        // stop at a named function (not an inline callback)
        if (fnNameOf(cur)) return null;
      }
      cur = cur.parentPath;
    }
    return null;
  };

  const userInputNames = (fnPath) => {
    // names destructured from req.query/body/params in the enclosing (top) function
    const names = new Set();
    if (!fnPath) return names;
    fnPath.traverse({
      VariableDeclarator(v) {
        const init = v.node.init;
        const s = init ? src(init, 200) : "";
        if (/^req\.(query|body|params)|^\{\.\.\.req\.(query|body)/.test(s) || /req\.(query|body|params)\b/.test(s)) {
          if (v.node.id.type === "ObjectPattern") {
            for (const pr of v.node.id.properties) {
              if (pr.type === "ObjectProperty") {
                const local = pr.value.type === "Identifier" ? pr.value.name : pr.value.left && pr.value.left.name;
                if (local) names.add(local);
              } else if (pr.type === "RestElement") names.add(pr.argument.name);
            }
          } else if (v.node.id.type === "Identifier") names.add(v.node.id.name);
        }
      },
    });
    return names;
  };

  const describePipeline = (arr, p) => {
    // arr: ArrayExpression (possibly with spreads)
    const stages = [];
    const lookups = [];
    let sort = null;
    let skip = false;
    let limit = false;
    let matchKeys = [];
    const hints = [];
    const walkStage = (st) => {
      if (!st) return;
      if (st.type === "SpreadElement") {
        const r = resolveLiteral(st.argument, p);
        if (r.node && r.node.type === "ArrayExpression") r.node.elements.forEach(walkStage);
        else if (st.argument.type === "CallExpression") stages.push(`...${src(st.argument.callee, 40)}()`);
        else if (st.argument.type === "ConditionalExpression") {
          [st.argument.consequent, st.argument.alternate].forEach((b) => b.type === "ArrayExpression" && b.elements.forEach(walkStage));
        } else stages.push(`...${src(st.argument, 40)}`);
        return;
      }
      if (st.type === "Identifier") {
        const r = resolveLiteral(st, p);
        if (r.node && r.node.type === "ObjectExpression") return walkStage(r.node);
        stages.push(st.name);
        return;
      }
      if (st.type === "ConditionalExpression") {
        walkStage(st.consequent);
        return;
      }
      if (st.type !== "ObjectExpression") {
        stages.push(src(st, 30));
        return;
      }
      for (const pr of st.properties) {
        if (pr.type === "SpreadElement") continue;
        const k = pr.key.name || pr.key.value;
        stages.push(k);
        const v = pr.value;
        if (k === "$lookup" && v.type === "ObjectExpression") {
          const g = (name) => {
            const x = v.properties.find((q) => q.key && (q.key.name || q.key.value) === name);
            return x ? (x.value.type === "StringLiteral" ? x.value.value : src(x.value, 60)) : null;
          };
          const pipe = v.properties.find((q) => q.key && (q.key.name || q.key.value) === "pipeline");
          let inner = null;
          if (pipe && pipe.value.type === "ArrayExpression") inner = describePipeline(pipe.value, p);
          lookups.push({ from: g("from"), localField: g("localField"), foreignField: g("foreignField"), let: !!g("let"), pipeline: inner ? inner.stages.join(">") : pipe ? "dynamic" : null, innerMatch: inner ? inner.matchKeys : [] });
        } else if (k === "$match") {
          const r = v.type === "Identifier" ? resolveLiteral(v, p) : { node: v, extraKeys: [] };
          const ks = objKeys(r.node).concat(r.extraKeys.filter((x) => typeof x === "string"));
          if (!matchKeys.length) matchKeys = ks;
          hints.push(...regexHints(r.node || v));
        } else if (k === "$sort") {
          if (!sort) sort = src(v, 80);
        } else if (k === "$skip") skip = true;
        else if (k === "$limit") limit = true;
        else if (k === "$facet" && v.type === "ObjectExpression") {
          for (const fp of v.properties) {
            if (fp.value && fp.value.type === "ArrayExpression") {
              const inner = describePipeline(fp.value, p);
              stages.push(`facet:${fp.key.name || fp.key.value}[${inner.stages.join(">")}]`);
              lookups.push(...inner.lookups);
              if (inner.skip) skip = true;
              if (inner.limit) limit = true;
              if (inner.sort && !sort) sort = inner.sort;
              hints.push(...inner.hints);
            }
          }
        } else if (k === "$unionWith") {
          lookups.push({ from: v.type === "StringLiteral" ? v.value : src(v, 60), unionWith: true });
        }
      }
    };
    (arr.elements || []).forEach(walkStage);
    return { stages, lookups, sort, skip, limit, matchKeys, hints };
  };

  traverse(ast, {
    Function(fp) {
      const n = fnNameOf(fp);
      if (!n) return;
      const calls = new Set();
      fp.traverse({
        CallExpression(cp) {
          const c = cp.node.callee;
          if (c.type === "Identifier") calls.add(c.name);
          else if (c.type === "MemberExpression" && c.object.type === "Identifier" && (c.object.name === "exports" || c.object.name === "module")) calls.add(c.property.name);
          else if (c.type === "MemberExpression" && c.object.type === "Identifier" && importedFns[c.object.name]) calls.add(`${c.object.name}.${c.property.name}`);
          else if (c.type === "MemberExpression" && c.object.type === "ThisExpression") calls.add(c.property.name);
          // passing a function reference as an argument (e.g. withTransaction(fn))
          for (const a of cp.node.arguments) if (a.type === "Identifier") calls.add(a.name);
        },
      });
      if (!functions[n]) functions[n] = { calls: new Set(), line: fp.node.loc.start.line };
      calls.forEach((c) => functions[n].calls.add(c));
    },

    CallExpression(p) {
      const callee = p.node.callee;

      // ---------------- routes
      if (callee.type === "MemberExpression" && ["get", "post", "put", "patch", "delete", "all"].includes(callee.property.name)) {
        const obj = callee.object;
        let routePath = null;
        if (obj.type === "CallExpression" && obj.callee.type === "MemberExpression" && obj.callee.property.name === "route" && obj.arguments[0] && obj.arguments[0].type === "StringLiteral") routePath = obj.arguments[0].value;
        else if (obj.type === "CallExpression" && obj.callee.type === "MemberExpression" && ["get", "post", "put", "patch", "delete"].includes(obj.callee.property.name)) {
          // chained _.route(x).get(...).post(...)
          let o = obj;
          while (o.type === "CallExpression" && o.callee.type === "MemberExpression" && o.callee.property.name !== "route") o = o.callee.object;
          if (o.type === "CallExpression" && o.arguments[0] && o.arguments[0].type === "StringLiteral") routePath = o.arguments[0].value;
        } else if (p.node.arguments[0] && p.node.arguments[0].type === "StringLiteral" && obj.type === "Identifier") routePath = p.node.arguments[0].value;
        if (routePath !== null && rel(file).includes("routes")) {
          const handlers = p.node.arguments
            .filter((a) => a.type === "MemberExpression" || a.type === "Identifier")
            .map((a) => {
              if (a.type === "MemberExpression" && a.object.type === "Identifier" && importedFns[a.object.name]) return { file: importedFns[a.object.name].file, name: a.property.name };
              if (a.type === "Identifier" && importedFns[a.name]) return { file: importedFns[a.name].file, name: importedFns[a.name].name };
              return null;
            })
            .filter(Boolean);
          routes.push({ method: callee.property.name.toUpperCase(), path: routePath, handlers, line: p.node.loc.start.line });
        }
      }

      // ---------------- db ops
      if (callee.type !== "MemberExpression") return;
      const op = callee.property.name;
      const isPopulateOnly = op === "populate";
      if (!ALL_OPS.has(op) && !isPopulateOnly) return;

      // populate on a document / query result (not part of a model chain we already capture)
      if (isPopulateOnly) {
        // skip if this populate is part of a chain rooted in a model op (captured as chain)
        let o = callee.object;
        while (o && o.type === "CallExpression" && o.callee.type === "MemberExpression") {
          if (ALL_OPS.has(o.callee.property.name)) return;
          o = o.callee.object;
        }
        // Model.populate(docs, ...) or doc.populate(...)
      }

      const target = resolveModelExpr(callee.object, p);
      if (!target && !isPopulateOnly) {
        // insertMany/create/find on unknown objects (arrays, services) are not DB ops — skip
        return;
      }
      if (op === "create" && target && target.native) return;

      // chain: walk outward
      const chain = [];
      let outer = p;
      while (outer.parentPath && outer.parentPath.isMemberExpression() && outer.parentPath.node.object === outer.node && outer.parentPath.parentPath.isCallExpression()) {
        const m = outer.parentPath.node.property.name;
        const call = outer.parentPath.parentPath.node;
        if (CHAIN.has(m)) chain.push({ m, args: call.arguments.map((a) => src(a, 120)), argNodes: call.arguments });
        else if (m === "then" || m === "catch") break;
        outer = outer.parentPath.parentPath;
      }

      // query kept in a variable and refined later: let q = Model.find(); q = q.skip(); q.limit()
      {
        let holder = null;
        const par = outer.parentPath;
        const par2 = par && par.isAwaitExpression() ? par.parentPath : par;
        if (par && par.isVariableDeclarator() && par.node.id.type === "Identifier") holder = par.node.id.name;
        else if (par && par.isAssignmentExpression() && par.node.left.type === "Identifier") holder = par.node.left.name;
        if (holder && !(par2 && par2 !== par)) {
          const b = p.scope.getBinding(holder);
          if (b) {
            for (const ref of [...b.referencePaths, ...b.constantViolations]) {
              let r = ref;
              while (r && r.parentPath && r.parentPath.isMemberExpression() && r.parentPath.node.object === r.node && r.parentPath.parentPath.isCallExpression()) {
                const m = r.parentPath.node.property.name;
                const call = r.parentPath.parentPath.node;
                if (CHAIN.has(m)) chain.push({ m, args: call.arguments.map((a) => src(a, 120)), argNodes: call.arguments, later: true });
                r = r.parentPath.parentPath;
              }
            }
          }
        }
      }
      const args = p.node.arguments;
      objPath = p;
      const [nearest, top] = enclosingNamed(p);
      const topFnPath = (() => {
        let cur = p.getFunctionParent();
        let last = null;
        while (cur) {
          if (fnNameOf(cur)) last = cur;
          cur = cur.parentPath && cur.parentPath.getFunctionParent();
        }
        return last;
      })();
      const inputs = userInputNames(topFnPath);

      const rec = {
        file: rel(file),
        line: p.node.loc.start.line,
        op,
        model: target ? target.model || null : null,
        collection: target ? target.collection || null : null,
        native: !!(target && target.native),
        fn: nearest,
        topFn: top,
        chain: chain.map((c) => `${c.m}(${c.args.join(",")})`),
        sort: null,
        skip: chain.some((c) => c.m === "skip"),
        limit: chain.some((c) => c.m === "limit") ? chain.find((c) => c.m === "limit").args[0] : null,
        projection: null,
        lean: chain.some((c) => c.m === "lean"),
        populate: chain.filter((c) => c.m === "populate").map((c) => c.args.join(",")),
        filterKeys: [],
        filterSrc: null,
        hints: [],
        loop: inLoop(p),
        userInput: [],
        pipeline: null,
        code: (lines[p.node.loc.start.line - 1] || "").trim().slice(0, 200),
      };

      if (isPopulateOnly) {
        rec.populate = [args.map((a) => src(a, 120)).join(",")];
        rec.model = target ? target.model : null;
        rec.populateOn = src(callee.object, 60);
      }

      const sortC = chain.find((c) => c.m === "sort");
      if (sortC) rec.sort = sortC.args[0];
      const selC = chain.find((c) => c.m === "select" || c.m === "projection");
      if (selC) rec.projection = selC.args[0];

      const filterOps = new Set(["find", "findOne", "countDocuments", "distinct", "exists", "updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "deleteMany", "findOneAndDelete", "replaceOne", "findOneAndReplace", "findOneAndRemove"]);
      if (filterOps.has(op) || op === "findById" || op === "findByIdAndUpdate" || op === "findByIdAndDelete" || op === "findByIdAndRemove") {
        let fArg = op === "distinct" ? args[1] : args[0];
        if (op.startsWith("findById")) {
          rec.filterKeys = ["_id"];
          rec.filterSrc = args[0] ? src(args[0], 80) : null;
        } else if (fArg) {
          const r = resolveLiteral(fArg, p);
          const node = r.node && r.node.type === "ObjectExpression" ? r.node : fArg;
          rec.filterKeys = objKeys(node);
          const extras = r.extraKeys.filter((x) => typeof x === "string");
          rec.filterKeys.push(...extras.map((x) => (x.startsWith("$") && !["$or", "$and"].includes(x) ? x : x)));
          rec.filterKeys = [...new Set(rec.filterKeys)];
          rec.filterSrc = src(fArg, 200);
          rec.hints.push(...regexHints(node));
          for (const x of r.extraKeys) if (typeof x === "object" && x.reassigned) rec.hints.push(...regexHints(x.reassigned));
          if (r.node && r.node.type === "CallExpression") rec.filterKeys.push(`<${src(r.node.callee, 40)}()>`);
          if (!rec.filterKeys.length && node.type === "ObjectExpression") rec.filterKeys = ["{}"];
        } else rec.filterKeys = ["{}"];
        if (op === "distinct" && args[0]) rec.distinctField = src(args[0], 40);
        // projection as 2nd arg for find/findOne
        if (["find", "findOne", "findById"].includes(op) && args[1] && !rec.projection) rec.projection = src(args[1], 100);
      }

      if (op === "aggregate") {
        let a0 = args[0];
        let arr = null;
        if (a0) {
          const r = resolveLiteral(a0, p);
          if (r.node && r.node.type === "ArrayExpression") arr = r.node;
          rec.pipelineSrc = src(a0, 60);
          if (arr) {
            const d = describePipeline(arr, p);
            // pushed stages
            for (const x of r.extraKeys) {
              if (typeof x === "object" && x.pushed) {
                const dd = describePipeline({ elements: [x.pushed] }, p);
                d.stages.push(...dd.stages.map((s) => `+${s}`));
                d.lookups.push(...dd.lookups);
                if (dd.sort && !d.sort) d.sort = dd.sort;
                d.skip = d.skip || dd.skip;
                d.limit = d.limit || dd.limit;
                d.hints.push(...dd.hints);
              }
            }
            rec.pipeline = d;
            rec.filterKeys = d.matchKeys;
            rec.sort = d.sort;
            rec.skip = d.skip;
            rec.limit = d.limit ? "$limit" : null;
            rec.hints.push(...d.hints);
          } else if (r.node && r.node.type === "CallExpression") {
            // local builder: const build = (x) => [ ... ]
            let built = null;
            if (r.node.callee.type === "Identifier") {
              const b = p.scope.getBinding(r.node.callee.name);
              const fnNode = b && b.path.isVariableDeclarator() ? b.path.node.init : b && b.path.isFunctionDeclaration() ? b.path.node : null;
              if (fnNode && fnNode.body) {
                let body = fnNode.body;
                if (body.type === "BlockStatement") {
                  const ret = body.body.find((x) => x.type === "ReturnStatement");
                  body = ret ? ret.argument : null;
                }
                if (body && body.type === "ArrayExpression") built = describePipeline(body, b.path);
              }
            }
            rec.pipeline = built ? { ...built, builder: src(r.node.callee, 50) } : { stages: [`<${src(r.node.callee, 50)}()>`], lookups: [], matchKeys: [] };
            if (built) {
              rec.sort = built.sort;
              rec.skip = built.skip;
              rec.limit = built.limit ? "$limit" : null;
              rec.hints.push(...built.hints);
              // match keys come from the builder's argument
              const a = r.node.arguments[0];
              if (a) {
                const ra = resolveLiteral(a, p);
                rec.filterKeys = ra.node && ra.node.type === "ObjectExpression" ? objKeys(ra.node) : built.matchKeys;
              }
            }
          } else rec.pipeline = { stages: [`<${src(a0, 50)}>`], lookups: [], matchKeys: [] };
        }
        // also: chained .append / .sort on aggregate
      }

      // regex anywhere in the enclosing fn near this op (search builders)
      if (topFnPath) {
        const fsrc = src(topFnPath.node, 200000);
        if (/\$regex|new RegExp\(/.test(fsrc)) rec.fnHasRegex = true;
        if (/new RegExp\(\s*["'`]\^|\$regex:\s*[`"']\^|"\^"\s*\+|`\^\$\{/.test(fsrc)) rec.fnHasAnchoredRegex = true;
        if (/new RegExp\([^)]*"i"\)|\$options:\s*"i"|new RegExp\([^)]*'i'\)/.test(fsrc)) rec.fnHasCaseInsensitive = true;
        if (/\.skip\(|\$skip/.test(fsrc)) rec.fnHasSkip = true;
        if (/getCache\(/.test(fsrc)) rec.cached = true;
      }

      // user input that flows into the filter
      const fs_ = `${rec.filterSrc || ""} ${rec.pipelineSrc || ""} ${rec.chain.join(" ")}`;
      rec.userInput = [...inputs].filter((n) => new RegExp(`\\b${n}\\b`).test(fs_));
      if (/req\.(query|body|params)/.test(fs_)) rec.userInput.push("req.*");
      if (rec.op === "aggregate" && rec.pipeline && rec.pipeline.matchKeys.length && !rec.userInput.length) {
        // pipeline built from user input elsewhere
        rec.userInput = rec.userInput.concat([...inputs].slice(0, 0));
      }

      rec.hints = [...new Set(rec.hints)];
      ops.push(rec);
    },
  });

  return { file: rel(file), abs: file, functions, ops, routes, importedFns };
};

// ---------------------------------------------------------------- mount prefixes
const mountPrefixes = () => {
  // routes/index.js mounts api files; platform/index.js mounts platform files
  const out = {}; // abs route file -> prefix
  const visit = (file, prefix) => {
    const code = fs.readFileSync(file, "utf8");
    const ast = parse(code);
    const varFiles = {};
    traverse(ast, {
      VariableDeclarator(p) {
        const i = p.node.init;
        if (i && i.type === "CallExpression" && i.callee.name === "require" && i.arguments[0].type === "StringLiteral") {
          const r = resolveRequire(file, i.arguments[0].value);
          if (r && p.node.id.type === "Identifier") varFiles[p.node.id.name] = r;
        }
      },
    });
    traverse(ast, {
      CallExpression(p) {
        const c = p.node.callee;
        if (c.type !== "MemberExpression" || c.property.name !== "use") return;
        const a = p.node.arguments;
        let pre = "";
        let target = null;
        for (const x of a) {
          if (x.type === "StringLiteral") pre = x.value;
          else if (x.type === "Identifier" && varFiles[x.name]) target = varFiles[x.name];
          else if (x.type === "CallExpression" && x.callee.name === "require" && x.arguments[0].type === "StringLiteral") {
            const r = resolveRequire(file, x.arguments[0].value);
            if (r && r.includes(`${path.sep}routes${path.sep}`)) target = r;
          }
        }
        if (target && target.includes(`${path.sep}routes${path.sep}`)) {
          const full = `${prefix}${pre}`;
          (out[target] = out[target] || []).push(full);
          if (target.endsWith("index.js") && target !== file) visit(target, full);
        }
      },
    });
  };
  visit(path.join(SRC, "routes", "index.js"), "/api/v1");
  return out;
};

const extract = () => {
  const modelMeta = loadModelMeta();
  const files = listJs(SRC);
  const analyses = files.map((f) => analyzeFile(f, modelMeta));
  const byAbs = Object.fromEntries(analyses.map((a) => [a.abs, a]));

  // routes: handler (file#fn) -> ["GET /api/v1/x"]
  const prefixes = mountPrefixes();
  const handlerRoutes = {};
  for (const a of analyses) {
    if (!a.routes.length) continue;
    const pre = prefixes[a.abs] || ["/api/v1?"];
    for (const r of a.routes) {
      for (const h of r.handlers) {
        const key = `${rel(h.file)}#${h.name}`;
        for (const p of pre) (handlerRoutes[key] = handlerRoutes[key] || new Set()).add(`${r.method} ${p}${r.path === "/" ? "" : r.path}`);
      }
    }
  }

  // reverse call graph: callee key -> caller keys
  const callers = {};
  for (const a of analyses) {
    for (const [fn, info] of Object.entries(a.functions)) {
      const callerKey = `${a.file}#${fn}`;
      for (const c of info.calls) {
        let calleeKey;
        if (c.includes(".")) {
          const [ns, name] = c.split(".");
          const imp = a.importedFns[ns];
          if (imp) calleeKey = `${rel(imp.file)}#${name}`;
        } else if (a.importedFns[c]) {
          calleeKey = `${rel(a.importedFns[c].file)}#${a.importedFns[c].name}`;
        } else if (a.functions[c]) calleeKey = `${a.file}#${c}`;
        if (calleeKey && calleeKey !== callerKey) (callers[calleeKey] = callers[calleeKey] || new Set()).add(callerKey);
      }
    }
  }

  const triggersOf = (key) => {
    const seen = new Set();
    const routes = new Set();
    const roots = new Set();
    const stack = [key];
    while (stack.length) {
      const k = stack.pop();
      if (seen.has(k)) continue;
      seen.add(k);
      if (handlerRoutes[k]) handlerRoutes[k].forEach((r) => routes.add(r));
      const cs = callers[k];
      if (!cs || !cs.size) roots.add(k);
      else cs.forEach((c) => stack.push(c));
    }
    return { routes: [...routes], roots: [...roots].filter((r) => r !== key || !routes.size) };
  };

  const ops = analyses.flatMap((a) => a.ops);
  for (const o of ops) {
    const key = `${o.file}#${o.fn}`;
    const t = triggersOf(key);
    if (o.topFn && o.topFn !== o.fn) {
      const t2 = triggersOf(`${o.file}#${o.topFn}`);
      t2.routes.forEach((r) => t.routes.includes(r) || t.routes.push(r));
      t2.roots.forEach((r) => t.roots.includes(r) || t.roots.push(r));
    }
    o.routes = t.routes.sort();
    o.roots = t.roots;
    if (o.model && modelMeta.collections[o.model]) o.collection = modelMeta.collections[o.model];
    else if (o.model && o.model.includes("|")) o.collection = o.model.split("|").map((m) => modelMeta.collections[m] || m).join("|");
    o.tenantScoped = o.model ? !!modelMeta.tenantScoped[o.model.split("|")[0]] : null;
  }
  return { ops, modelMeta, handlerRoutes, callers };
};

module.exports = { extract };

if (require.main === module) {
  const { ops } = extract();
  const out = process.argv[2] || path.join(ROOT, "reports", "phase2", "query-inventory.raw.json");
  fs.writeFileSync(out, JSON.stringify(ops, null, 1));
  console.log(`ops: ${ops.length} -> ${out}`);
}
