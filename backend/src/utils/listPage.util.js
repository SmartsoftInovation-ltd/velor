const mongoose = require("mongoose");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

/**
 * Paging for list endpoints (BUG-P2-010). Every list answers one page: a
 * whole collection with its populates ran the API out of memory on a large
 * shop. Lists are read newest first on a { tenantId, createdAt, _id } index.
 *
 *   ?limit=   rows per page, default 50, at most 100
 *   ?after=   keyset cursor "<createdAt ISO>_<_id>" from the previous page's
 *             `nextCursor` — every page costs the same
 *   ?page=    page number, for screens that number their pages (skips on the
 *             index, so it gets slower the deeper it goes)
 *
 * The answer carries `hasNextPage` and `nextCursor`; one extra row is read to
 * know whether there is more, so no count of the whole collection is needed.
 */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const parseCursor = (after) => {
  if (!after) return null;
  const [iso, id] = String(after).split("_");
  const createdAt = new Date(iso);
  if (Number.isNaN(createdAt.getTime()) || !mongoose.isValidObjectId(id)) {
    throw new customError("Invalid cursor", statusCodes.BAD_REQUEST);
  }
  return { createdAt, id: new mongoose.Types.ObjectId(id) };
};

const listPage = (query = {}) => {
  const requested = Math.floor(Number(query.limit));
  const limit = requested > 0 ? Math.min(requested, MAX_LIMIT) : DEFAULT_LIMIT;
  const cursor = parseCursor(query.after);
  const page = cursor ? 1 : Math.max(1, parseInt(query.page) || 1);
  return { limit, page, skip: (page - 1) * limit, cursor };
};

// The rows after the cursor, newest first
const afterCursor = (cursor) =>
  cursor
    ? {
        $or: [
          { createdAt: { $lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
        ],
      }
    : {};

const NEWEST_FIRST = { createdAt: -1, _id: -1 };

// rows: what was read with limit + 1
const pageResult = (rows, { limit, page }) => {
  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    page,
    limit,
    hasNextPage,
    nextCursor:
      hasNextPage && last?.createdAt ? `${new Date(last.createdAt).toISOString()}_${last._id}` : null,
  };
};

module.exports = { listPage, afterCursor, pageResult, NEWEST_FIRST, DEFAULT_LIMIT, MAX_LIMIT };
