import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CreateSellerForm from "./CreateSellerForm";

const provision = vi.fn();
vi.mock("../../platform/endpoints", () => ({ tenantsApi: { provision: (...a: unknown[]) => provision(...a) } }));

const fillOwner = async () => {
  await userEvent.type(screen.getByLabelText(/owner name/i), "Rahim");
  await userEvent.type(screen.getByLabelText(/owner email/i), "rahim@pizza.com");
  await userEvent.type(screen.getByLabelText(/owner phone/i), "01711000000");
};

describe("CreateSellerForm", () => {
  it("creates a seller with its owner and shows the one-time password and login link", async () => {
    provision.mockResolvedValue({
      tenant: { _id: "t1", slug: "pizzashop", name: "Pizza Shop", status: "active" },
      owner: { _id: "u1", name: "Rahim", email: "rahim@pizza.com", phone: "01711000000", temporaryPassword: "TempPass-123456" },
      loginUrl: "https://app.example.test/signin?workspace=pizzashop",
    });
    const onCreated = vi.fn();
    render(<CreateSellerForm onCreated={onCreated} onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/seller name/i), "Pizza Shop");
    expect(screen.getByLabelText(/workspace/i)).toHaveValue("pizza-shop");
    await userEvent.clear(screen.getByLabelText(/workspace/i));
    await userEvent.type(screen.getByLabelText(/workspace/i), "PizzaShop");
    await userEvent.type(screen.getByLabelText(/max staff/i), "10");
    await fillOwner();
    await userEvent.click(screen.getByRole("button", { name: /create seller/i }));

    await waitFor(() =>
      expect(provision).toHaveBeenCalledWith({
        name: "Pizza Shop",
        slug: "pizzashop",
        limits: { maxStaff: 10 },
        owner: { name: "Rahim", email: "rahim@pizza.com", phone: "01711000000" },
      }),
    );
    expect(await screen.findByText("TempPass-123456")).toBeInTheDocument();
    expect(screen.getByText("https://app.example.test/signin?workspace=pizzashop")).toBeInTheDocument();
    expect(onCreated).toHaveBeenCalled();
  });

  it("shows validation errors from the API", async () => {
    provision.mockRejectedValue({ response: { data: { message: '"api" is a reserved slug' } } });
    render(<CreateSellerForm onCreated={vi.fn()} onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/seller name/i), "API");
    await fillOwner();
    await userEvent.click(screen.getByRole("button", { name: /create seller/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("reserved slug");
  });
});
