import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import GlobalSearch from "./GlobalSearch";

const navigate = vi.fn();

vi.mock("react-router", async (original) => ({
  ...(await original<typeof import("react-router")>()),
  useNavigate: () => navigate,
}));
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ can: () => true, isSuperAdmin: true, isLoading: false }),
}));
vi.mock("../reports/reportCategories", () => ({ allowedReportCategories: () => [] }));
vi.mock("../../layout/sidebarNav", () => ({
  useSidebarSections: () => [
    {
      label: "Sales Purchase",
      items: [
        {
          name: "Product",
          subItems: [
            { name: "Create Product", path: "/create-product" },
            { name: "Product List", path: "/product-list" },
          ],
        },
      ],
    },
  ],
}));

const setup = () =>
  render(
    <MemoryRouter>
      <GlobalSearch />
    </MemoryRouter>,
  );
const box = () => screen.getByRole("combobox", { name: "Search pages" });

describe("GlobalSearch", () => {
  beforeEach(() => {
    navigate.mockReset();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("marks the typed letters inside each result", async () => {
    setup();
    await userEvent.type(box(), "list");

    const mark = document.querySelector("mark");
    expect(mark).toHaveTextContent("List");
    expect(screen.getByRole("option", { name: /Product List/ })).toHaveAttribute("aria-selected", "true");
  });

  it("counts the results and shows the keyboard keys", async () => {
    setup();
    await userEvent.type(box(), "product");

    expect(screen.getByText("2 pages")).toBeTruthy();
    expect(screen.getByText("navigate")).toBeTruthy();
    expect(screen.getByText("open")).toBeTruthy();
    expect(screen.getByText("close")).toBeTruthy();
  });

  it("hides the scrollbar while the list still scrolls", async () => {
    setup();
    await userEvent.type(box(), "product");

    const list = screen.getByRole("listbox");
    expect(list.className).toContain("no-scrollbar");
    expect(list.className).toContain("overflow-y-auto");
  });

  it("still opens the chosen page by keyboard and by click", async () => {
    setup();
    await userEvent.type(box(), "product");
    // Names starting with the words come first, so the second result is Create Product
    fireEvent.keyDown(box(), { key: "ArrowDown" });
    await userEvent.keyboard("{Enter}");
    expect(navigate).toHaveBeenCalledWith("/create-product");

    await userEvent.type(box(), "list");
    await userEvent.click(screen.getByRole("option", { name: /Product List/ }));
    expect(navigate).toHaveBeenLastCalledWith("/product-list");
  });

  it("explains an empty search", async () => {
    setup();
    await userEvent.type(box(), "zzz");

    expect(screen.getByText(/No page found for/)).toBeTruthy();
  });
});
