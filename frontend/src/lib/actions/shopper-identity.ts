import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  expiredSignInHref,
  KEEP_COOKIE,
  REFRESH_COOKIE,
  refreshShopper,
  SESSION_COOKIE,
  type SessionTokens,
} from "@/lib/shopper-auth";
import { ApiError } from "@/lib/store-api";

/**
 * Who the API should treat this request as: the signed-in shopper (bearer
 * token from the session cookie) or the browser's guest id. Null when neither
 * is usable. Shared by the cart and checkout actions; not an action itself.
 */
export async function shopperIdentity(guestId: unknown): Promise<Record<string, string> | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) return { authorization: `Bearer ${token}` };
  if (typeof guestId === "string" && guestId && guestId.length <= 64) return { "x-guest-id": guestId };
  return null;
}

const DAY = 24 * 60 * 60;

/**
 * Stores the tokens in httpOnly cookies on the shop's domain. Without
 * "keep me signed in" they carry no expiry, so the browser drops them when it
 * closes. Must run inside an action.
 */
export async function storeSession(session: SessionTokens, remember: boolean) {
  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  const base = { httpOnly: true, sameSite: "lax", secure, path: "/" } as const;
  jar.set(SESSION_COOKIE, session.accessToken, remember ? { ...base, maxAge: DAY } : base);
  jar.set(REFRESH_COOKIE, session.refreshToken, remember ? { ...base, maxAge: 7 * DAY } : base);
  if (remember) jar.set(KEEP_COOKIE, "1", { ...base, maxAge: 7 * DAY });
  else jar.delete(KEEP_COOKIE);
}

/** Forgets the session on this shop's domain. Must run inside an action. */
export async function clearSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(REFRESH_COOKIE);
  jar.delete(KEEP_COOKIE);
}

/**
 * Makes one API call as this shopper. When a signed-in shopper's access token
 * has expired, the refresh token buys a new pair and the call runs once more.
 * When the store refuses that too, the session is dropped and the shopper is
 * sent to sign in, coming back to `returnPath` after (checkout by default);
 * their bag and checkout draft stay in the browser. Guests carry no session and never get here.
 * Must run inside an action.
 */
export async function callAsShopper<T>(
  host: string,
  who: Record<string, string>,
  call: (who: Record<string, string>) => Promise<T>,
  returnPath = "/checkout",
): Promise<T> {
  try {
    return await call(who);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || !who.authorization) throw error;
  }

  const jar = await cookies();
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  let renewed: SessionTokens | null = null;
  if (refreshToken) {
    try {
      renewed = await refreshShopper(host, refreshToken);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status >= 500) throw error;
    }
  }
  if (!renewed) {
    await clearSession();
    redirect(expiredSignInHref(returnPath));
  }

  await storeSession(renewed, jar.has(KEEP_COOKIE));
  return call({ authorization: `Bearer ${renewed.accessToken}` });
}
