const Permission = require("../models/permisson.model");
const Role = require("../models/role.model");
const User = require("../models/user.model");
const { runForTenant, runAsPlatform } = require("../tenancy/context");

// Five screens were guarded by another module's permission and so could not be
// granted on their own. Each now has its own permission. So that nobody loses
// a screen they use today, every role and user grant of the old permission is
// copied onto the new one (only the actions that make sense there).
//
//   Sales Return      ← Retail Sales        (view, add, edit, delete)
//   Draft Order       ← Sales History       (view, edit, delete)
//   Due SMS           ← Send SMS            (view, add) and Send Bulk SMS (add)
//   Assign Role       ← Create Permission   (view)      and Create Role (edit)
//   Store Information ← Site Information    (view, add, edit, delete)
const SPLITS = [
  { name: "Sales Return", from: [["retail-sales", ["view", "add", "edit", "delete"]]] },
  { name: "Draft Order", from: [["sales-history", ["view", "edit", "delete"]]] },
  { name: "Due SMS", from: [["send-sms", ["view", "add"]], ["send-bulk-sms", ["add"]]] },
  { name: "Assign Role", from: [["create-permission", ["view"]], ["create-role", ["edit"]], ["create-permission", ["add"], "view"]] },
  { name: "Store Information", from: [["site-information", ["view", "add", "edit", "delete"]]] },
];

// The catalog is global: create what is missing, once
const ensurePermissions = () =>
  runAsPlatform(async () => {
    const bySlug = {};
    for (const { name } of SPLITS) {
      const permission =
        (await Permission.findOne({ permissionName: name })) || (await new Permission({ permissionName: name }).save());
      bySlug[name] = permission;
    }
    return bySlug;
  });

// The actions a holder of `grants` gets on the new permission
const actionsFor = (grants, from) => {
  const out = new Set();
  for (const [slug, actions, asAction] of from) {
    const held = grants.get(slug);
    if (!held) continue;
    for (const action of actions) if (held.has(action)) out.add(asAction || action);
  }
  return [...out];
};

// The grants one role or user gains: the new permissions they do not hold yet
const additionsFor = (doc, created) => {
  const grants = new Map();
  for (const entry of doc.permissions || []) {
    const slug = entry.permission?.slug;
    if (slug) grants.set(slug, new Set(entry.actions || []));
  }
  const additions = [];
  for (const split of SPLITS) {
    const target = created[split.name];
    if (grants.has(target.slug)) continue;
    const actions = actionsFor(grants, split.from);
    if (actions.length) additions.push({ permission: target._id, actions });
  }
  return additions;
};

const extendAll = async (Model, filter, created) => {
  let changed = 0;
  for (const doc of await Model.find(filter).populate("permissions.permission").lean()) {
    const additions = additionsFor(doc, created);
    if (!additions.length) continue;
    await Model.updateOne({ _id: doc._id }, { $push: { permissions: { $each: additions } } });
    changed += 1;
  }
  return changed;
};

module.exports = {
  name: "017-split-module-permissions",
  SPLITS,
  up: async ({ tenant }) => {
    const created = await ensurePermissions();
    return runForTenant(tenant._id, async () => ({
      roles: await extendAll(Role, {}, created),
      users: await extendAll(User, { "permissions.0": { $exists: true } }, created),
    }));
  },
};
