import { apiFetch } from "@/lib/store-api";

/**
 * The return policy the store wrote in the dashboard (Website Settings →
 * Return Policy), as HTML the API has already cleaned down to plain
 * formatting tags. Empty when none is written or the API cannot be reached;
 * the page then shows the default policy.
 */
export async function getReturnPolicy(tenantHost: string): Promise<string> {
  if (!tenantHost) return "";
  try {
    const { content } = await apiFetch<{ content: string }>(tenantHost, "/shop/return-policy");
    return typeof content === "string" ? content.trim() : "";
  } catch {
    return "";
  }
}
