const crypto = require("crypto");
const { cache } = require("../config/redis.config");
const { sendPlatformSms } = require("./platformSms.service");

// Second factor for the Platform Console. The password alone is not enough: a
// one-time code goes to the operator phone in .env, and only that code exchanges
// for a session. Codes live in Redis so they expire on their own and survive a
// restart no longer than their TTL.

const TTL_SECONDS = 5 * 60;
const MAX_ATTEMPTS = 5;
// A new code cannot be requested until the previous one is this old
const RESEND_AFTER_SECONDS = 60;

const key = (challengeId) => `platform:otp:${challengeId}`;

const operatorPhone = () => process.env.PLATFORM_ADMIN_PHONE?.trim() || null;

// Only a hash of the code is stored: Redis never holds a usable code
const hashCode = (challengeId, code) =>
  crypto.createHmac("sha256", process.env.PLATFORM_ACCESS_TOKEN_SECRET || "platform-otp").update(`${challengeId}:${code}`).digest("hex");

// Last 2 digits shown, so the operator can tell which SMS to read: 01******62
const maskPhone = (phone) => `${phone.slice(0, 2)}${"*".repeat(Math.max(0, phone.length - 4))}${phone.slice(-2)}`;

/**
 * Creates a challenge, texts the code to the operator phone and returns what the
 * client needs to show the code screen. Throws when the platform has no operator
 * phone or the SMS provider rejects the message.
 */
const startChallenge = async (user) => {
  const phone = operatorPhone();
  if (!phone) throw new Error("PLATFORM_ADMIN_PHONE is not configured");

  const challengeId = crypto.randomUUID();
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");

  await cache.set(
    key(challengeId),
    JSON.stringify({ sub: user._id.toString(), hash: hashCode(challengeId, code), attempts: 0, createdAt: Date.now() }),
    "EX",
    TTL_SECONDS,
  );

  try {
    await sendPlatformSms(phone, `Your Platform Console code is ${code}. It expires in 5 minutes. Do not share it with anyone.`);
  } catch (error) {
    await cache.del(key(challengeId));
    throw error;
  }

  return { challengeId, phone: maskPhone(phone), expiresInSeconds: TTL_SECONDS };
};

const VERIFY_FAILED = { ok: false };

/**
 * Checks a code against a challenge. A correct code is consumed, so it works
 * once. Too many wrong guesses burn the challenge and a new code is needed.
 *
 * @returns {Promise<{ ok: true, sub: string } | { ok: false }>}
 */
const verifyChallenge = async (challengeId, code) => {
  if (!challengeId || !/^\d{6}$/.test(String(code || ""))) return VERIFY_FAILED;

  const raw = await cache.get(key(challengeId));
  if (!raw) return VERIFY_FAILED;

  const challenge = JSON.parse(raw);
  const expected = Buffer.from(challenge.hash, "hex");
  const given = Buffer.from(hashCode(challengeId, code), "hex");

  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    const attempts = (challenge.attempts || 0) + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await cache.del(key(challengeId));
    } else {
      // Keep whatever life the challenge has left; a wrong guess does not extend it
      const ttl = await cache.ttl(key(challengeId));
      await cache.set(key(challengeId), JSON.stringify({ ...challenge, attempts }), "EX", Math.max(1, ttl));
    }
    return VERIFY_FAILED;
  }

  await cache.del(key(challengeId));
  return { ok: true, sub: challenge.sub };
};

/**
 * True when the challenge exists and is young enough that a resend would just be
 * spamming the operator's phone.
 */
const isTooSoonToResend = async (challengeId) => {
  const raw = challengeId && (await cache.get(key(challengeId)));
  if (!raw) return false;
  const { createdAt } = JSON.parse(raw);
  return Date.now() - createdAt < RESEND_AFTER_SECONDS * 1000;
};

const discardChallenge = (challengeId) => (challengeId ? cache.del(key(challengeId)) : Promise.resolve(0));

module.exports = {
  startChallenge,
  verifyChallenge,
  isTooSoonToResend,
  discardChallenge,
  operatorPhone,
  TTL_SECONDS,
  RESEND_AFTER_SECONDS,
};
