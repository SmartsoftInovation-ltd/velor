/**
 * Indexed name search for products and variants (BUG-P2-004, BUG-P2-011).
 *
 * A case-insensitive "contains" regex on the name cannot use an index, so on a
 * catalogue of hundreds of thousands of items every keystroke read them all.
 * Instead each document keeps `searchWords`: the lower-case words of its name,
 * indexed as { tenantId, searchWords } (multikey). A search term then matches
 * any word of the name by its beginning, through the index: "shi" finds
 * "Cotton Shirt", "cotton sh" needs both words.
 */

// A name search needs this many characters; one letter matches half the catalogue
const MIN_TERM_LENGTH = 2;
// Words of a query that are matched (the first one drives the index)
const MAX_TERMS = 5;

const escapeRegex = (str = "") => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The lower-case words of one or more texts, each once
const searchWordsOf = (...texts) => {
  const words = new Set();
  for (const text of texts) {
    for (const word of String(text || "").toLowerCase().match(/[\p{L}\p{N}]+/gu) || []) {
      words.add(word);
    }
  }
  return [...words];
};

/**
 * The filter for a typed name, or null when it is too short to search.
 * Every word of the query must begin a word of the name.
 */
const nameSearchFilter = (query) => {
  const terms = searchWordsOf(query).slice(0, MAX_TERMS);
  if (!terms.length || String(query || "").trim().length < MIN_TERM_LENGTH) return null;
  // The longest term first: the index scan starts from the most selective one
  terms.sort((a, b) => b.length - a.length);
  return { searchWords: { $all: terms.map((t) => new RegExp(`^${escapeRegex(t)}`)) } };
};

/**
 * "Contains" name search for the product and variant lists: every word typed
 * must appear somewhere in `field`, in any case ("shirt" finds
 * "CASUALFULLSHIRT", "ull sh" finds "Casual Full Shirt"). Unlike
 * nameSearchFilter this cannot use an index, so it reads the store's whole
 * collection; fine for the list pages, which stay paged.
 */
const nameContainsFilter = (query, field) => {
  const terms = searchWordsOf(query).slice(0, MAX_TERMS);
  if (!terms.length) return null;
  return { $and: terms.map((t) => ({ [field]: { $regex: escapeRegex(t), $options: "i" } })) };
};

/**
 * Keep `searchWords` in step with the name field on every write path: save,
 * insertMany and the update queries.
 */
const searchWordsPlugin = (schema, { field }) => {
  schema.add({ searchWords: { type: [String], select: false } });
  schema.index({ searchWords: 1 });

  schema.pre("save", function (next) {
    if (this.isNew || this.isModified(field)) this.searchWords = searchWordsOf(this.get(field));
    next();
  });

  schema.pre("insertMany", function (next, docs) {
    for (const doc of Array.isArray(docs) ? docs : [docs]) {
      if (doc && doc[field] !== undefined) doc.searchWords = searchWordsOf(doc[field]);
    }
    next();
  });

  function syncUpdate(next) {
    const update = this.getUpdate();
    if (!update || Array.isArray(update)) return next();
    const value = update.$set?.[field] ?? update[field];
    if (value !== undefined) {
      update.$set = { ...(update.$set || {}), searchWords: searchWordsOf(value) };
      this.setUpdate(update);
    }
    next();
  }
  for (const hook of ["findOneAndUpdate", "updateOne", "updateMany"]) schema.pre(hook, syncUpdate);
};

/**
 * The ids of documents matching any of `conditions`, each condition run as its
 * own query. As one `$or` under the store's tenantId, the planner fell back to
 * the plain tenantId index and read every product (5 s); alone, each condition
 * uses its own { tenantId, field } index. In the order given, each once.
 */
const idsMatchingAny = async (Model, conditions, limit) => {
  const found = await Promise.all(
    conditions.map((condition) => Model.find(condition).select({ _id: 1 }).limit(limit).lean()),
  );
  const seen = new Set();
  const ids = [];
  for (const rows of found) {
    for (const { _id } of rows) {
      const key = String(_id);
      if (!seen.has(key) && ids.length < limit) {
        seen.add(key);
        ids.push(_id);
      }
    }
  }
  return ids;
};

module.exports = { searchWordsOf, nameSearchFilter, nameContainsFilter, searchWordsPlugin, idsMatchingAny, escapeRegex, MIN_TERM_LENGTH };
