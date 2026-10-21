const mongoose = require("mongoose");

// How long a write conflict may keep being retried before it is given up on
const RETRY_BUDGET_MS = 30 * 1000;

const isTransient = (error) =>
  typeof error?.hasErrorLabel === "function" && error.hasErrorLabel("TransientTransactionError");

// A short random pause, longer on each attempt, so requests that conflicted
// do not collide again in lockstep
const backoff = (attempt) =>
  new Promise((resolve) => setTimeout(resolve, Math.random() * 10 * Math.min(attempt, 10)));

/**
 * Run `work(session)` in one transaction. withTransaction retries the whole
 * callback when a parallel request touched the same documents (a transient
 * write conflict), which a bare startTransaction answered with a 500.
 */
const inTransaction = async (work) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
};

/**
 * For a handler that opens its own transaction with startTransaction(), aborts
 * it and rethrows on error, and only answers after commit: run it again when
 * the error is a transient write conflict. Nothing was committed and nothing
 * was sent, so a rerun is the same as the request arriving a moment later.
 */
const retryTransientErrors = (handler) => async (req, res, next) => {
  const started = Date.now();
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await handler(req, res, next);
    } catch (error) {
      if (!isTransient(error) || res.headersSent || Date.now() - started > RETRY_BUDGET_MS) throw error;
      await backoff(attempt);
    }
  }
};

module.exports = { inTransaction, retryTransientErrors };
