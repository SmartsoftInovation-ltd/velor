import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axios, { type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";
import axiosSecure from "./useAxiosSecure";
import { setWorkspace } from "../lib/session";

describe("axiosSecure", () => {
  const replace = vi.fn();
  const originalLocation = window.location;
  const originalAdapter = axiosSecure.defaults.adapter;
  const originalBareAdapter = axios.defaults.adapter;

  beforeEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, pathname: "/orders", search: "", replace },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
    axiosSecure.defaults.adapter = originalAdapter;
    axios.defaults.adapter = originalBareAdapter;
    localStorage.clear();
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

  // The Platform Console runs on its own operator session. A store token that
  // has expired behind it used to bounce the operator to /signin mid-console.
  it("leaves the Platform Console alone when the store session dies", async () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, pathname: "/platform/sellers", search: "", replace },
    });
    localStorage.setItem("accessToken", "expired");
    respondWith(401, { message: "Unauthorized" });

    await expect(axiosSecure.get("/storeinformation/store-information-branding")).rejects.toBeTruthy();

    expect(replace).not.toHaveBeenCalled();
  });

  it("sends staff of a suspended store to the suspended page instead of refreshing", async () => {
    localStorage.setItem("accessToken", "t");
    respondWith(401, { code: "TENANT_SUSPENDED", message: "suspended" });

    await expect(axiosSecure.get("/auth/getme")).rejects.toBeTruthy();

    expect(replace).toHaveBeenCalledWith("/store-suspended");
    expect(localStorage.getItem("accessToken")).toBeNull();
  });

  // The refresh call goes through bare axios, so it gets its own fake server
  const fail = (config: InternalAxiosRequestConfig, status?: number, data: unknown = {}) =>
    Object.assign(new Error(status ? `status ${status}` : "Network Error"), {
      isAxiosError: true,
      config,
      response: status ? { status, data, headers: {}, config, statusText: "" } : undefined,
    });

  /**
   * The API accepts only the token "fresh"; anything else is an expired access token.
   * `refresh` decides what /auth/refresh-token answers.
   */
  const fakeServer = (refresh: (config: InternalAxiosRequestConfig) => Promise<unknown>) => {
    const calls = { api: [] as string[], refresh: 0 };
    axiosSecure.defaults.adapter = async (config) => {
      const auth = String(config.headers.Authorization ?? "");
      calls.api.push(auth);
      if (auth !== "Bearer fresh") throw fail(config, 401, { message: "jwt expired" });
      return { status: 200, data: { ok: true }, headers: {}, config, statusText: "OK" };
    };
    axios.defaults.adapter = async (config) => {
      calls.refresh += 1;
      const data = await refresh(config);
      return { status: 200, data, headers: {}, config, statusText: "OK" };
    };
    return calls;
  };

  describe("when the access token expires", () => {
    it("gets a new one from the refresh token and replays the request, without signing out", async () => {
      localStorage.setItem("accessToken", "expired");
      const calls = fakeServer(async () => ({ data: { accessToken: "fresh" } }));

      const res = await axiosSecure.get("/order/allorders");

      expect(res.data).toEqual({ ok: true });
      expect(calls.refresh).toBe(1);
      expect(calls.api).toEqual(["Bearer expired", "Bearer fresh"]);
      expect(localStorage.getItem("accessToken")).toBe("fresh");
      expect(replace).not.toHaveBeenCalled();
    });

    it("refreshes once for several requests that expire together", async () => {
      localStorage.setItem("accessToken", "expired");
      const calls = fakeServer(async () => ({ data: { accessToken: "fresh" } }));

      await Promise.all([axiosSecure.get("/a"), axiosSecure.get("/b"), axiosSecure.get("/c")]);

      expect(calls.refresh).toBe(1);
      expect(replace).not.toHaveBeenCalled();
    });

    it("signs out when the refresh token has expired too", async () => {
      localStorage.setItem("accessToken", "expired");
      fakeServer(async (config) => { throw fail(config, 401, { message: "jwt expired" }); });

      await expect(axiosSecure.get("/order/allorders")).rejects.toBeTruthy();

      expect(localStorage.getItem("accessToken")).toBeNull();
      expect(replace).toHaveBeenCalledWith(`/signin?sessionExpired=1&from=${encodeURIComponent("/orders")}`);
    });

    it.each([
      ["the network is down", undefined],
      ["the API is restarting", 502],
      ["the API is rate limiting", 429],
    ])("keeps the user signed in when %s", async (_label, status) => {
      localStorage.setItem("accessToken", "expired");
      fakeServer(async (config) => { throw fail(config, status); });

      await expect(axiosSecure.get("/order/allorders")).rejects.toBeTruthy();

      expect(replace).not.toHaveBeenCalled();
      expect(localStorage.getItem("accessToken")).toBe("expired");
    });
  });
});
