import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import FeatureGate, { isFeatureEnabled } from "./FeatureGate";

const features = { sms: true, email: true, sslcommerz: false, couriers: { pathao: false, steadfast: true }, cloudinary: false, ai: false };
let current: typeof features | null = features;
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ features: current }) }));

describe("FeatureGate", () => {
  it("reads nested feature flags", () => {
    expect(isFeatureEnabled(features, "sms")).toBe(true);
    expect(isFeatureEnabled(features, "couriers.pathao")).toBe(false);
    expect(isFeatureEnabled(features, "couriers.steadfast")).toBe(true);
  });

  it("couriers means at least one courier is configured", () => {
    expect(isFeatureEnabled(features, "couriers")).toBe(true);
    expect(isFeatureEnabled({ ...features, couriers: { pathao: false, steadfast: false } }, "couriers")).toBe(false);
  });

  it("treats a missing feature list (older API) as enabled", () => {
    expect(isFeatureEnabled(null, "sms")).toBe(true);
  });

  it("renders the page when the integration is configured", () => {
    current = features;
    render(<FeatureGate feature="sms" label="SMS"><p>send sms page</p></FeatureGate>);
    expect(screen.getByText("send sms page")).toBeInTheDocument();
  });

  it("explains instead of rendering when the integration is not configured", () => {
    current = features;
    render(<FeatureGate feature="couriers.pathao" label="Pathao courier"><p>courier page</p></FeatureGate>);
    expect(screen.queryByText("courier page")).not.toBeInTheDocument();
    expect(screen.getByText(/pathao courier is not configured/i)).toBeInTheDocument();
  });
});
