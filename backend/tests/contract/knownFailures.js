// Matrix cases that fail because of a confirmed bug (see BUGS_FOUND.md).
// Each runs as test.failing: when the bug is fixed the case starts passing,
// the run fails, and the entry must be removed here.
const KNOWN = {
};

module.exports = { KNOWN };

// Routes whose answer does not match the documented envelopes (see
// tests/contract/envelope.test.js), with the bug that explains each.
module.exports.ENVELOPE_DEVIATIONS = {};
