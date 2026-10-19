/**
 * $indexStats + index sizes snapshot. "before" is taken once (kept across resumed runs) so the
 * delta covers exactly the measurement run; "after" is refreshed at the end of every run.
 */
const { assertPerfTarget, assertConnectedTarget } = require("../lib/guard");
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");
const { RAW_DIR } = require("./scenarios");

const snapshot = async (tag) => {
  const target = assertPerfTarget();
  const file = path.join(RAW_DIR, `indexstats-${tag}.json`);
  if (tag === "before" && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  const client = new MongoClient(target.uri, { appName: "velor-perf-indexstats" });
  await client.connect();
  const db = client.db();
  assertConnectedTarget({ db, name: db.databaseName, host: target.hosts[0] });
  const out = { takenAt: new Date().toISOString(), collections: {} };
  for (const c of await db.listCollections({}, { nameOnly: true }).toArray()) {
    if (c.type === "view" || c.name.startsWith("system.")) continue;
    const coll = db.collection(c.name);
    const stats = await coll.aggregate([{ $indexStats: {} }]).toArray();
    const cs = await db.command({ collStats: c.name });
    out.collections[c.name] = {
      count: cs.count,
      indexes: stats.map((s) => ({ name: s.name, key: s.key, ops: Number(s.accesses?.ops ?? 0), since: s.accesses?.since, sizeMB: Math.round(((cs.indexSizes || {})[s.name] || 0) / 10485.76) / 100, spec: s.spec })),
    };
  }
  fs.writeFileSync(file, JSON.stringify(out, null, 1));
  await client.close();
  return out;
};

module.exports = { snapshot };
