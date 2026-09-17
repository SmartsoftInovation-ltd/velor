const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { GLOBAL_MODELS } = require("../tenancy/registry");

const MODELS_DIR = path.join(__dirname, "../models");

const requireAll = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) requireAll(full);
    else if (entry.name.endsWith(".js")) require(full);
  }
};

// Every tenant-scoped model, with all model files loaded
const tenantModels = () => {
  requireAll(MODELS_DIR);
  return mongoose
    .modelNames()
    .filter((name) => !GLOBAL_MODELS.includes(name))
    .map((name) => mongoose.model(name))
    .filter((Model) => Model.schema.path("tenantId"));
};

module.exports = { tenantModels };
