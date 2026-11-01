import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CustomerPaymentReceiveForm from "./CustomerPaymentReceiveForm";

// The form's mobile action bar asks for the screen size; jsdom has no matchMedia
vi.mock("../../hooks/useIsMobile", () => ({ default: () => false }));

const get = vi.fn();
vi.mock("../../hooks/useAxiosSecure", () => ({
  default: { get: (...args: unknown[]) => get(...args), post: vi.fn() },
}));

const customers = [
  { _id: "c-rina", fullName: "Rina Akter", mobileNumber: "01711111111", openingDues: 400 },
  { _id: "c-karim", fullName: "Karim Mia", mobileNumber: "01822222222", openingDues: 0 },
];
const invoicesOf: Record<string, unknown[]> = {
  "c-rina": [
    { invoiceNumber: "INV-0003", date: "2026-03-01", payable: 1000, due: 400 },
    { invoiceNumber: "INV-0001", date: "2026-01-01", payable: 500, due: 0 },
  ],
  "c-karim": [],
};

const renderForm = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <CustomerPaymentReceiveForm />
    </QueryClientProvider>,
  );

// SearchableSelect: open the trigger showing `trigger`, then pick `option`
const pick = async (trigger: RegExp, option: RegExp) => {
  await userEvent.click(screen.getByRole("button", { name: trigger }));
  await userEvent.click(await screen.findByRole("button", { name: option }));
};

describe("CustomerPaymentReceiveForm — Reference Invoice", () => {
  beforeEach(() => {
    sessionStorage.clear();
    get.mockReset().mockImplementation((url: string) => {
      if (url === "/customer/get-customers") return Promise.resolve({ data: { data: { customers } } });
      if (url === "/account/all-account") return Promise.resolve({ data: { data: [] } });
      const m = url.match(/^\/customer\/customer-invoices\/(.+)$/);
      if (m) return Promise.resolve({ data: { data: { invoices: invoicesOf[decodeURIComponent(m[1])] ?? [] } } });
      return Promise.reject(new Error(`unexpected GET ${url}`));
    });
  });

  it("asks for a customer first, then lists only that customer's invoices", async () => {
    renderForm();
    expect(await screen.findByRole("button", { name: /select a customer first/i })).toBeInTheDocument();

    await pick(/select customer/i, /rina akter/i);
    await waitFor(() => expect(get).toHaveBeenCalledWith("/customer/customer-invoices/c-rina"));

    await userEvent.click(await screen.findByRole("button", { name: /select invoice #/i }));
    expect(await screen.findByRole("button", { name: /INV-0003 · 01 Mar 2026 · Due ৳400/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /INV-0001 · 01 Jan 2026 · Paid/ })).toBeInTheDocument();
  });

  it("says so when the customer has no invoices", async () => {
    renderForm();
    await pick(/select customer/i, /karim mia/i);
    expect(await screen.findByRole("button", { name: /this customer has no invoices/i })).toBeInTheDocument();
  });

  it("clears the chosen invoice when the customer changes", async () => {
    renderForm();
    await pick(/select customer/i, /rina akter/i);
    await pick(/select invoice #/i, /INV-0003/);
    expect(screen.getByRole("button", { name: /INV-0003/ })).toBeInTheDocument();

    await pick(/rina akter/i, /karim mia/i);
    expect(await screen.findByRole("button", { name: /this customer has no invoices/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /INV-0003/ })).not.toBeInTheDocument();
  });
});
