import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

describe("test setup", () => {
  it("renders React components in jsdom", () => {
    render(<p>hello</p>);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });
});
