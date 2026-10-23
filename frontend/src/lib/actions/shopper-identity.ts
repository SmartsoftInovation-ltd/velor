import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/shopper-auth";

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
