import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import InteractiveDashboard from "./InteractiveDashboard";

const post = vi.fn(() => Promise.resolve({ data: { data: { rows: [] } } }));

vi.mock("../../../hooks/useAxiosSecure", () => ({
  default: { post: () => post(), get: () => Promise.resolve({ data: { data: {} } }) },
}));
vi.mock("../../../context/AuthContext", () => ({
  useAuth: () => ({ can: () => true, isSuperAdmin: true, isLoading: false, user: { name: "Test" } }),
}));
vi.mock("./WelcomeBar", () => ({ default: () => null }));
vi.mock("./RevenueTrendChart", () => ({ default: () => null }));
vi.mock("./SalesTypeDonut", () => ({ default: () => null }));
vi.mock("./TopProductsChart", () => ({ default: () => null }));

const setup = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <InteractiveDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const inOrder = (titles: (string | RegExp)[]) => {
  const nodes = titles.map((title) => screen.getAllByText(title)[0]);
  nodes.slice(1).forEach((node, i) => {
    const earlier = nodes[i].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(earlier, `${titles[i]} should come before ${titles[i + 1]}`).toBeTruthy();
  });
};

describe("InteractiveDashboard layout", () => {
  it("arranges the summary boxes row by row", async () => {
    setup();
    await screen.findByText("Sales Progress");
    await screen.findByText("Employee");
    inOrder([
      "Total Invoices", "Total Sale", "Total Transaction",
      "Employee", "Supplier", "Supplier Payment", "Customer", "Customer Due Payment",
      "Purchase Items", "Sold Items", "Stock Cost Value", "Total Products",
    ]);
  });

  it("arranges the lower part in pairs", async () => {
    setup();
    await screen.findByText("Sales Progress");
    inOrder([
      "Sales Progress",
      "Recent Sales", "Sales by Type",
      "Top Selling Products", "Push Selling Products",
      /^Inflow Transactions/, /^Outflow Transactions/,
      "Day Summary",
      "Low Stock Alert", "Payment Status",
    ]);
  });
});
