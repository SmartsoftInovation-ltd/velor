import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import StorefrontPrototype, { DEFAULT_DESIGN, designFrom, type StoreContent, type WebsiteDesign } from "./StorefrontPrototype";
import { ColorStudio } from "./SellerColorTab";
import { DesignStudio } from "./SellerDesignTab";

vi.mock("../../platform/endpoints", () => ({ settingsApi: {}, domainsApi: {} }));
vi.mock("../../platform/api", () => ({ errorMessage: () => "" }));
vi.mock("../../platform/PlatformAuthContext", () => ({ usePlatformAuth: () => ({ isSuperadmin: true }) }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const URL_ = "https://shop.example.com";
const show = (design: Partial<WebsiteDesign> = {}, color = "#2563eb") =>
  render(<StorefrontPrototype url={URL_} color={color} design={{ ...DEFAULT_DESIGN, ...design }} />);
const openPage = (name: string) => fireEvent.click(screen.getByRole("tab", { name }));
const part = (selector: string) => screen.getByTestId("storefront").querySelector(selector);
const brandOf = () => screen.getByTestId("storefront").style.getPropertyValue("--brand");

describe("StorefrontPrototype", () => {
  it("wears the color it is given, and uses no iframe", () => {
    const { container, rerender } = show();
    expect(brandOf()).toBe("#2563eb");
    expect(container.querySelector("iframe")).toBeNull();

    rerender(<StorefrontPrototype url={URL_} color="#dc2626" design={DEFAULT_DESIGN} />);
    expect(brandOf()).toBe("#dc2626");
  });

  it("links to the seller's real website when it has one", () => {
    show();
    expect(screen.getByRole("link", { name: /shop\.example\.com/ })).toHaveAttribute("href", URL_);
    expect(screen.getByText("shop.example.com")).toBeTruthy();
  });

  it.each(["split", "full", "boxed"])("draws the %s banner", (bannerLayout) => {
    show({ bannerLayout });
    expect(part(`[data-banner="${bannerLayout}"]`)).toBeTruthy();
  });

  it.each(["standard", "minimal", "overlay"])("draws %s product cards", (cardLayout) => {
    show({ cardLayout });
    expect(part(`[data-card="${cardLayout}"]`)).toBeTruthy();
  });

  it.each([["3", 6], ["4", 8], ["5", 10]])("shows %s products per row", (gridColumns, count) => {
    show({ gridColumns: String(gridColumns) });
    const grid = screen.getByTestId("product-grid");
    expect(grid).toHaveAttribute("data-grid", String(gridColumns));
    expect(grid.children).toHaveLength(Number(count));
  });

  it.each(["image", "round", "name"])("draws %s categories", (categoryLayout) => {
    show({ categoryLayout });
    expect(part(`[data-category="${categoryLayout}"]`)).toBeTruthy();
  });

  it("moves or hides the shop filters", () => {
    show({ filterLayout: "right" });
    openPage("Shop");
    expect(screen.getByTestId("filter-panel").parentElement?.className).toContain("flex-row-reverse");
  });

  it("replaces the filter column with a button in the popup layout", () => {
    show({ filterLayout: "popup" });
    openPage("Shop");
    expect(screen.queryByTestId("filter-panel")).toBeNull();
    expect(screen.getByText("Filters")).toBeTruthy();
    expect(screen.getByTestId("product-grid")).toHaveAttribute("data-grid", "4");
  });

  it("places the product gallery and its thumbnails", () => {
    show({ galleryPosition: "right", thumbnailPosition: "bottom" });
    openPage("Product");
    expect(part('[data-gallery="right"]')?.className).toContain("flex-row-reverse");
    expect(part('[data-thumbs="bottom"]')?.className).toContain("flex-col-reverse");
  });

  it.each(["full", "compact"])("draws the %s footer", (footerLayout) => {
    show({ footerLayout });
    expect(part(`[data-footer="${footerLayout}"]`)).toBeTruthy();
  });

  it.each(["solid", "flat", "outline"])("draws %s buttons", (buttonStyle) => {
    show({ buttonStyle });
    expect(part(`[data-button="${buttonStyle}"]`)).toBeTruthy();
  });

  it("colors and aligns the menu", () => {
    show({ menuColor: "inverse", menuAlign: "center" });
    const menu = part('[data-menu="inverse"]');
    expect(menu?.className).toContain("bg-[var(--inverse)]");
    expect(menu?.querySelector(".justify-center")).toBeTruthy();
  });

  it("shows the announcement only when it is on and has words", () => {
    const { rerender } = show({ announcementEnabled: "on", announcementText: "Free delivery" });
    expect(screen.getByTestId("announcement")).toHaveTextContent("Free delivery");

    rerender(<StorefrontPrototype url={URL_} color="#2563eb" design={{ ...DEFAULT_DESIGN, announcementText: "Free delivery" }} />);
    expect(screen.queryByTestId("announcement")).toBeNull();
  });

  it("goes to the page where a changed choice can be seen", () => {
    const { rerender } = show();
    rerender(<StorefrontPrototype url={URL_} color="#2563eb" design={{ ...DEFAULT_DESIGN, galleryPosition: "right" }} />);
    expect(screen.getByRole("tab", { name: "Product" })).toHaveAttribute("aria-selected", "true");
  });

  it("shows the seller's real name, banner, categories and products when given", () => {
    const content: StoreContent = {
      live: true,
      name: "Smartsoft Innovation",
      logo: "https://x/logo.png",
      banners: [{ title: "Demo Test", headLine: "Season", image: "https://x/banner.jpg" }],
      promo: "https://x/promo.jpg",
      categories: [{ name: "Panjabi", image: "" }],
      products: [{ slug: "cotton-pant", name: "Cotton Pant", price: 1650, stock: 3, variants: [{}], brand: { name: "Velor" }, image: "https://x/pant.jpg" }],
    };
    render(<StorefrontPrototype url={URL_} color="#2563eb" design={DEFAULT_DESIGN} content={content} />);

    expect(screen.getAllByText("Smartsoft Innovation").length).toBeGreaterThan(0);
    expect(screen.getByText("Demo Test")).toBeTruthy();
    expect(screen.getByText("Panjabi")).toBeTruthy();
    expect(screen.getByText("Cotton Pant")).toBeTruthy();
    expect(screen.getByText("Only 3 left")).toBeTruthy();
    expect(screen.getByText("Choose options")).toBeTruthy();
    expect(screen.queryByText("Sample content")).toBeNull();
  });

  it("marks sample content, and shows sold out items as the website does", () => {
    show();
    expect(screen.getByText("Sample content")).toBeTruthy();
    expect(screen.getAllByText("Sold out").length).toBeGreaterThan(0);
  });

  it("opens a product's page from its card, like the website", () => {
    show();
    fireEvent.click(screen.getByText("Canvas Sneakers"));
    expect(screen.getByRole("tab", { name: "Product" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Canvas Sneakers" })).toBeTruthy();
  });

  it("fills choices a seller never made with the defaults", () => {
    expect(designFrom({ cardLayout: "overlay" })).toEqual({ ...DEFAULT_DESIGN, cardLayout: "overlay" });
  });
});

describe("the tabs drive the preview before anything is saved", () => {
  it("Website Color: picking a color changes it at once", () => {
    const onSave = vi.fn();
    render(<ColorStudio saved="" design={DEFAULT_DESIGN} previewUrl={URL_} canEdit saving={false} onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: "Use color #2563eb" }));

    expect(brandOf()).toBe("#2563eb");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("Website Design: picking a layout changes it at once, in the saved color", () => {
    const onSave = vi.fn();
    render(<DesignStudio saved={DEFAULT_DESIGN} color="#dc2626" previewUrl={URL_} canEdit saving={false} onSave={onSave} />);
    expect(brandOf()).toBe("#dc2626");
    expect(part('[data-card="standard"]')).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /card.*: Overlay$/i }));

    expect(part('[data-card="overlay"]')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });
});
