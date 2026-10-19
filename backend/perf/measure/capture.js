/**
 * Command capture for MODE: measure.
 *
 * - Every Mongoose static (find, aggregate, countDocuments, ...), Query/Aggregate exec and
 *   Document#save records the first SYNCHRONOUS src/ stack frame that called it (the query's
 *   source line) and runs the operation inside an AsyncLocalStorage context carrying it.
 *   Populate / internal queries have no src/ frame and inherit the parent's origin ("via populate").
 * - The driver's commandStarted listener reads that context, so every wire command is tagged with
 *   the src file:line that produced it. Commands are appended to an NDJSON file as they start, so a
 *   crash (e.g. heap OOM on an unbounded endpoint) still leaves the commands for replay.
 * - Redis: cache.get is wrapped to count hits/misses on versioned data keys (`<ns>:v<n>:...`) and,
 *   in force-miss mode, to return null for them so every timed run pays the DB cost.
 */
const fs = require("fs");
const path = require("path");
const { AsyncLocalStorage } = require("async_hooks");

const BACKEND = path.join(__dirname, "..", "..");
const SRC = path.join(BACKEND, "src") + path.sep;
const als = new AsyncLocalStorage();

const FRAME_RE = /^\s*at (?:(async) )?(?:.*? \()?(.+?):(\d+):(\d+)\)?$/;
const srcFrame = (stack) => {
  for (const line of String(stack).split("\n").slice(1)) {
    const m = FRAME_RE.exec(line);
    if (!m || m[1]) continue; // skip async frames: they point at an await, not at the call
    const file = m[2];
    if (file.startsWith(SRC) && !file.includes("node_modules")) {
      return { file: path.relative(BACKEND, file), line: Number(m[3]) };
    }
  }
  return null;
};

const ctxFor = (origin, how) => {
  const parent = als.getStore();
  if (origin) return { origin, via: how };
  if (parent) return { origin: parent.origin, via: `${parent.via || "direct"}>internal` };
  return { origin: null, via: how };
};

const STATICS = [
  "find", "findOne", "findById", "countDocuments", "estimatedDocumentCount", "distinct", "aggregate",
  "updateOne", "updateMany", "findOneAndUpdate", "findByIdAndUpdate", "findOneAndDelete", "findByIdAndDelete",
  "findOneAndReplace", "deleteOne", "deleteMany", "replaceOne", "bulkWrite", "insertMany", "create", "exists",
  "populate",
];

let installed = false;
const install = (mongoose) => {
  if (installed) return;
  installed = true;
  const M = mongoose.Model;
  for (const name of STATICS) {
    const orig = M[name];
    if (typeof orig !== "function") continue;
    M[name] = function perfCaptured(...args) {
      const ctx = ctxFor(srcFrame(new Error().stack), name);
      return als.run(ctx, () => {
        const ret = orig.apply(this, args);
        if (ret && typeof ret === "object" && !(ret instanceof Promise) && !ret._perfCtx) {
          try {
            Object.defineProperty(ret, "_perfCtx", { value: ctx, enumerable: false, writable: true });
          } catch {}
        }
        return ret;
      });
    };
  }
  const wrapExec = (proto) => {
    const orig = proto.exec;
    proto.exec = function perfExec(...args) {
      const ctx = this._perfCtx || ctxFor(srcFrame(new Error().stack), "exec");
      return als.run(ctx, () => orig.apply(this, args));
    };
  };
  wrapExec(mongoose.Query.prototype);
  wrapExec(mongoose.Aggregate.prototype);
  for (const name of ["save", "deleteOne", "updateOne"]) {
    const orig = M.prototype[name];
    if (typeof orig !== "function") continue;
    M.prototype[name] = function perfDoc(...args) {
      const ctx = ctxFor(srcFrame(new Error().stack), `doc.${name}`);
      return als.run(ctx, () => orig.apply(this, args));
    };
  }
  // Native collection calls made directly from src/ (Model.collection.deleteMany, ...)
  const NativeCollection = require("mongoose/lib/drivers/node-mongodb-native/collection");
  for (const name of ["find", "findOne", "aggregate", "countDocuments", "distinct", "updateOne", "updateMany",
    "deleteOne", "deleteMany", "insertOne", "insertMany", "bulkWrite", "findOneAndUpdate"]) {
    const orig = NativeCollection.prototype[name];
    if (typeof orig !== "function") continue;
    NativeCollection.prototype[name] = function perfNative(...args) {
      if (als.getStore()) return orig.apply(this, args);
      const ctx = ctxFor(srcFrame(new Error().stack), `native.${name}`);
      return als.run(ctx, () => orig.apply(this, args));
    };
  }
};

/** Live recorder bound to a MongoClient. */
const IGNORED = new Set(["hello", "isMaster", "ismaster", "ping", "endSessions", "saslStart", "saslContinue",
  "killCursors", "buildInfo", "getParameter", "serverStatus", "create", "createIndexes", "listIndexes", "listCollections"]);

const createRecorder = (client, { file } = {}) => {
  const { EJSON } = require("bson");
  const rec = {
    active: false,
    tag: null,
    count: 0,
    byCommand: {},
    events: [],
    reset(tag) {
      this.count = 0;
      this.byCommand = {};
      this.events = [];
      this.tag = tag;
    },
  };
  client.on("commandStarted", (ev) => {
    if (!rec.active || IGNORED.has(ev.commandName)) return;
    rec.count++;
    rec.byCommand[ev.commandName] = (rec.byCommand[ev.commandName] || 0) + 1;
    const st = als.getStore();
    const origin = st?.origin ? `${st.origin.file}:${st.origin.line}` : null;
    const e = { n: rec.count, cmd: ev.commandName, coll: ev.command[ev.commandName], origin, via: st?.via || null };
    rec.events.push(e);
    if (file && rec.tag === "capture") {
      let body;
      try {
        body = EJSON.stringify(ev.command, { relaxed: false });
      } catch (err) {
        body = null;
      }
      fs.appendFileSync(file, JSON.stringify({ ...e, body }) + "\n");
    }
  });
  return rec;
};

/** Redis cache.get instrumentation. */
const DATA_KEY = /:v\d+:/;
const instrumentCache = (cache) => {
  const stats = { forceMiss: false, hits: 0, misses: 0, gets: 0, keys: new Set() };
  const orig = cache.get.bind(cache);
  cache.get = async (key, ...rest) => {
    const isData = DATA_KEY.test(String(key));
    if (isData) {
      stats.gets++;
      stats.keys.add(String(key));
      if (stats.forceMiss) {
        stats.misses++;
        return null;
      }
    }
    const v = await orig(key, ...rest);
    if (isData) v ? stats.hits++ : stats.misses++;
    return v;
  };
  stats.reset = () => {
    stats.hits = 0;
    stats.misses = 0;
    stats.gets = 0;
    stats.keys = new Set();
  };
  return stats;
};

module.exports = { install, createRecorder, instrumentCache, als, srcFrame };
