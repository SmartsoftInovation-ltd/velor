import { beforeEach, describe, expect, it } from "vitest";
import { createQueryClient, tenantQueryKeyHash } from "./queryClient";
import { clearWorkspace, setWorkspace } from "./session";

describe("tenant-namespaced query cache", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("hashes the same key differently per workspace", () => {
    setWorkspace("pizzashop");
    const pizza = tenantQueryKeyHash(["orders", 1]);
    setWorkspace("burgerhub");
    const burger = tenantQueryKeyHash(["orders", 1]);

    expect(pizza).not.toBe(burger);
    setWorkspace("pizzashop");
    expect(tenantQueryKeyHash(["orders", 1])).toBe(pizza);
  });

  // The real leak this guards: a clear() missed on store switch would otherwise
  // hand the new store the previous store's rows under the same key.
  it("does not serve one store's cached rows to another", () => {
    const client = createQueryClient();

    setWorkspace("pizzashop");
    client.setQueryData(["orders"], [{ id: "pizza-1" }]);
    expect(client.getQueryData(["orders"])).toEqual([{ id: "pizza-1" }]);

    setWorkspace("burgerhub");
    expect(client.getQueryData(["orders"])).toBeUndefined();

    client.setQueryData(["orders"], [{ id: "burger-1" }]);
    setWorkspace("pizzashop");
    expect(client.getQueryData(["orders"])).toEqual([{ id: "pizza-1" }]);
  });

  it("keeps a namespace of its own when no workspace is known", () => {
    clearWorkspace();
    const anonymous = tenantQueryKeyHash(["orders"]);
    expect(tenantQueryKeyHash(["orders"])).toBe(anonymous);

    setWorkspace("pizzashop");
    expect(tenantQueryKeyHash(["orders"])).not.toBe(anonymous);
  });
});
