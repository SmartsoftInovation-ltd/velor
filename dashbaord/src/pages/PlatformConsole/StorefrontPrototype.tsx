import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  FiArrowRight,
  FiChevronLeft,
  FiChevronRight,
  FiExternalLink,
  FiEye,
  FiGrid,
  FiHeadphones,
  FiHeart,
  FiHome,
  FiImage,
  FiList,
  FiMail,
  FiMapPin,
  FiMoon,
  FiPackage,
  FiPhone,
  FiRotateCcw,
  FiSearch,
  FiShield,
  FiShoppingBag,
  FiShoppingCart,
  FiSliders,
  FiStar,
  FiTag,
  FiTruck,
  FiUser,
} from "react-icons/fi";
import { brandRamp } from "./brandRamp";
import { cardClass } from "./ui";

// What the storefront wears when a store has picked nothing
export const STOREFRONT_DEFAULT_COLOR = "#fc630a";

export const DEFAULT_DESIGN = {
  bannerLayout: "split",
  cardLayout: "buy",
  gridColumns: "4",
  categoryLayout: "image",
  galleryPosition: "left",
  thumbnailPosition: "side",
  filterLayout: "left",
  footerLayout: "full",
  buttonStyle: "solid",
  menuColor: "sunken",
  menuAlign: "left",
  announcementEnabled: "off",
  announcementText: "",
};
export type WebsiteDesign = typeof DEFAULT_DESIGN;

// Reads a seller's stored settings, filling what they never chose
export const designFrom = (general?: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(DEFAULT_DESIGN).map(([field, fallback]) => [field, String(general?.[field] ?? fallback)]),
  ) as WebsiteDesign;

export type StoreBanner = { title?: string; headLine?: string; description?: string; image?: string };
export type StoreCategory = { name: string; image: string };
export type StoreProduct = {
  rating?: number;
  slug: string;
  name: string;
  brand?: { name: string } | null;
  category?: { name: string } | null;
  image?: string;
  gallery?: string[];
  price: number;
  compareAtPrice?: number | null;
  stock: number;
  sizes?: string[];
  colors?: string[];
  variants?: unknown[];
  sold?: number;
  description?: string;
};
export type StoreContent = {
  live: boolean;
  name: string;
  logo: string;
  banners: StoreBanner[];
  promo: string;
  categories: StoreCategory[];
  products: StoreProduct[];
};

const sampleProduct = (name: string, price: number, stock = 12): StoreProduct => ({
  slug: name.toLowerCase().replace(/\s+/g, "-"),
  name,
  price,
  stock,
  brand: { name: "Your Brand" },
  category: { name: "Men" },
  sizes: ["S", "M", "L"],
});

export const SAMPLE_CONTENT: StoreContent = {
  live: false,
  name: "Your Store",
  logo: "",
  banners: [{ headLine: "New season", title: "Fresh styles for every day", description: "Fresh in this week: the pieces the season is being built around." }],
  promo: "",
  categories: ["Men", "Women", "Shoes", "Accessories"].map((name) => ({ name, image: "" })),
  products: [
    sampleProduct("Linen Shirt", 1490),
    sampleProduct("Denim Jacket", 3250, 3),
    sampleProduct("Cotton Polo", 990),
    sampleProduct("Chino Trousers", 1890),
    sampleProduct("Leather Belt", 750, 0),
    sampleProduct("Canvas Sneakers", 2290),
    sampleProduct("Wool Sweater", 2750),
    sampleProduct("Summer Dress", 1650),
    sampleProduct("Travel Backpack", 2990),
    sampleProduct("Sports Watch", 3890),
  ],
};

type Page = "home" | "shop" | "product";

const PAGES: { id: Page; label: string; path: string }[] = [
  { id: "home", label: "Home", path: "" },
  { id: "shop", label: "Shop", path: "/shop" },
  { id: "product", label: "Product", path: "/product" },
];

// The page where each choice can be seen, so trying one brings it into view
const PAGE_OF: Partial<Record<keyof WebsiteDesign, Page>> = {
  bannerLayout: "home",
  categoryLayout: "home",
  filterLayout: "shop",
  galleryPosition: "product",
  thumbnailPosition: "product",
};

const NAV = [
  { name: "Home", icon: FiHome, page: "home" as Page },
  { name: "Shop", icon: FiShoppingBag, page: "shop" as Page },
  { name: "New Arrivals", icon: FiStar },
  { name: "Offers", icon: FiTag },
  { name: "Track Order", icon: FiPackage },
  { name: "Contact", icon: FiHeadphones },
];

const TRUST = [
  { icon: FiTruck, title: "Fast Delivery", text: "Free on orders over ৳40" },
  { icon: FiHeadphones, title: "24/7 Support", text: "Dedicated live chat" },
  { icon: FiShield, title: "Pay Security", text: "100% secure payment" },
  { icon: FiRotateCcw, title: "Easy Return", text: "On orders over ৳150" },
];

const FOOTER_LINKS = [
  { title: "Quick links", links: ["Shop", "New Arrivals", "Best Sellers", "Discount Offer"] },
  { title: "Help", links: ["Track Order", "About", "Contact Us", "Outlets"] },
  { title: "Information", links: ["Shipping Info", "Return Policy", "FAQ"] },
];

// The website's own neutrals, so the page reads as the website and not the console
const SITE_THEME = {
  "--canvas": "#faf9f7",
  "--surface": "#ffffff",
  "--sunken": "#f5f3f0",
  "--inverse": "#1c1917",
  "--buy-now": "#ff6a0c",
  "--line": "#e8e5e0",
  "--line-strong": "#d6d2cb",
  "--ink": "#1c1917",
  "--ink-2": "#57534e",
  "--ink-3": "#78716a",
  fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif",
} as CSSProperties;

// The width the website is laid out for. It is drawn at this size and scaled
// to fit, so the proportions stay those of the real page at any panel width.
const SITE_WIDTH = 1280;

const taka = (value: number) => `৳${value.toLocaleString("en-BD")}`;

const Photo = ({ src, alt = "", className = "" }: { src?: string; alt?: string; className?: string }) =>
  src ? (
    <img src={src} alt={alt} className={`object-cover ${className}`} />
  ) : (
    <div className={`flex items-center justify-center bg-[var(--sunken)] text-[var(--line-strong)] ${className}`}>
      <FiImage className="size-12 stroke-1" aria-hidden="true" />
    </div>
  );

const Container = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`mx-auto w-full max-w-[1120px] px-6 ${className}`}>{children}</div>
);

const SiteButton = ({
  style,
  children,
  wide,
  disabled,
  large,
}: {
  style: string;
  children: ReactNode;
  wide?: boolean;
  disabled?: boolean;
  large?: boolean;
}) => (
  <span
    data-button={style}
    className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold ${large ? "h-12 px-6 text-[15px]" : "h-10 px-4 text-sm"} ${wide ? "w-full" : ""} ${disabled ? "opacity-45" : ""} ${
      style === "outline"
        ? "border border-[var(--brand)] text-[var(--brand-text)]"
        : `bg-[var(--brand)] text-[var(--on-brand)] ${style === "solid" ? "shadow-[0_2px_6px_rgb(0_0_0/0.22)]" : ""}`
    }`}
  >
    {children}
  </span>
);

const StockLine = ({ stock }: { stock: number }) => {
  const [dot, text, words] =
    stock <= 0
      ? ["bg-red-500", "text-red-600", "Out of stock"]
      : stock <= 5
        ? ["bg-amber-500", "text-amber-600", `Only ${stock} left`]
        : ["bg-emerald-500", "text-emerald-600", "In stock"];
  return (
    <p className={`flex items-center gap-1.5 text-xs font-medium ${text}`}>
      <span className={`size-1.5 rounded-full ${dot}`} />
      {words}
    </p>
  );
};

const Eyebrow = ({ icon: Icon, children }: { icon: typeof FiGrid; children: ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-50)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--brand-text)]">
    <Icon className="size-3" aria-hidden="true" />
    {children}
  </span>
);

const SectionHeading = ({ icon, eyebrow, title, text }: { icon: typeof FiGrid; eyebrow: string; title: string; text: string }) => (
  <div className="mb-6 flex items-end justify-between gap-4">
    <div>
      <Eyebrow icon={icon}>{eyebrow}</Eyebrow>
      <h2 className="mt-2.5 border-l-[3px] border-[var(--brand)] pl-2.5 text-[22px] font-bold leading-tight text-[var(--ink)]">{title}</h2>
      <p className="mt-1.5 pl-3.5 text-sm text-[var(--ink-3)]">{text}</p>
    </div>
    <span className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-[var(--line-strong)] bg-[var(--surface)] px-3.5 text-sm font-medium text-[var(--ink)]">
      View all <FiArrowRight className="size-3.5" aria-hidden="true" />
    </span>
  </div>
);

const SiteHeader = ({
  content,
  design,
  page,
  onNavigate,
}: {
  content: StoreContent;
  design: WebsiteDesign;
  page: Page;
  onNavigate: (page: Page) => void;
}) => {
  const onColor = design.menuColor === "brand" || design.menuColor === "inverse";
  const menuClass =
    {
      surface: "border-b border-[var(--line)] bg-[var(--surface)]",
      brand: "bg-[var(--brand)] text-[var(--on-brand)]",
      inverse: "bg-[var(--inverse)] text-white",
    }[design.menuColor] ?? "border-b border-[var(--line)] bg-[var(--sunken)]";
  const activeClass =
    design.menuColor === "brand"
      ? "bg-[var(--on-brand)] text-[var(--brand)]"
      : "bg-[var(--brand)] text-[var(--on-brand)]";
  const announcement = design.announcementEnabled === "on" && design.announcementText.trim();

  return (
    <header>
      {announcement && (
        <p data-testid="announcement" className="bg-[var(--brand)] px-4 py-2 text-center text-[13px] font-medium text-[var(--on-brand)]">
          {announcement}
        </p>
      )}
      <div className="bg-[var(--surface)]">
        <Container className="flex h-[66px] items-center gap-8">
          <span className="flex shrink-0 items-center gap-2">
            {content.logo ? (
              <img src={content.logo} alt="" className="size-10 object-contain" />
            ) : (
              <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--brand)] font-bold text-[var(--on-brand)]">
                {content.name.charAt(0)}
              </span>
            )}
            <span className="whitespace-nowrap text-lg font-bold text-[var(--ink)]">{content.name}</span>
          </span>
          <span className="flex h-12 flex-1 items-center justify-between rounded-lg border border-[var(--line-strong)] pl-4 pr-1.5 text-sm text-[var(--ink-3)]">
            Search for products, brands...
            <span className="flex size-9 items-center justify-center rounded-md bg-[var(--brand)] text-[var(--on-brand)]">
              <FiSearch className="size-4" aria-hidden="true" />
            </span>
          </span>
          <span className="flex h-12 shrink-0 items-center gap-3 rounded-lg border border-[var(--line)] px-3 text-[var(--ink)]">
            <FiHeart className="size-5" aria-hidden="true" />
            <span className="flex h-9 items-center gap-1.5 rounded-md bg-[var(--brand-50)] px-2 text-[13px] font-semibold">
              <FiShoppingCart className="size-4" aria-hidden="true" /> ৳0
            </span>
            <FiMoon className="size-4" aria-hidden="true" />
          </span>
          <SiteButton style={design.buttonStyle}>
            <FiUser className="size-4" aria-hidden="true" /> Log in
          </SiteButton>
        </Container>
      </div>
      <nav data-menu={design.menuColor} data-menu-align={design.menuAlign} className={menuClass}>
        <Container className={`flex h-[60px] items-center ${design.menuAlign === "center" ? "justify-center" : "justify-between"}`}>
          <div className="flex items-center gap-1">
            {NAV.map(({ name, icon: Icon, page: target }) => (
              <button
                key={name}
                type="button"
                onClick={() => target && onNavigate(target)}
                className={`flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-medium ${
                  target === page ? activeClass : onColor ? "" : "text-[var(--ink-2)]"
                }`}
              >
                <Icon className="size-4" aria-hidden="true" /> {name}
              </button>
            ))}
          </div>
          {design.menuAlign !== "center" && (
            <span className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-medium ${onColor ? "bg-white/15" : "bg-[var(--brand-50)] text-[var(--brand-text)]"}`}>
              <FiTruck className="size-4" aria-hidden="true" /> Free delivery on orders over ৳2,000
            </span>
          )}
        </Container>
      </nav>
    </header>
  );
};

const Hero = ({ banner, layout }: { banner: StoreBanner; layout: string }) => {
  const words = (
    <>
      {banner.headLine && (
        <p className="w-fit rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide">{banner.headLine}</p>
      )}
      <p className="mt-4 text-[38px] font-bold leading-[1.1]">{banner.title}</p>
      {banner.description && <p className="mt-3 max-w-md text-[15px] leading-relaxed opacity-85">{banner.description}</p>}
      <div className="mt-6">
        <span className="inline-flex h-12 items-center gap-2 rounded-lg bg-white px-5 text-[15px] font-semibold text-[var(--brand-text)] shadow-sm">
          Shop Now <FiArrowRight className="size-4" aria-hidden="true" />
        </span>
      </div>
    </>
  );
  const arrows = (
    <>
      <span className="absolute left-4 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[var(--ink)] shadow-md">
        <FiChevronLeft className="size-5" aria-hidden="true" />
      </span>
      <span className="absolute right-4 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[var(--ink)] shadow-md">
        <FiChevronRight className="size-5" aria-hidden="true" />
      </span>
    </>
  );

  if (layout === "full") {
    return (
      <div data-banner="full" className="relative h-[400px] overflow-hidden bg-[var(--inverse)] text-white">
        {banner.image && <img src={banner.image} alt="" className="absolute inset-0 size-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-r from-black/65 to-transparent" />
        <div className="relative flex h-full flex-col justify-center pl-24">{words}</div>
        {arrows}
      </div>
    );
  }

  const split = (
    <div className="relative flex h-[400px] overflow-hidden bg-[var(--brand)]">
      <div className="flex w-[54%] flex-col justify-center pl-24 pr-8 text-[var(--on-brand)]">{words}</div>
      <Photo src={banner.image} className="h-full flex-1" />
      {arrows}
    </div>
  );
  return layout === "boxed" ? (
    <Container className="pt-6">
      <div data-banner="boxed" className="overflow-hidden rounded-2xl">{split}</div>
    </Container>
  ) : (
    <div data-banner="split">{split}</div>
  );
};

const TrustBadges = () => (
  <div className="border-b border-[var(--line)] bg-[var(--surface)]">
    <Container className="grid grid-cols-4 py-6">
      {TRUST.map(({ icon: Icon, title, text }, i) => (
        <div key={title} className={`flex items-center gap-3 ${i ? "border-l border-[var(--line)] pl-5" : ""}`}>
          <span className="flex size-10 items-center justify-center rounded-full bg-[var(--brand-50)] text-[var(--brand-text)]">
            <Icon className="size-[18px]" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-[var(--ink)]">{title}</span>
            <span className="block text-[13px] text-[var(--ink-3)]">{text}</span>
          </span>
        </div>
      ))}
    </Container>
  </div>
);

const Categories = ({ categories, layout }: { categories: StoreCategory[]; layout: string }) => (
  <section data-category={layout}>
    <Container className="py-10">
      <SectionHeading icon={FiGrid} eyebrow="Categories" title="Shop by category" text="Find what you need, one category at a time." />
      {layout === "name" ? (
        <div className="flex flex-wrap gap-2.5">
          {categories.map(({ name }) => (
            <span key={name} className="rounded-full border border-[var(--line-strong)] bg-[var(--surface)] px-5 py-2.5 text-sm font-medium text-[var(--ink)]">
              {name}
            </span>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-6 gap-4">
          {categories.slice(0, 6).map(({ name, image }) =>
            layout === "card" ? (
              <div key={name} data-category-card className="rounded-2xl bg-[var(--surface)] p-4 text-center shadow-[0_1px_3px_rgb(0_0_0/0.08)]">
                <Photo src={image} alt={name} className="mx-auto aspect-square w-full max-w-32 rounded-full" />
                <p className="mt-3 truncate text-sm font-bold text-[var(--ink)]">{name}</p>
              </div>
            ) : layout === "round" ? (
              <div key={name} className="text-center">
                <Photo src={image} alt={name} className="aspect-square w-full rounded-full" />
                <p className="mt-2.5 text-sm font-semibold text-[var(--ink)]">{name}</p>
              </div>
            ) : (
              <div key={name} className="relative aspect-[3/4] overflow-hidden rounded-xl">
                <Photo src={image} alt={name} className="size-full" />
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/75 via-black/35 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-3.5">
                  <span className="text-sm font-semibold text-white">{name}</span>
                  <span className="flex size-8 items-center justify-center rounded-full bg-[var(--brand)] text-[var(--on-brand)]">
                    <FiArrowRight className="size-3.5" aria-hidden="true" />
                  </span>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </Container>
  </section>
);

const ProductCard = ({
  product,
  layout,
  button,
  onOpen,
}: {
  product: StoreProduct;
  layout: string;
  button: string;
  onOpen: () => void;
}) => {
  const soldOut = product.stock <= 0;
  const hasOptions = Boolean(product.variants?.length);
  const action = soldOut ? (
    <><FiShoppingCart className="size-4" aria-hidden="true" /> Sold out</>
  ) : hasOptions ? (
    <>Choose options <FiArrowRight className="size-4" aria-hidden="true" /></>
  ) : (
    <><FiShoppingCart className="size-4" aria-hidden="true" /> Add to cart</>
  );
  const price = (
    <span className="flex items-baseline gap-2">
      <span className="text-lg font-bold">{taka(product.price)}</span>
      {product.compareAtPrice && product.compareAtPrice > product.price ? (
        <span className="text-sm line-through opacity-60">{taka(product.compareAtPrice)}</span>
      ) : null}
    </span>
  );
  const soldOutTag = soldOut && (
    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md bg-[var(--inverse)] px-3 py-1.5 text-xs font-medium text-white">
      Sold out
    </span>
  );
  const wishlist = (
    <span className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[var(--ink)]">
      <FiHeart className="size-4" aria-hidden="true" />
    </span>
  );

  if (layout === "overlay") {
    return (
      <article data-card="overlay" onClick={onOpen} className="relative aspect-[3/4] cursor-pointer overflow-hidden rounded-lg bg-[var(--sunken)]">
        <Photo src={product.image} alt={product.name} className="size-full" />
        {wishlist}
        {soldOutTag}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/55 to-transparent p-4 pt-12 text-white">
          <h3 className="truncate text-base font-semibold">{product.name}</h3>
          <div className="mb-3 mt-1">{price}</div>
          <SiteButton style={button} wide disabled={soldOut}>{action}</SiteButton>
        </div>
      </article>
    );
  }

  const minimal = layout === "minimal";
  return (
    <article
      data-card={layout}
      onClick={onOpen}
      className={`flex cursor-pointer flex-col ${minimal ? "" : "overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_3px_rgb(0_0_0/0.05)]"}`}
    >
      <div className={`relative overflow-hidden ${minimal ? "aspect-square rounded-lg" : "aspect-[4/3]"}`}>
        <Photo src={product.image} alt={product.name} className="size-full" />
        {wishlist}
        {soldOutTag}
      </div>
      <div className={`flex flex-1 flex-col ${minimal ? "gap-2.5 pt-3" : "gap-3.5 p-4"}`}>
        <div>
          {!minimal && layout !== "buy" && (
            <p className="truncate text-[11px] font-medium uppercase tracking-wide text-[var(--ink-3)]">{product.brand?.name}</p>
          )}
          <h3 className={`mt-1 truncate text-base text-[var(--ink)] ${layout === "buy" ? "font-bold" : "font-semibold"}`}>{product.name}</h3>
        </div>
        <div className="text-[var(--ink)]">{price}</div>
        <div className="mt-auto space-y-3">
          {layout === "buy" ? (
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              {product.rating ? (
                <span className="flex items-center gap-1 text-xs text-[var(--ink-2)]">
                  <FiStar className="size-3.5 fill-amber-400 text-amber-400" aria-hidden="true" /> {product.rating}
                </span>
              ) : null}
              <span className="ml-auto"><StockLine stock={product.stock} /></span>
            </div>
          ) : (
            !minimal && <StockLine stock={product.stock} />
          )}
          <div className="flex gap-2">
            {layout === "buy" ? (
              <div data-buy-row className="@container flex min-w-0 flex-1 gap-2">
                <span className={`inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--inverse)] px-2.5 text-[13px] font-semibold text-white shadow-md @max-[13rem]:w-10 @max-[13rem]:flex-none @max-[13rem]:px-0 ${soldOut ? "opacity-45" : ""}`}>
                  {(soldOut || !hasOptions) && <FiShoppingCart className="size-4 shrink-0" aria-hidden="true" />}
                  <span className="@max-[13rem]:hidden">{soldOut ? "Sold out" : hasOptions ? "Choose options" : "Add to cart"}</span>
                  {!soldOut && hasOptions && <FiArrowRight className="size-4 shrink-0 @min-[13rem]:hidden" aria-hidden="true" />}
                </span>
                <span className={`inline-flex h-10 min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-full bg-[var(--buy-now)] px-2.5 text-[13px] font-semibold text-white shadow-md ${soldOut ? "opacity-45" : ""}`}>
                  Buy Now
                </span>
              </div>
            ) : (
              <div className="min-w-0 flex-1">
                <SiteButton style={button} wide disabled={soldOut}>{action}</SiteButton>
              </div>
            )}
            {!minimal && layout !== "buy" && (
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--line-strong)] text-[var(--ink)]">
                <FiEye className="size-4" aria-hidden="true" />
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};

const GRID_CLASS: Record<string, string> = { "3": "grid-cols-3", "4": "grid-cols-4", "5": "grid-cols-5" };

const ProductGrid = ({
  products,
  design,
  columns,
  rows = 2,
  onOpen,
}: {
  products: StoreProduct[];
  design: WebsiteDesign;
  columns: string;
  rows?: number;
  onOpen: (product: StoreProduct) => void;
}) => (
  <div data-testid="product-grid" data-grid={columns} className={`grid gap-5 ${GRID_CLASS[columns] ?? "grid-cols-4"}`}>
    {products.slice(0, Number(columns) * rows).map((product) => (
      <ProductCard key={product.slug} product={product} layout={design.cardLayout} button={design.buttonStyle} onOpen={() => onOpen(product)} />
    ))}
  </div>
);

const HomePage = ({ content, design, onOpen }: { content: StoreContent; design: WebsiteDesign; onOpen: (product: StoreProduct) => void }) => (
  <>
    <Hero banner={content.banners[0]} layout={design.bannerLayout} />
    <TrustBadges />
    <Categories categories={content.categories} layout={design.categoryLayout} />
    {content.promo && (
      <Container className="pb-10">
        <img src={content.promo} alt="" className="h-72 w-full rounded-xl object-cover" />
      </Container>
    )}
    <section className="bg-[var(--sunken)]">
      <Container className="py-10">
        <SectionHeading icon={FiStar} eyebrow="Just in" title="New arrivals" text="The latest pieces, fresh this week." />
        <ProductGrid products={content.products} design={design} columns={design.gridColumns} onOpen={onOpen} />
      </Container>
    </section>
  </>
);

const FilterPanel = ({ categories, brand, count }: { categories: StoreCategory[]; brand?: string; count: number }) => (
  <aside data-testid="filter-panel" className="w-60 shrink-0 self-start rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 text-sm text-[var(--ink-2)]">
    <p className="flex items-center gap-2 border-b border-[var(--line)] pb-4 font-semibold text-[var(--ink)]">
      <FiSliders className="size-4" aria-hidden="true" /> Filters
    </p>
    <p className="mb-2 mt-4 font-semibold text-[var(--ink)]">Category</p>
    <p className="flex items-center justify-between rounded-md bg-[var(--brand-50)] px-2.5 py-2 font-medium text-[var(--brand-text)]">
      All products <span>{count}</span>
    </p>
    {categories.map(({ name }) => (
      <p key={name} className="flex items-center gap-2.5 px-2.5 py-2">
        <span className="size-4 rounded-full border border-[var(--line-strong)]" />
        {name}
      </p>
    ))}
    <p className="mb-2 mt-4 border-t border-[var(--line)] pt-4 font-semibold text-[var(--ink)]">Brand</p>
    <p className="flex items-center gap-2.5 px-2.5 py-2">
      <span className="size-4 rounded border border-[var(--line-strong)]" />
      {brand ?? "All brands"}
    </p>
    <p className="mb-2 mt-4 border-t border-[var(--line)] pt-4 font-semibold text-[var(--ink)]">Price</p>
    {["Under ৳1,000", "৳1,000 – ৳2,000", "৳2,000 – ৳4,000"].map((range) => (
      <p key={range} className="flex items-center gap-2.5 px-2.5 py-2">
        <span className="size-4 rounded-full border border-[var(--line-strong)]" />
        {range}
      </p>
    ))}
  </aside>
);

const Crumbs = ({ trail }: { trail: string[] }) => (
  <p className="mb-6 flex items-center gap-2 text-[13px] text-[var(--ink-3)]">
    <FiHome className="size-3.5" aria-hidden="true" />
    {trail.map((part, i) => (
      <span key={part} className={i === trail.length - 1 ? "font-semibold text-[var(--ink)]" : ""}>
        {i > 0 && <span className="mr-2 font-normal text-[var(--ink-3)]">/</span>}
        {part}
      </span>
    ))}
  </p>
);

const ShopPage = ({ content, design, onOpen }: { content: StoreContent; design: WebsiteDesign; onOpen: (product: StoreProduct) => void }) => {
  const layout = design.filterLayout;
  const popup = layout === "popup";
  // The filter column takes room from the products
  const columns = popup ? design.gridColumns : String(Math.max(3, Number(design.gridColumns) - 1));
  const shown = Math.min(content.products.length, Number(columns) * 2);
  return (
    <section data-filter={layout}>
      <Container className="py-6">
        <Crumbs trail={["Home", "Shop"]} />
        <div className={`flex gap-6 ${layout === "right" ? "flex-row-reverse" : ""}`}>
          {!popup && <FilterPanel categories={content.categories} brand={content.products[0]?.brand?.name} count={content.products.length} />}
          <div className="min-w-0 flex-1">
            <div className="mb-5 flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm">
              <span className="flex items-center gap-2">
                {popup && (
                  <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--line-strong)] px-3.5 font-medium text-[var(--ink)]">
                    <FiSliders className="size-4" aria-hidden="true" /> Filters
                  </span>
                )}
                <span className="inline-flex h-10 items-center rounded-lg border border-[var(--line-strong)] px-3.5 text-[var(--ink-3)]">
                  Sort by <b className="ml-1 font-semibold text-[var(--ink)]">Default sorting</b>
                </span>
              </span>
              <span className="flex items-center gap-2 text-[var(--ink-3)]">
                Showing 1–{shown} of {content.products.length}
                <span className="flex size-9 items-center justify-center rounded-md bg-[var(--brand)] text-[var(--on-brand)]">
                  <FiGrid className="size-4" aria-hidden="true" />
                </span>
                <span className="flex size-9 items-center justify-center rounded-md border border-[var(--line-strong)]">
                  <FiList className="size-4" aria-hidden="true" />
                </span>
              </span>
            </div>
            <ProductGrid products={content.products} design={design} columns={columns} onOpen={onOpen} />
          </div>
        </div>
      </Container>
    </section>
  );
};

const ProductPage = ({ product, design }: { product?: StoreProduct; design: WebsiteDesign }) => {
  if (!product) return null;
  const photos = [product.image, ...(product.gallery ?? [])].filter(Boolean) as string[];
  const bottom = design.thumbnailPosition === "bottom";
  const thumbs = (photos.length ? photos.slice(0, 4) : ["", "", "", ""]).map((src, i) => (
    <Photo key={`${src}${i}`} src={src} className="size-20 shrink-0 rounded-lg border border-[var(--line)]" />
  ));
  return (
    <section>
      <Container className="py-6">
        <Crumbs trail={["Home", product.category?.name ?? "Shop", product.name]} />
        <div data-gallery={design.galleryPosition} className={`flex gap-10 ${design.galleryPosition === "right" ? "flex-row-reverse" : ""}`}>
          <div data-thumbs={design.thumbnailPosition} className={`flex w-[54%] gap-3 ${bottom ? "flex-col-reverse" : ""}`}>
            <div className={`flex gap-3 ${bottom ? "" : "flex-col"}`}>{thumbs}</div>
            <Photo src={photos[0]} alt={product.name} className="aspect-square min-w-0 flex-1 rounded-xl" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-3)]">{product.brand?.name}</p>
            <h1 className="mt-2 text-[30px] font-bold leading-tight text-[var(--ink)]">{product.name}</h1>
            <p className="mt-4 text-[26px] font-bold text-[var(--ink)]">{taka(product.price)}</p>
            <div className="mt-3"><StockLine stock={product.stock} /></div>
            {product.description && <p className="mt-4 line-clamp-3 text-[15px] leading-relaxed text-[var(--ink-2)]">{product.description}</p>}
            {Boolean(product.colors?.length) && (
              <>
                <p className="mb-2 mt-6 text-sm font-semibold text-[var(--ink)]">Color</p>
                <div className="flex flex-wrap gap-2">
                  {product.colors?.map((color) => (
                    <span key={color} className="rounded-lg border border-[var(--line-strong)] px-3.5 py-2 text-sm text-[var(--ink)]">{color}</span>
                  ))}
                </div>
              </>
            )}
            {Boolean(product.sizes?.length) && (
              <>
                <p className="mb-2 mt-6 text-sm font-semibold text-[var(--ink)]">Size</p>
                <div className="flex flex-wrap gap-2">
                  {product.sizes?.map((size) => (
                    <span key={size} className="flex h-10 min-w-10 items-center justify-center rounded-lg border border-[var(--line-strong)] px-3 text-sm text-[var(--ink)]">{size}</span>
                  ))}
                </div>
              </>
            )}
            <div className="mt-8 flex gap-3">
              <div className="flex-1">
                <SiteButton style={design.buttonStyle} wide large disabled={product.stock <= 0}>
                  <FiShoppingCart className="size-4" aria-hidden="true" />
                  {product.stock <= 0 ? "Sold out" : "Add to cart"}
                </SiteButton>
              </div>
              <span className="flex size-12 items-center justify-center rounded-lg border border-[var(--line-strong)] text-[var(--ink)]">
                <FiHeart className="size-5" aria-hidden="true" />
              </span>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
};

const SiteFooter = ({ layout, content, button }: { layout: string; content: StoreContent; button: string }) => (
  <footer data-footer={layout} className="border-t border-[var(--line)] bg-[var(--surface)]">
    {layout !== "compact" && (
      <Container>
        <div className="flex items-center justify-between gap-6 border-b border-[var(--line)] py-8">
          <div>
            <p className="text-lg font-bold text-[var(--ink)]">Get the drop before it sells out</p>
            <p className="mt-1 text-sm text-[var(--ink-2)]">New arrivals, restocks and member-only offers. One email a week, no noise.</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <span className="flex h-10 w-64 items-center rounded-lg border border-[var(--line-strong)] px-3 text-sm text-[var(--ink-3)]">you@example.com</span>
            <SiteButton style={button}>Subscribe <FiArrowRight className="size-4" aria-hidden="true" /></SiteButton>
          </div>
        </div>
        <div className="grid grid-cols-[1.4fr_repeat(3,1fr)_1.2fr] gap-8 py-10 text-sm text-[var(--ink-2)]">
          <div>
            <p className="font-bold text-[var(--ink)]">{content.name}</p>
            <p className="mt-3 leading-relaxed">Quality without the markup: everyday staples, seasonal edits and limited drops, delivered across Bangladesh.</p>
          </div>
          {FOOTER_LINKS.map(({ title, links }) => (
            <div key={title}>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">{title}</p>
              {links.map((link) => <p key={link} className="py-1.5">{link}</p>)}
            </div>
          ))}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">Get in touch</p>
            <p className="flex items-center gap-2 py-1.5"><FiPhone className="size-3.5 shrink-0" aria-hidden="true" /> Store phone</p>
            <p className="flex items-center gap-2 py-1.5"><FiMail className="size-3.5 shrink-0" aria-hidden="true" /> Store email</p>
            <p className="flex items-center gap-2 py-1.5"><FiMapPin className="size-3.5 shrink-0" aria-hidden="true" /> Store address</p>
          </div>
        </div>
      </Container>
    )}
    <Container>
      <div className={`flex items-center justify-between py-5 text-[13px] text-[var(--ink-3)] ${layout === "compact" ? "" : "border-t border-[var(--line)]"}`}>
        <span>We accept</span>
        <span className="font-medium text-[var(--ink-2)]">Visa · Mastercard · bKash · Nagad · Rocket</span>
      </div>
    </Container>
    <div className="border-t border-[var(--line)] bg-[var(--sunken)]">
      <Container className="flex items-center justify-between py-4 text-[13px] text-[var(--ink-3)]">
        <span>© {new Date().getFullYear()} {content.name}. All rights reserved.</span>
        <span className="flex gap-4"><span>Privacy</span><span>Terms</span></span>
      </Container>
    </div>
  </footer>
);

/**
 * The seller's website drawn here, in its own colors and layout, with the
 * seller's real logo, banners, categories and products when `content` carries
 * them. Every color and layout shows the moment it is picked; shoppers see it
 * only once it is saved.
 */
const StorefrontPrototype = ({
  url,
  color,
  design,
  content = SAMPLE_CONTENT,
}: {
  url: string;
  color: string;
  design: WebsiteDesign;
  content?: StoreContent;
}) => {
  const [page, setPage] = useState<Page>("home");
  const [opened, setOpened] = useState<StoreProduct | null>(null);
  const ramp = useMemo(() => brandRamp(color), [color]);

  // Trying a layout that lives on another page goes to that page
  const previous = useRef(design);
  useEffect(() => {
    const changed = (Object.keys(PAGE_OF) as (keyof WebsiteDesign)[]).find(
      (field) => design[field] !== previous.current[field],
    );
    previous.current = design;
    const target = changed && PAGE_OF[changed];
    if (target) setPage(target);
  }, [design]);

  // Scale the full-width page down to the panel it sits in
  const viewport = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const element = viewport.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) =>
      // Whole steps of a percent, so a sub-pixel change cannot keep it moving
      setZoom(Math.max(0.1, Math.floor((entry.contentRect.width / SITE_WIDTH) * 100) / 100)),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // A new page starts at its top, as it would on the website
  useEffect(() => {
    viewport.current?.scrollTo?.({ top: 0 });
  }, [page, opened]);

  const openProduct = (product: StoreProduct) => {
    setOpened(product);
    setPage("product");
  };
  const product =
    opened ??
    content.products.find((p) => p.image && p.stock > 0) ??
    content.products.find((p) => p.stock > 0) ??
    content.products[0];
  const site = {
    ...SITE_THEME,
    "--brand": color,
    "--brand-50": ramp.light[50],
    "--brand-text": ramp.textLight,
    "--on-brand": ramp.onBrand,
    width: SITE_WIDTH,
    zoom,
  } as CSSProperties;
  const path = PAGES.find(({ id }) => id === page)?.path ?? "";
  const address = `${url ? new URL(url).host : "your-store.com"}${page === "product" && product ? `/product/${product.slug}` : path}`;

  return (
    <section className={`${cardClass} min-w-0 overflow-hidden`}>
      <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-gray-300 dark:bg-gray-600" />
          <span className="size-2.5 rounded-full bg-gray-300 dark:bg-gray-600" />
          <span className="size-2.5 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>
        <p className="min-w-0 flex-1 truncate rounded-lg bg-gray-100 px-3 py-1.5 font-mono text-xs text-gray-500 dark:bg-white/5 dark:text-gray-400">
          {address}
        </p>
        <div role="tablist" aria-label="Preview page" className="flex shrink-0 gap-1">
          {PAGES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={page === id}
              onClick={() => setPage(id)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                page === id
                  ? "bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-400"
                  : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {!content.live && <span className="shrink-0 text-xs text-gray-400">Sample content</span>}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            title="Open the real website in a new tab"
            aria-label={`Open ${new URL(url).host} in a new tab`}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/5"
          >
            <FiExternalLink className="size-4" aria-hidden="true" />
          </a>
        )}
      </div>

      {/* The gutter is always reserved: a scrollbar coming and going would change the
          width, and so the zoom, and so whether the scrollbar is needed */}
      <div ref={viewport} className="h-[calc(100vh-10rem)] min-h-[640px] overflow-y-auto overflow-x-hidden bg-[#faf9f7] [scrollbar-gutter:stable]">
        <div data-testid="storefront" style={site} className="bg-[var(--canvas)] text-[var(--ink)]">
          <SiteHeader content={content} design={design} page={page} onNavigate={setPage} />
          {page === "home" && <HomePage content={content} design={design} onOpen={openProduct} />}
          {page === "shop" && <ShopPage content={content} design={design} onOpen={openProduct} />}
          {page === "product" && <ProductPage product={product} design={design} />}
          <SiteFooter layout={design.footerLayout} content={content} button={design.buttonStyle} />
        </div>
      </div>
    </section>
  );
};

export default StorefrontPrototype;
