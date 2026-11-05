import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { tenantsApi } from "../../platform/endpoints";
import { SAMPLE_CONTENT, type StoreBanner, type StoreCategory, type StoreContent, type StoreProduct } from "./StorefrontPrototype";

// What the seller's website itself shows, read from the same public shop routes.
// A store with nothing there yet, or an API that cannot be reached, keeps the sample.
const fetchContent = async (slug: string): Promise<StoreContent> => {
  const get = async <T,>(path: string, fallback: T): Promise<T> => {
    try {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}${path}`, { headers: { "x-tenant": slug } });
      return (data?.data ?? fallback) as T;
    } catch {
      return fallback;
    }
  };

  const [store, banners, promo, categories, products] = await Promise.all([
    get<{ name?: string; logo?: string }>("/shop/store", {}),
    get<{ banners?: StoreBanner[] }>("/shop/banners", {}),
    get<{ banner?: StoreBanner | null }>("/shop/promo-banner", {}),
    get<{ categories?: { _id: string; name: string; image?: { url?: string } }[] }>("/categories-active", {}),
    get<{ products?: StoreProduct[] }>("/shop/products", {}),
  ]);

  const shopCategories: StoreCategory[] | undefined = categories.categories?.map(({ name, image }) => ({
    name,
    image: image?.url ?? "",
  }));

  return {
    live: Boolean(store.name),
    name: store.name || SAMPLE_CONTENT.name,
    logo: store.logo ?? "",
    banners: banners.banners?.length ? banners.banners : SAMPLE_CONTENT.banners,
    promo: promo.banner?.image ?? "",
    categories: shopCategories?.length ? shopCategories : SAMPLE_CONTENT.categories,
    products: products.products?.length ? products.products : SAMPLE_CONTENT.products,
  };
};

export const useStorefrontContent = (tenantId: string): StoreContent => {
  const tenant = useQuery({
    queryKey: ["platform", "tenant-slug", tenantId],
    queryFn: () => tenantsApi.get(tenantId),
  });
  const slug = tenant.data?.slug;
  const content = useQuery({
    queryKey: ["platform", "storefront-content", slug],
    queryFn: () => fetchContent(slug as string),
    enabled: Boolean(slug),
    staleTime: 5 * 60 * 1000,
  });
  return content.data ?? SAMPLE_CONTENT;
};
