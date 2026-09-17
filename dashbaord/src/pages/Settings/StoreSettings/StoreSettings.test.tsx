import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StoreSettings from "./StoreSettings";

const get = vi.fn();
const patch = vi.fn();
vi.mock("../../../hooks/useAxiosSecure", () => ({
  default: { get: (...a: unknown[]) => get(...a), patch: (...a: unknown[]) => patch(...a) },
}));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));
let owner = true;
vi.mock("../../../context/AuthContext", () => ({ useAuth: () => ({ isOwner: owner, refreshAuth: vi.fn() }) }));

const settingsResponse = {
  settings: {
    general: { invoicePrefix: "PZS", orderHotline: "01711000000", facebookUrl: "", storefrontUrl: "", currency: "BDT", timezone: "Asia/Dhaka" },
    sms: { enabled: true, apiKey: { isSet: true } },
  },
  features: { sms: true, email: true, sslcommerz: false, couriers: { pathao: false, steadfast: true }, cloudinary: false, ai: false },
  ownerEditable: { general: ["orderHotline", "facebookUrl"] },
};
const webhooks = {
  sslcommerz: { success: "https://api/s", fail: "https://api/f", cancel: "https://api/c", ipn: "https://api/i" },
  pathao: "https://api/hooks/pathao/KEY",
  steadfast: "https://api/hooks/steadfast/KEY",
};

describe("StoreSettings", () => {
  beforeEach(() => {
    owner = true;
    get.mockReset();
    patch.mockReset();
    get.mockImplementation(async (url: string) => ({ data: { data: url.endsWith("/webhooks") ? webhooks : settingsResponse } }));
    patch.mockResolvedValue({ data: { data: { changes: ["general.orderHotline"] } } });
  });

  it("shows the invoice prefix read-only and each integration's status", async () => {
    render(<StoreSettings />);

    expect(await screen.findByDisplayValue("PZS")).toHaveAttribute("readonly");
    const integrations = screen.getByRole("list", { name: /integrations/i });
    expect(within(integrations).getByText("SMS").closest("li")).toHaveTextContent(/configured/i);
    expect(within(integrations).getByText("Cloudinary (images)").closest("li")).toHaveTextContent(/not configured/i);
    expect(screen.getByText("https://api/hooks/pathao/KEY")).toBeInTheDocument();
  });

  it("lets the owner update the hotline and Facebook page", async () => {
    render(<StoreSettings />);
    const hotline = await screen.findByLabelText(/order hotline/i);

    await userEvent.clear(hotline);
    await userEvent.type(hotline, "01811000000");
    await userEvent.type(screen.getByLabelText(/facebook page/i), "https://facebook.com/pizza");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith("/settings/general", { orderHotline: "01811000000", facebookUrl: "https://facebook.com/pizza" }),
    );
  });

  it("is read-only for staff who are not the owner", async () => {
    owner = false;
    render(<StoreSettings />);
    expect(await screen.findByLabelText(/order hotline/i)).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
  });
});
