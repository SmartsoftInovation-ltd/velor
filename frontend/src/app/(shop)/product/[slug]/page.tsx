import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/home/product-card";
import { ProductGallery } from "@/components/product/product-gallery";
import {
  DescriptionPanel,
  ReviewsPanel,
  SpecificationPanel,
} from "@/components/product/product-panels";
import { ProductSummary } from "@/components/product/product-summary";
import { ProductTabs } from "@/components/product/product-tabs";
import { Breadcrumb } from "@/components/shop/breadcrumb";
import {
  getProduct,
  getRelatedProducts,
  getReviews,
} from "@/lib/catalog/product-detail";
import { storeHostFrom } from "@/lib/store-api";

// Rendered per request for the store on this domain: no generateStaticParams,
// since a page built once at deploy time would carry one store's product.
const productFor = async (slug: string) => getProduct(storeHostFrom(await headers()), slug);

export async function generateMetadata({
  params,
}: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await productFor(slug);
  if (!product) return { title: "Product not found" };

  return { title: product.name, description: product.description };
}

export default async function ProductPage({ params, searchParams }: PageProps<"/product/[slug]">) {
  const { slug } = await params;
  // ?variant=<id> from a featured variant's card opens on that option
  const { variant } = await searchParams;
  const product = await productFor(slug);
  if (!product) notFound();

  const [reviews, related] = await Promise.all([
    getReviews(),
    getRelatedProducts(storeHostFrom(await headers()), product),
  ]);

  const category = product.categoryId
    ? { id: product.categoryId, name: product.categoryName }
    : undefined;
  const { compareAtPrice, price } = product;
  const discountPct =
    compareAtPrice && compareAtPrice > price
      ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
      : null;

  return (
    <main className="container py-6">
      <div className="mb-6">
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Shop", href: "/shop" },
            ...(category
              ? [{ label: category.name, href: `/shop?category=${category.id}` }]
              : []),
            { label: product.name },
          ]}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[auto_1fr] lg:gap-12">
        <ProductGallery images={product.gallery} discountPct={discountPct} />
        <ProductSummary product={product} initialVariantId={typeof variant === "string" ? variant : undefined} />
      </div>

      <div className="mt-12">
        <ProductTabs
          tabs={[
            {
              id: "description",
              label: "Description",
              panel: <DescriptionPanel product={product} />,
            },
            {
              id: "specification",
              label: "Specification",
              panel: <SpecificationPanel product={product} />,
            },
            {
              id: "reviews",
              label: `Reviews (${reviews.length})`,
              panel: (
                <ReviewsPanel
                  reviews={reviews}
                  rating={product.rating}
                  count={product.reviews}
                />
              ),
            },
          ]}
        />
      </div>

      {related.length ? (
        <section className="mt-14">
          <h2 className="mb-6 text-h2 font-semibold tracking-tight text-text-primary">
            You may also like
          </h2>
          <ul className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4 lg:gap-6">
            {related.map((item) => (
              <li key={item.id}>
                <ProductCard product={item} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
