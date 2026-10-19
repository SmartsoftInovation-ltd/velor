/**
 * Seed helpers: deterministic RNG, Zipf sampler, time-ordered ObjectIds,
 * a date model (2 years, growing volume, shop hours in Asia/Dhaka) and a
 * parallel batched writer on the native driver.
 *
 * No faker: it is a devDependency that is not installed in this checkout, and
 * the pools below are faster for millions of documents. Field shapes follow the
 * Phase 1 factories (tests/factories/index.js) and the app schemas in src/models.
 */
const { ObjectId } = require("mongodb");

// ── RNG ──────────────────────────────────────────────────────────────────────
// mulberry32: tiny, fast, seedable. Same seed -> same dataset.
const makeRng = (seed) => {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)), // inclusive
    float: (min, max) => min + next() * (max - min),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    // weighted pick from [[value, weight], ...]
    weighted: (pairs) => {
      const total = pairs.reduce((s, [, w]) => s + w, 0);
      let x = next() * total;
      for (const [v, w] of pairs) {
        if ((x -= w) < 0) return v;
      }
      return pairs[pairs.length - 1][0];
    },
    digits: (n) => {
      let s = "";
      for (let i = 0; i < n; i++) s += Math.floor(next() * 10);
      return s;
    },
    shuffle: (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
  };
  return r;
};

// ── Zipf ─────────────────────────────────────────────────────────────────────
// Rank k (0-based) has weight 1/(k+1)^s. Returns a sampler over 0..n-1 with an
// optional permutation so "rank 0" is not always the first-created item.
const makeZipf = (n, s, rng, { permute = true } = {}) => {
  if (n <= 0) throw new Error("zipf over empty set");
  const cdf = new Float64Array(n);
  let sum = 0;
  for (let k = 0; k < n; k++) {
    sum += 1 / Math.pow(k + 1, s);
    cdf[k] = sum;
  }
  for (let k = 0; k < n; k++) cdf[k] /= sum;
  let perm = null;
  if (permute) {
    perm = new Uint32Array(n);
    for (let i = 0; i < n; i++) perm[i] = i;
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      const t = perm[i];
      perm[i] = perm[j];
      perm[j] = t;
    }
  }
  const sample = () => {
    const x = rng.next();
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (cdf[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    return perm ? perm[lo] : lo;
  };
  // expected share of the item at index i (for derived counters like totalSales)
  const rankOf = perm ? (() => {
    const inv = new Uint32Array(n);
    for (let r = 0; r < n; r++) inv[perm[r]] = r;
    return (i) => inv[i];
  })() : (i) => i;
  const share = (i) => {
    const r = rankOf(i);
    return cdf[r] - (r ? cdf[r - 1] : 0);
  };
  return { sample, share, n };
};

// ── ObjectIds ordered by time ────────────────────────────────────────────────
// 4-byte timestamp (like a real insert) + 8-byte process-unique counter, so _id
// order matches createdAt order and _id-sorted pagination behaves as in prod.
let oidCounter = 0n;
const oidSalt = BigInt(Math.floor(Math.random() * 0xffff)) << 48n;
const oidAt = (date) => {
  const secs = Math.floor((date instanceof Date ? date.getTime() : date) / 1000);
  oidCounter += 1n;
  const tail = (oidSalt | oidCounter).toString(16).padStart(16, "0");
  return new ObjectId(secs.toString(16).padStart(8, "0") + tail);
};

// ── Dates ────────────────────────────────────────────────────────────────────
const DAY = 864e5;
const NOW = Date.UTC(2026, 9, 19, 12, 0, 0); // fixed "now" so reruns are identical
const SPAN_DAYS = 730;
const DHAKA_OFFSET_H = 6;

// Volume grows over time: density ∝ x on [0,1] (x=1 is now) -> x = sqrt(u).
// Monotonic variant for time-ordered generation: x = sqrt((i + jitter) / n).
const dayFraction = (u) => Math.sqrt(u);

// Shop hours 10:00–22:00 Dhaka, busier in the evening.
const HOUR_WEIGHTS = [[10, 4], [11, 6], [12, 8], [13, 7], [14, 6], [15, 6], [16, 7], [17, 9], [18, 11], [19, 12], [20, 11], [21, 8]];

const dateAt = (x, rng, spanDays = SPAN_DAYS) => {
  const daysBack = Math.floor((1 - x) * spanDays);
  const dayStartUtc = Math.floor((NOW - daysBack * DAY) / DAY) * DAY; // 00:00 UTC
  const hourDhaka = rng.weighted(HOUR_WEIGHTS);
  const t = dayStartUtc + (hourDhaka - DHAKA_OFFSET_H) * 36e5 + rng.int(0, 3599) * 1000;
  return new Date(Math.min(t, NOW));
};
const randomDate = (rng, spanDays = SPAN_DAYS) => dateAt(dayFraction(rng.next()), rng, spanDays);

// ── Text pools ───────────────────────────────────────────────────────────────
const FIRST = ["Rahim", "Karim", "Abdul", "Mohammad", "Hasan", "Hossain", "Rafiq", "Jamal", "Kamal", "Nasir", "Faruk", "Shakil", "Tanvir", "Imran", "Sabbir", "Arif", "Rakib", "Sohel", "Mizan", "Rasel", "Fatema", "Ayesha", "Nusrat", "Sharmin", "Farhana", "Taslima", "Rokeya", "Sumaiya", "Jannat", "Mim", "Sadia", "Nadia", "Rupa", "Shirin", "Lima", "Tania", "Moushumi", "Parvin", "Salma", "Ruma"];
const LAST = ["Islam", "Hossain", "Ahmed", "Rahman", "Khan", "Chowdhury", "Uddin", "Akter", "Begum", "Sarker", "Miah", "Haque", "Alam", "Talukder", "Sheikh", "Molla", "Bhuiyan", "Mahmud", "Sikder", "Kabir"];
const AREAS = ["Mirpur 10", "Dhanmondi 27", "Uttara Sector 7", "Gulshan 1", "Banani Road 11", "Mohammadpur", "Badda", "Rampura", "Motijheel", "Farmgate", "Bashundhara R/A", "Tejgaon", "Khilgaon", "Jatrabari", "Savar", "Narayanganj", "Gazipur Chowrasta", "Chattogram Agrabad", "Sylhet Zindabazar", "Khulna Sonadanga"];
const ADJ = ["Premium", "Classic", "Slim Fit", "Cotton", "Silk", "Handloom", "Printed", "Embroidered", "Casual", "Formal", "Organic", "Deluxe", "Eco", "Smart", "Ultra", "Soft", "Durable", "Light", "Royal", "Modern"];
const NOUN = ["Panjabi", "Saree", "Shirt", "T-Shirt", "Kurti", "Three Piece", "Jeans", "Trouser", "Polo", "Hoodie", "Jacket", "Sneaker", "Sandal", "Wallet", "Belt", "Bag", "Watch", "Perfume", "Lotion", "Shampoo", "Rice 5kg", "Lentil 1kg", "Soybean Oil 2L", "Tea 400g", "Biscuit", "Noodles", "Headphone", "Charger", "Power Bank", "Mug", "Bedsheet", "Towel", "Cap", "Scarf", "Hijab", "Lungi", "Gamcha", "Sweater", "Blazer", "Shorts"];
const COLORS = ["Black", "White", "Red", "Navy", "Sky Blue", "Maroon", "Olive", "Grey", "Beige", "Green", "Yellow", "Pink", "Purple", "Orange", "Brown"];
const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "38", "40", "42", "44", "Free"];
const LOREM = "Made from carefully selected material with fine stitching and a comfortable fit for daily use. Suitable for all seasons and easy to wash. Colour may vary slightly due to photography lighting. Ideal as a gift for family and friends during Eid and Puja festivals. Store in a cool dry place away from direct sunlight. Imported and quality checked before dispatch. Exchange available within seven days with the original invoice.".split(" ");

const sentence = (rng, minWords, maxWords) => {
  const n = rng.int(minWords, maxWords);
  const start = rng.int(0, LOREM.length - 1);
  const out = [];
  for (let i = 0; i < n; i++) out.push(LOREM[(start + i) % LOREM.length]);
  return out.join(" ");
};
const personName = (rng) => `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
const address = (rng) => `House ${rng.int(1, 250)}, Road ${rng.int(1, 40)}, ${rng.pick(AREAS)}`;
const bdMobile = (seq, prefixDigit) => `01${prefixDigit}${String(seq).padStart(8, "0")}`; // 01Xnnnnnnnn (11 digits)

const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const image = (rng, folder, uploaded = true) => {
  const id = `${folder}/${rng.digits(6)}${rng.digits(6)}`;
  return uploaded
    ? { url: `https://res.cloudinary.com/velor-perf/image/upload/v17${rng.digits(8)}/${id}.webp`, publicId: id, cloudName: "velor-perf", status: "uploaded", localPath: "", tries: 1, lastError: "" }
    : { url: "", publicId: "", cloudName: "", status: "pending", localPath: "", tries: 0, lastError: "" };
};
const emptyImage = () => ({ url: "", publicId: "", cloudName: "", status: "pending", localPath: "", tries: 0, lastError: "" });

// ── Parallel batched writer ──────────────────────────────────────────────────
class Writer {
  constructor(db, { batchSize = 5000, concurrency = 4, log = () => {} } = {}) {
    this.db = db;
    this.batchSize = batchSize;
    this.concurrency = concurrency;
    this.buffers = new Map();
    this.inflight = new Set();
    this.counts = {};
    this.log = log;
  }

  async add(coll, doc) {
    let buf = this.buffers.get(coll);
    if (!buf) this.buffers.set(coll, (buf = []));
    buf.push(doc);
    if (buf.length >= this.batchSize) await this.flush(coll);
  }

  async flush(coll) {
    const buf = this.buffers.get(coll);
    if (!buf || !buf.length) return;
    this.buffers.set(coll, []);
    while (this.inflight.size >= this.concurrency) await Promise.race(this.inflight);
    const p = this.db
      .collection(coll)
      .insertMany(buf, { ordered: false, writeConcern: { w: 1 } })
      .then((r) => {
        this.counts[coll] = (this.counts[coll] || 0) + r.insertedCount;
      })
      .finally(() => this.inflight.delete(p));
    this.inflight.add(p);
  }

  async drain() {
    for (const coll of this.buffers.keys()) await this.flush(coll);
    await Promise.all(this.inflight);
  }
}

module.exports = {
  makeRng,
  makeZipf,
  oidAt,
  NOW,
  DAY,
  SPAN_DAYS,
  dateAt,
  randomDate,
  dayFraction,
  personName,
  address,
  bdMobile,
  slugify,
  sentence,
  image,
  emptyImage,
  ADJ,
  NOUN,
  COLORS,
  SIZES,
  AREAS,
  Writer,
};
