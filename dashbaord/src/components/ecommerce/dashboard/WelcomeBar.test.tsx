import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import WelcomeBar from "./WelcomeBar";

let granted: string[] = [];
vi.mock("../../../context/AuthContext", () => ({
  useAuth: () => ({
    tenant: { _id: "t1", name: "Brothers Furniture", slug: "brothers", status: "active" },
    can: (module: string, action: string) => granted.includes(`${module}:${action}`),
  }),
}));

const renderBar = () => render(<MemoryRouter><WelcomeBar /></MemoryRouter>);

describe("WelcomeBar", () => {
  it("welcomes the store by name and links the quick actions", () => {
    granted = ["retail-sales:add", "view-all-stock:view", "add-transaction:add"];
    renderBar();

    expect(screen.getByRole("heading", { name: "Brothers Furniture" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sales/i })).toHaveAttribute("href", "/create-retail-sales");
    expect(screen.getByRole("link", { name: /stock/i })).toHaveAttribute("href", "/view-all-stock");
    expect(screen.getByRole("link", { name: /transaction/i })).toHaveAttribute("href", "/add-transaction");
  });

  it("hides a shortcut the user is not allowed to open", () => {
    granted = ["view-all-stock:view"];
    renderBar();

    expect(screen.getByRole("link", { name: /stock/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /sales/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /transaction/i })).not.toBeInTheDocument();
  });
});
