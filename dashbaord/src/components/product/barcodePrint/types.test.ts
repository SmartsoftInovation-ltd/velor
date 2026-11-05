import { describe, it, expect } from "vitest";
import { labelsForStock } from "./types";

describe("labelsForStock", () => {
  it("prints one label per unit in stock", () => {
    expect(labelsForStock(7)).toBe(7);
  });

  it("keeps one label when stock is empty or unknown", () => {
    expect(labelsForStock(0)).toBe(1);
    expect(labelsForStock(undefined)).toBe(1);
  });
});
