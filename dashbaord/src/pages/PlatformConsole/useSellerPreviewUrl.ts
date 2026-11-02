import { useQuery } from "@tanstack/react-query";
import { domainsApi } from "../../platform/endpoints";

// Where the seller's website can be framed: their primary live domain, "" if none
export const useSellerPreviewUrl = (tenantId: string): string => {
  const domains = useQuery({
    queryKey: ["platform", "domains", tenantId],
    queryFn: () => domainsApi.list(tenantId),
  });
  const active = domains.data?.filter((domain) => domain.status === "active") ?? [];
  const host = (active.find((domain) => domain.isPrimary) ?? active[0])?.host;
  return import.meta.env.VITE_STOREFRONT_PREVIEW_URL || (host ? `https://${host}` : "");
};
