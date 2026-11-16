import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/home/product-card";
import { SectionHeading } from "@/components/home/section-heading";
import { SparkleIcon } from "@/components/ui/icons-nav";
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
import { JsonLd } from "@/components/ui/json-ld";
import { breadcrumbJsonLd, productJsonLd, shareDescription } from "@/lib/catalog/product-share";
import { shareImage } from "@/lib/share-image";
import { getStore, requestOrigin, storeHostFrom } from "@/lib/store-api";

// Rendered per request for the store on this domain: no generateStaticParams,
// since a page built once at deploy time would carry one store's product.
const productFor = async (slug: string) => getProduct(storeHostFrom(await headers()), slug);

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { variant } = await searchParams;
  const product = await productFor(slug);
  if (!product) return { title: "Product not found" };

  const store = await getStore(storeHostFrom(await headers()));
  const description = shareDescription(product, store?.name || "our shop");
  // A link to one option shows that option's photo; a product with no photo shows the store's logo
  const photo = product.variants.find((option) => option.id === variant)?.image || product.gallery[0]?.src;
  const image = shareImage(photo, product.name) ?? shareImage(store?.logo, product.name);
  const images = image ? [image] : undefined;
  const url = `/product/${product.id}`;

  return {
    title: product.name,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", siteName: store?.name, url, title: product.name, description, images },
    twitter: { card: image ? "summary_large_image" : "summary", title: product.name, description, images },
  };
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

  const origin = requestOrigin(await headers()) ?? "";

  return (
    <main className="container py-6">
      <JsonLd data={productJsonLd(product, origin)} />
      <JsonLd data={breadcrumbJsonLd(product, origin)} />

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

      <div className="grid gap-8 lg:grid-cols-[auto_1fr] lg:gap-12 gallery-right:lg:grid-cols-[1fr_auto]">
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
          <SectionHeading
            eyebrow="Handpicked for you"
            icon={<SparkleIcon />}
            title="Related Products"
            description={category ? `More from ${category.name} you might love.` : "More picks you might love."}
            viewAllHref={category ? `/shop?category=${category.id}` : "/shop"}
          />
          <ul className="product-grid grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4 lg:gap-6">
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
