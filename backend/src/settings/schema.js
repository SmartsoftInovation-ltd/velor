const { SECTIONS } = require("./definitions");
const { hasTester } = require("./testers");

// Settings sections described for generic forms (platform console, store dashboard)
const describeField = (name, field) => ({
  name,
  type: field.type,
  required: Boolean(field.required),
  ...(field.type !== "secret" && field.default !== undefined ? { default: field.default } : {}),
  ...(field.values ? { values: field.values } : {}),
  ...(field.min !== undefined ? { min: field.min } : {}),
  ...(field.max !== undefined ? { max: field.max } : {}),
  ...(field.pattern ? { pattern: field.pattern.source } : {}),
});

const describeSection = (key) => ({
  key,
  path: SECTIONS[key].path,
  testable: hasTester(key),
  fields: Object.entries(SECTIONS[key].fields).map(([name, field]) => describeField(name, field)),
});

// Third-party accounts a store connects (everything except general store options)
const INTEGRATION_SECTIONS = Object.keys(SECTIONS).filter((key) => key !== "general");

const describeSections = (keys = Object.keys(SECTIONS)) => keys.map(describeSection);

module.exports = { describeSections, INTEGRATION_SECTIONS };
