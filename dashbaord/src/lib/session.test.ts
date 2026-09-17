import { describe, expect, it } from "vitest";
import { clearTenantStorage, getWorkspace, scopedStorageKey, setWorkspace, workspaceFromSearch } from "./session";

describe("session storage helpers", () => {
  it("remembers the workspace, normalized", () => {
    expect(getWorkspace()).toBeNull();
    setWorkspace("  PizzaShop ");
    expect(getWorkspace()).toBe("pizzashop");
  });

  it("reads a workspace deep link", () => {
    expect(workspaceFromSearch("?workspace=BurgerHub&from=/orders")).toBe("burgerhub");
    expect(workspaceFromSearch("?from=/orders")).toBeNull();
  });

  it("namespaces storage keys by workspace", () => {
    expect(scopedStorageKey("product_form_draft")).toBe("product_form_draft");
    setWorkspace("pizzashop");
    expect(scopedStorageKey("product_form_draft")).toBe("t:pizzashop:product_form_draft");
  });

  it("clears only the given workspace's keys", () => {
    localStorage.setItem("t:pizzashop:product_form_draft", "1");
    localStorage.setItem("t:burgerhub:product_form_draft", "2");
    localStorage.setItem("theme", "dark");

    clearTenantStorage("pizzashop");

    expect(localStorage.getItem("t:pizzashop:product_form_draft")).toBeNull();
    expect(localStorage.getItem("t:burgerhub:product_form_draft")).toBe("2");
    expect(localStorage.getItem("theme")).toBe("dark");
  });
});
