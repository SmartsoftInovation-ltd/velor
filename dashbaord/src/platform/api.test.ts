import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import { platformApi as api, getPlatformToken as getToken, setPlatformSessionExpiredHandler as setSessionExpiredHandler, setPlatformToken as setToken } from "./api";

type Reply = { status: number; data: unknown };

const useAdapter = (reply: (config: InternalAxiosRequestConfig) => Reply) => {
  const seen: InternalAxiosRequestConfig[] = [];
  const adapter: AxiosAdapter = async (config) => {
    seen.push(config);
    const { status, data } = reply(config);
    if (status >= 400) {
      throw Object.assign(new Error(`status ${status}`), {
        isAxiosError: true,
        config,
        response: { status, data, headers: {}, config, statusText: "" },
      });
    }
    return { status, data, headers: {}, config, statusText: "OK" };
  };
  api.defaults.adapter = adapter;
  return seen;
};

describe("platform API client", () => {
  const original = api.defaults.adapter;
  beforeEach(() => setToken(null));
  afterEach(() => {
    api.defaults.adapter = original;
  });

  it("sends the platform access token", async () => {
    setToken("tok-1");
    const seen = useAdapter(() => ({ status: 200, data: {} }));
    await api.get("/tenants");
    expect(seen[0].headers.Authorization).toBe("Bearer tok-1");
  });

  it("refreshes once on 401 and replays the request", async () => {
    setToken("expired");
    const seen = useAdapter((config) => {
      if (config.url === "/auth/refresh") return { status: 200, data: { data: { accessToken: "fresh" } } };
      if (config.headers.Authorization === "Bearer fresh") return { status: 200, data: { data: ["ok"] } };
      return { status: 401, data: { message: "Unauthorized" } };
    });

    const res = await api.get("/tenants");

    expect(res.data.data).toEqual(["ok"]);
    expect(getToken()).toBe("fresh");
    expect(seen.map((c) => c.url)).toEqual(["/tenants", "/auth/refresh", "/tenants"]);
  });

  it("ends the session when refresh fails", async () => {
    setToken("expired");
    const expired = vi.fn();
    setSessionExpiredHandler(expired);
    useAdapter(() => ({ status: 401, data: {} }));

    await expect(api.get("/tenants")).rejects.toBeTruthy();

    expect(getToken()).toBeNull();
    expect(expired).toHaveBeenCalled();
  });

  it("does not try to refresh a failed login", async () => {
    const seen = useAdapter(() => ({ status: 401, data: { message: "Invalid credentials" } }));
    await expect(api.post("/auth/login", {})).rejects.toBeTruthy();
    expect(seen).toHaveLength(1);
  });
});
