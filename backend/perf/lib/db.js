/**
 * Connects to the perf DB through the app's OWN Mongoose models, so the
 * collections and indexes are exactly the ones the schemas define.
 *
 *   const { connect, disconnect, models, commandCounter } = require("./perf/lib/db");
 *   await connect();               // guard runs first, always
 *   await syncAppIndexes();        // createIndexes() for every app model
 */
const { assertPerfTarget, assertConnectedTarget } = require("./guard");

// Guard runs at require time: nothing below may load before it passes.
const target = assertPerfTarget();

require("module-alias/register");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const MODELS_DIR = path.join(__dirname, "..", "..", "src", "models");

const requireAll = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) requireAll(full);
    else if (entry.name.endsWith(".js")) require(full);
  }
};

let loaded = false;
const loadModels = () => {
  if (!loaded) {
    requireAll(MODELS_DIR);
    loaded = true;
  }
  return Object.fromEntries(mongoose.modelNames().map((n) => [n, mongoose.model(n)]));
};

/** Counts driver commands (round-trips). Reset before an endpoint call, read after. */
const commandCounter = {
  count: 0,
  byCommand: {},
  reset() {
    this.count = 0;
    this.byCommand = {};
  },
  snapshot() {
    return { count: this.count, byCommand: { ...this.byCommand } };
  },
};
const IGNORED = new Set(["hello", "isMaster", "ismaster", "ping", "endSessions", "saslStart", "saslContinue", "killCursors"]);

const connect = async (opts = {}) => {
  loadModels();
  await mongoose.connect(target.uri, {
    autoIndex: false, // indexes are created explicitly via syncAppIndexes()
    monitorCommands: true,
    maxPoolSize: opts.maxPoolSize || 20,
  });
  assertConnectedTarget(mongoose.connection);
  const client = mongoose.connection.getClient();
  client.on("commandStarted", (ev) => {
    if (IGNORED.has(ev.commandName)) return;
    commandCounter.count++;
    commandCounter.byCommand[ev.commandName] = (commandCounter.byCommand[ev.commandName] || 0) + 1;
  });
  return mongoose.connection;
};

/** Build every index the app schemas declare (what production should have). */
const syncAppIndexes = async ({ log = console.log } = {}) => {
  assertConnectedTarget(mongoose.connection);
  const models = loadModels();
  const conflicts = [];
  for (const [name, Model] of Object.entries(models)) {
    const t = Date.now();
    await Model.createCollection().catch(() => {});
    try {
      await Model.createIndexes();
    } catch (err) {
      // Same as production: Mongoose builds the schema's indexes in declaration
      // order and the first conflicting definition wins. Build the rest one by
      // one in that order and record the ones MongoDB refuses.
      for (const [fields, options] of Model.schema.indexes()) {
        try {
          await Model.collection.createIndex(fields, { background: true, ...options });
        } catch (e) {
          conflicts.push({ model: name, collection: Model.collection.collectionName, fields, options, error: `${e.codeName || e.code}: ${e.message.split(".")[0]}` });
        }
      }
    }
    log(`[indexes] ${name} (${Model.collection.collectionName}) ${Date.now() - t}ms`);
  }
  for (const c of conflicts) log(`[indexes] NOT CREATED ${c.collection} ${JSON.stringify(c.fields)} ${JSON.stringify(c.options)} -> ${c.error}`);
  return { conflicts };
};

/** Snapshot of the current index set per collection, to restore after experiments. */
const snapshotIndexes = async () => {
  assertConnectedTarget(mongoose.connection);
  const out = {};
  for (const c of await mongoose.connection.db.listCollections().toArray()) {
    if (c.type === "view") continue;
    out[c.name] = await mongoose.connection.db.collection(c.name).indexes();
  }
  return out;
};

const disconnect = () => mongoose.disconnect();

module.exports = {
  target,
  mongoose,
  connect,
  disconnect,
  loadModels,
  get models() {
    return loadModels();
  },
  syncAppIndexes,
  snapshotIndexes,
  commandCounter,
};
