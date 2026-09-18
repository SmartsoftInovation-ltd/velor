import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StoreSettings from "./StoreSettings";

const get = vi.fn();
const patch = vi.fn();
const post = vi.fn();
vi.mock("../../../hooks/useAxiosSecure", () => ({
  default: {
    get: (...a: unknown[]) => get(...a),
    patch: (...a: unknown[]) => patch(...a),
    post: (...a: unknown[]) => post(...a),
  },
}));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));
const updateFeatures = vi.fn();
vi.mock("../../../context/AuthContext", () => ({
  useAuth: () => ({ tenant: { _id: "t1", name: "Velor", slug: "velor", status: "active" }, updateFeatures }),
}));

const schema = [
  { key: "sms", path: "sms", testable: true, fields: [{ name: "enabled", type: "boolean", required: false, default: false }, { name: "apiKey", type: "secret", required: true }, { name: "senderId", type: "string", required: true, default: "" }] },
  { key: "email", path: "email", testable: true, fields: [{ name: "mode", type: "enum", required: false, default: "smtp", values: ["smtp", "disabled"] }] },
  { key: "sslcommerz", path: "payment/sslcommerz", testable: true, fields: [{ name: "enabled", type: "boolean", required: false, default: false }, { name: "storeId", type: "string", required: true, default: "" }] },
  { key: "pathao", path: "couriers/pathao", testable: true, fields: [{ name: "enabled", type: "boolean", required: false, default: false }] },
  { key: "steadfast", path: "couriers/steadfast", testable: true, fields: [{ name: "enabled", type: "boolean", required: false, default: false }] },
  { key: "cloudinary", path: "cloudinary", testable: true, fields: [{ name: "enabled", type: "boolean", required: false, default: false }] },
];

const features = { sms: true, email: false, sslcommerz: false, couriers: { pathao: false, steadfast: false }, cloudinary: true };

const settingsResponse = (canManageIntegrations: boolean) => ({
  settings: {
    general: { invoicePrefix: "VR" },
    sms: { enabled: true, apiKey: { isSet: true, last4: "9876" }, senderId: "880" },
    email: { mode: "disabled" },
    sslcommerz: { enabled: false, storeId: "" },
    pathao: { enabled: false },
    steadfast: { enabled: false },
    cloudinary: { enabled: true },
  },
  features,
  canManageIntegrations,
});

const webhooks = {
  sslcommerz: { success: "https://api/s", fail: "https://api/f", cancel: "https://api/c", ipn: "https://api/hooks/sslcommerz/K/ipn" },
  pathao: "https://api/hooks/pathao/K",
  steadfast: "https://api/hooks/steadfast/K",
};

const setup = (canManage = true) => {
  get.mockImplementation(async (url: string) => ({
    data: { data: url === "/settings/schema" ? schema : url === "/settings/webhooks" ? webhooks : settingsResponse(canManage) },
  }));
};

describe("StoreSettings", () => {
  beforeEach(() => {
    get.mockReset();
    patch.mockReset();
    post.mockReset();
    updateFeatures.mockReset();
  });

  it("summarises the store and every integration's status", async () => {
    setup();
    render(<StoreSettings />);

    // Six integrations: sms, email, sslcommerz, pathao, steadfast, cloudinary
    expect(await screen.findByText("2 of 6 connected")).toBeInTheDocument();
    expect(screen.getByText("velor")).toBeInTheDocument();
    expect(screen.getByDisplayValue("VR")).toHaveAttribute("readonly");

    const smsCard = screen.getByRole("article", { name: "SMS" });
    expect(within(smsCard).getByText("Connected")).toBeInTheDocument();
    const paymentCard = screen.getByRole("article", { name: "SSLCommerz" });
    expect(within(paymentCard).getByText("Not connected")).toBeInTheDocument();

    expect(screen.queryByLabelText(/order hotline/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/facebook page/i)).not.toBeInTheDocument();
  });

  it("lets the owner configure an integration in a panel and refreshes status", async () => {
    setup();
    patch.mockResolvedValue({ data: { data: { changes: ["sslcommerz.storeId"], version: 2 } } });
    render(<StoreSettings />);

    const card = await screen.findByRole("article", { name: "SSLCommerz" });
    await userEvent.click(within(card).getByRole("button", { name: /configure/i }));

    const panel = await screen.findByRole("dialog", { name: /sslcommerz/i });
    await userEvent.type(within(panel).getByLabelText(/store id/i), "velor_live");
    await userEvent.click(within(panel).getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(patch).toHaveBeenCalledWith("/settings/payment/sslcommerz", { storeId: "velor_live" }));
    await waitFor(() => expect(updateFeatures).toHaveBeenCalledWith(features));
  });

  it("closes the panel with Escape", async () => {
    setup();
    render(<StoreSettings />);
    await userEvent.click(within(await screen.findByRole("article", { name: "SMS" })).getByRole("button", { name: /configure/i }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("copies a webhook URL", async () => {
    setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<StoreSettings />);

    await userEvent.click(await screen.findByRole("button", { name: /copy pathao webhook url/i }));
    expect(writeText).toHaveBeenCalledWith("https://api/hooks/pathao/K");
  });

  it("shows status only to staff who are not the owner", async () => {
    setup(false);
    render(<StoreSettings />);

    const card = await screen.findByRole("article", { name: "SMS" });
    expect(within(card).queryByRole("button", { name: /configure/i })).not.toBeInTheDocument();
    expect(screen.getByText(/only the store owner can change integrations/i)).toBeInTheDocument();
  });
});
