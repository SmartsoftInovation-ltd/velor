import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import SalesEmptyState from "./SalesEmptyState";

describe("SalesEmptyState", () => {
  it("stays pinned to the visible part of a wide cart table", () => {
    render(<SalesEmptyState />);

    const box = screen.getByText("Cart is empty").closest(".sticky");
    expect(box?.className).toContain("left-0");
    expect(box?.className).toContain("w-[100cqw]");
  });
});
