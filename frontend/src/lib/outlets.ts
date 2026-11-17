import { apiFetch } from "@/lib/store-api";

/** One branch, as the dashboard's Outlet Information saves it */
export type Outlet = {
  _id: string;
  slug: string;
  name: string;
  address: string;
  managerName: string;
  managerMobile: string;
  email: string;
  businessHour: string;
  offDay: string;
  /** "" when the seller uploaded no photo */
  image: string;
};

/**
 * The store's active outlets (GET /shop/outlets), oldest first. An unreachable
 * API yields none, and the page says there are no outlets yet.
 */
export async function getOutlets(tenantHost: string): Promise<Outlet[]> {
  if (!tenantHost) return [];
  try {
    const data = await apiFetch<{ outlets: Outlet[] }>(tenantHost, "/shop/outlets");
    return data.outlets;
  } catch {
    return [];
  }
}
