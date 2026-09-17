import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import axiosSecure from "./useAxiosSecure";
import { setWorkspace } from "../lib/session";

describe("axiosSecure", () => {
  const replace = vi.fn();
  const originalLocation = window.location;
  const originalAdapter = axiosSecure.defaults.adapter;

  beforeEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, pathname: "/orders", search: "", replace },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
    axiosSecure.defaults.adapter = originalAdapter;
    replace.mockReset();
  });

  const respondWith = (status: number, data: unknown) => {
    const seen: InternalAxiosRequestConfig[] = [];
    const adapter: AxiosAdapter = async (config) => {
      seen.push(config);
      if (status >= 400) {
        const error = Object.assign(new Error(`status ${status}`), {
          isAxiosError: true,
          config,
          response: { status, data, headers: {}, config, statusText: "" },
        });
        throw error;
      }
      return { status, data, headers: {}, config, statusText: "OK" };
    };
    axiosSecure.defaults.adapter = adapter;
    return seen;
  };

  it("sends the workspace as x-tenant on every request", async () => {
    setWorkspace("pizzashop");
    const seen = respondWith(200, { ok: true });

    await axiosSecure.get("/categories-active");

    expect(seen[0].headers["x-tenant"]).toBe("pizzashop");
  });

  it("omits x-tenant when no workspace is known", async () => {
    const seen = respondWith(200, { ok: true });
    await axiosSecure.get("/categories-active");
    expect(seen[0].headers["x-tenant"]).toBeUndefined();
  });

  it("sends staff of a suspended store to the suspended page instead of refreshing", async () => {
    localStorage.setItem("accessToken", "t");
    respondWith(401, { code: "TENANT_SUSPENDED", message: "suspended" });

    await expect(axiosSecure.get("/auth/getme")).rejects.toBeTruthy();

    expect(replace).toHaveBeenCalledWith("/store-suspended");
    expect(localStorage.getItem("accessToken")).toBeNull();
  });
});
