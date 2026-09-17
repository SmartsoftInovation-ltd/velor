describe("cors config", () => {
  const envBackup = { ...process.env };

  const load = (env) => {
    jest.resetModules();
    process.env = { ...envBackup, ...env };
    return require("../../src/config/cors.config");
  };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("allows the dashboard, storefront and platform console origins", () => {
    const { isOriginAllowed } = load({
      NODE_ENV: "production",
      FRONTEND_URL: "https://shop.example.com",
      DASHBOARD_URL: "https://app.example.com/",
      PLATFORM_URL: "https://platform.example.com",
    });

    expect(isOriginAllowed("https://shop.example.com")).toBe(true);
    expect(isOriginAllowed("https://app.example.com")).toBe(true);
    expect(isOriginAllowed("https://platform.example.com")).toBe(true);
    expect(isOriginAllowed("https://evil.example.com")).toBe(false);
  });

  it("allows requests without an Origin header and localhost only in development", () => {
    expect(load({ NODE_ENV: "production" }).isOriginAllowed(undefined)).toBe(true);
    expect(load({ NODE_ENV: "production" }).isOriginAllowed("http://localhost:5173")).toBe(false);
    expect(load({ NODE_ENV: "development" }).isOriginAllowed("http://localhost:5173")).toBe(true);
  });
});
