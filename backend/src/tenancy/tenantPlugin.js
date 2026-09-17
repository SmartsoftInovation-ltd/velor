const mongoose = require("mongoose");
const { getTenantId, isPlatform } = require("./context");

/**
 * Scopes every query, write and aggregation on a schema to the tenant in the
 * current tenancy context (see ./context.js).
 *
 * TENANCY_MODE=shadow (default): without a context, operations run unscoped —
 *   used while the codebase is migrated. TENANCY_LOG_UNSCOPED=true logs one
 *   warning per model + operation to find the remaining unscoped code paths.
 * TENANCY_MODE=strict: without a context, operations throw.
 * runAsPlatform(): deliberately unscoped in both modes.
 */

const QUERY_OPS = [
  "find",
  "findOne",
  "countDocuments",
  "distinct",
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
];
const REPLACE_OPS = ["replaceOne", "findOneAndReplace"];

// Stages that must stay first in a pipeline
const LEADING_STAGES = ["$search", "$searchMeta", "$collStats", "$indexStats", "$currentOp", "$listSessions", "$changeStream"];

const isStrict = () => process.env.TENANCY_MODE === "strict";

const warned = new Set();
const resetTenancyWarnings = () => warned.clear();

const tenancyError = (message) => {
  const error = new Error(message);
  error.name = "TenancyError";
  return error;
};

/**
 * Returns the tenant id to scope by, or null when the operation must run unscoped.
 * Throws in strict mode when there is no context.
 */
const resolveScope = (modelName, op) => {
  if (isPlatform()) return null;

  const tenantId = getTenantId();
  if (tenantId) return tenantId;

  if (isStrict()) {
    throw tenancyError(`No tenant context for ${modelName}.${op}`);
  }

  const key = `${modelName}:${op}`;
  if (process.env.TENANCY_LOG_UNSCOPED === "true" && !warned.has(key)) {
    warned.add(key);
    console.warn(`[tenancy] ${modelName}.${op} ran without tenant context (shadow mode)`);
  }
  return null;
};

const assertSameTenant = (docTenantId, tenantId, modelName) => {
  if (docTenantId && !tenantId.equals(docTenantId)) {
    throw tenancyError(`Tenant mismatch on ${modelName}`);
  }
};

// AND the tenant into a query: a tenantId already in the filter can only narrow it
const scopeQuery = (query, tenantId) => {
  if (query.getFilter().tenantId === undefined) query.where({ tenantId });
  else query.and([{ tenantId }]);
};

const withTenant = (filter, tenantId) =>
  filter && Object.keys(filter).length ? { $and: [filter, { tenantId }] } : { tenantId };

// Collections whose model applies this plugin (looked up lazily: models register over time)
const isTenantCollection = (collectionName) =>
  mongoose.modelNames().some((name) => {
    const Model = mongoose.model(name);
    return Model.collection.collectionName === collectionName && Model.schema.plugins.some((p) => p.fn === tenantPlugin);
  });

// Joins into tenant-scoped collections get their own tenant $match, so a join on a
// non-ObjectId key (mobile number, sku, ...) can never pull another tenant's documents.
const scopeSubPipelines = (stages, tenantId, isScoped) =>
  stages.map((stage) => {
    const scope = (collection, pipeline = []) => [
      ...(isScoped(collection) ? [{ $match: { tenantId } }] : []),
      ...scopeSubPipelines(pipeline, tenantId, isScoped),
    ];

    if (stage.$lookup) {
      return { $lookup: { ...stage.$lookup, pipeline: scope(stage.$lookup.from, stage.$lookup.pipeline) } };
    }
    if (stage.$unionWith) {
      const union = typeof stage.$unionWith === "string" ? { coll: stage.$unionWith } : stage.$unionWith;
      return { $unionWith: { ...union, pipeline: scope(union.coll, union.pipeline) } };
    }
    if (stage.$graphLookup && isScoped(stage.$graphLookup.from)) {
      const graph = stage.$graphLookup;
      return { $graphLookup: { ...graph, restrictSearchWithMatch: withTenant(graph.restrictSearchWithMatch, tenantId) } };
    }
    if (stage.$facet) {
      return {
        $facet: Object.fromEntries(
          Object.entries(stage.$facet).map(([name, pipeline]) => [name, scopeSubPipelines(pipeline, tenantId, isScoped)]),
        ),
      };
    }
    return stage;
  });

// Pure: returns a copy of the pipeline limited to tenantId
const scopePipeline = (pipeline, tenantId, isScoped = isTenantCollection) => {
  const [first, ...rest] = scopeSubPipelines(pipeline, tenantId, isScoped);
  const match = { $match: { tenantId } };

  if (!first) return [match];

  if (first.$geoNear) {
    const { query, ...stage } = first.$geoNear;
    return [{ $geoNear: { ...stage, query: withTenant(query, tenantId) } }, ...rest];
  }

  if (LEADING_STAGES.some((stage) => first[stage])) {
    return [first, match, ...rest];
  }

  return [match, first, ...rest];
};

// An index that a tenant-scoped query can never use on its own. Every query
// carries tenantId, so MongoDB can only use an index whose leading key is
// tenantId — anything else scans other tenants' entries and throws them away.
//
// Two kinds must stay unscoped:
//   TTL: expireAfterSeconds only works on a single-field index.
//   text: MongoDB rejects a text index with a leading non-text key.
const mustStayUnscoped = (fields, options = {}) =>
  options.expireAfterSeconds !== undefined || Object.values(fields).includes("text");

// Unique constraints are per tenant: { field } becomes { tenantId, field }.
// sparse (and optional fields) become a partial filter, because a compound index
// always contains tenantId and would otherwise treat every missing value as a
// duplicate null.
const scopeIndexes = (schema) => {
  const scopedOptions = (fields, { sparse, ...options }) =>
    sparse
      ? {
          ...options,
          partialFilterExpression: Object.fromEntries(Object.keys(fields).map((f) => [f, { $exists: true }])),
        }
      : options;

  schema.eachPath((name, type) => {
    if (name === "tenantId" || !type._index) return;
    const { unique, sparse, ...rest } = type._index;
    if (mustStayUnscoped({ [name]: 1 }, rest)) return;
    type._index = null;

    if (!unique) {
      schema.index({ tenantId: 1, [name]: 1 }, rest);
      return;
    }
    // An optional field is effectively sparse: documents without it must not collide
    const partial = sparse || !type.isRequired;
    schema.index({ tenantId: 1, [name]: 1 }, { ...scopedOptions({ [name]: 1 }, { sparse: partial, ...rest }), unique: true });
  });

  schema._indexes = schema._indexes.map(([fields, options]) => {
    if ("tenantId" in fields || mustStayUnscoped(fields, options)) return [fields, options];
    return options?.unique
      ? [{ tenantId: 1, ...fields }, scopedOptions(fields, options)]
      : [{ tenantId: 1, ...fields }, options];
  });
};

function tenantPlugin(schema) {
  if (!schema.path("tenantId")) {
    schema.add({
      tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tenant",
        index: true,
        immutable: true,
        // Optional while legacy data is migrated (shadow); mandatory in strict mode
        required: [isStrict, "tenantId is required"],
      },
    });
  }

  scopeIndexes(schema);

  function stampDocument(next) {
    try {
      const modelName = this.constructor.modelName;
      const tenantId = resolveScope(modelName, this.isNew ? "create" : "save");
      if (tenantId) {
        assertSameTenant(this.tenantId, tenantId, modelName);
        if (this.isNew && !this.tenantId) this.tenantId = tenantId;
      }
      next();
    } catch (error) {
      next(error);
    }
  }
  schema.pre("validate", stampDocument);
  schema.pre("save", stampDocument);

  schema.pre(QUERY_OPS, { document: false, query: true }, function scopeQueryHook(next) {
    try {
      const tenantId = resolveScope(this.model.modelName, this.op);
      if (tenantId) scopeQuery(this, tenantId);
      next();
    } catch (error) {
      next(error);
    }
  });

  schema.pre(REPLACE_OPS, { document: false, query: true }, function scopeReplace(next) {
    try {
      const tenantId = resolveScope(this.model.modelName, this.op);
      if (tenantId) {
        scopeQuery(this, tenantId);
        this.setUpdate({ ...this.getUpdate(), tenantId });
      }
      next();
    } catch (error) {
      next(error);
    }
  });

  schema.pre("estimatedDocumentCount", { document: false, query: true }, function refuseEstimate(next) {
    try {
      if (resolveScope(this.model.modelName, this.op)) {
        throw tenancyError("estimatedDocumentCount cannot be tenant-scoped; use countDocuments");
      }
      next();
    } catch (error) {
      next(error);
    }
  });

  schema.pre("insertMany", function scopeInsertMany(next, docs) {
    try {
      const tenantId = resolveScope(this.modelName, "insertMany");
      if (tenantId) {
        for (const doc of [].concat(docs)) {
          assertSameTenant(doc.tenantId, tenantId, this.modelName);
          doc.tenantId = tenantId;
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  });

  schema.pre("bulkWrite", function scopeBulkWrite(next, ops) {
    try {
      const tenantId = resolveScope(this.modelName, "bulkWrite");
      if (tenantId) {
        for (const op of ops) {
          const [type] = Object.keys(op);
          const body = op[type];
          if (type === "insertOne") {
            assertSameTenant(body.document.tenantId, tenantId, this.modelName);
            body.document.tenantId = tenantId;
          } else {
            body.filter = withTenant(body.filter, tenantId);
            if (type === "replaceOne") body.replacement = { ...body.replacement, tenantId };
          }
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  });

  schema.pre("aggregate", function scopeAggregate(next) {
    try {
      const tenantId = resolveScope(this.model().modelName, "aggregate");
      if (tenantId) {
        const pipeline = this.pipeline();
        pipeline.splice(0, pipeline.length, ...scopePipeline(pipeline, tenantId));
      }
      next();
    } catch (error) {
      next(error);
    }
  });
}

module.exports = { tenantPlugin, scopePipeline, resetTenancyWarnings };
