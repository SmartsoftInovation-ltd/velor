import { describe, expect, it } from "vitest";
import { buildSearchEntries, MAX_RESULTS, searchEntries, type SearchEntry } from "./globalSearch";
import type { SidebarSection } from "../../layout/sidebarNav";
import type { ReportCategory } from "../reports/reportCategories";

const sections = [
  {
    type: "main",
    label: "Menu",
    items: [{ name: "Dashboard", icon: null, path: "/" }],
  },
  {
    type: "salesPurchase",
    label: "Sales Purchase",
    items: [
      {
        name: " Product ",
        icon: null,
        subItems: [
          { name: "Create Product", path: "/product/new" },
          { name: "Product List", path: "/product" },
          { name: "Attributes", subSubItems: [{ name: "Brand List", path: "/brand" }] },
        ],
      },
    ],
  },
] as SidebarSection[];

const reports = [
  {
    key: "profit",
    label: "Profit",
    reports: [{ name: "Invoice Profit", path: "/invoice-profit", description: "Margin per invoice" }],
  },
] as ReportCategory[];

const entries = buildSearchEntries(sections, reports);
const paths = (query: string) => searchEntries(entries, query).map((e) => e.path);

describe("buildSearchEntries", () => {
  it("lists every page at every menu depth, with where it lives", () => {
    expect(entries.map((e) => e.path)).toEqual(["/", "/product/new", "/product", "/brand", "/invoice-profit"]);
    expect(entries[3].trail).toBe("Sales Purchase › Product › Attributes");
    expect(entries[4].trail).toBe("Reports › Profit");
  });

  it("lists a page linked twice only once", () => {
    const twice = [
      { type: "main", label: "A", items: [{ name: "One", icon: null, path: "/same" }] },
      { type: "main", label: "B", items: [{ name: "Two", icon: null, path: "/same" }] },
    ] as SidebarSection[];
    expect(buildSearchEntries(twice, [])).toHaveLength(1);
  });
});

describe("searchEntries", () => {
  it("finds nothing for an empty query", () => {
    expect(searchEntries(entries, "   ")).toEqual([]);
  });

  it("ignores case and word order", () => {
    expect(paths("LIST product")[0]).toBe("/product");
  });

  it("ranks a name that starts with the query above one that only contains it", () => {
    expect(paths("product")).toEqual(["/product", "/product/new", "/brand"]);
  });

  it("matches on the module a page sits under", () => {
    expect(paths("sales purchase")).toContain("/product/new");
  });

  it("matches a report on its description, below name matches", () => {
    expect(paths("margin")).toEqual(["/invoice-profit"]);
  });

  it("finds nothing when one word matches nowhere", () => {
    expect(paths("product zzz")).toEqual([]);
  });

  it("caps the list", () => {
    const many: SearchEntry[] = Array.from({ length: 30 }, (_, i) => ({
      name: `Page ${i}`,
      path: `/p${i}`,
      trail: "Menu",
    }));
    expect(searchEntries(many, "page")).toHaveLength(MAX_RESULTS);
  });
});
