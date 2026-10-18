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
  await userEvent.type(screen.getByLabelText(/owner password/i), "Pizza-Owner-1");
};

describe("CreateSellerForm", () => {
  it("creates a seller with the operator's password and shows the sign-in details", async () => {
    provision.mockResolvedValue({
      tenant: { _id: "t1", slug: "pizzashop", name: "Pizza Shop", status: "active" },
      owner: { _id: "u1", name: "Rahim", email: "rahim@pizza.com", phone: "01711000000" },
      loginUrl: "https://app.example.test/signin?workspace=pizzashop",
      notification: { channel: "sms", sent: true },
    });
    const onCreated = vi.fn();
    render(<CreateSellerForm onCreated={onCreated} onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/seller name/i), "Pizza Shop");
    expect(screen.getByLabelText(/workspace/i)).toHaveValue("pizza-shop");
    await userEvent.clear(screen.getByLabelText(/workspace/i));
    await userEvent.type(screen.getByLabelText(/workspace/i), "PizzaShop");
    await fillOwner();
    await userEvent.click(screen.getByRole("button", { name: /create seller/i }));

    await waitFor(() =>
      expect(provision).toHaveBeenCalledWith({
        name: "Pizza Shop",
        slug: "pizzashop",
        billing: expect.objectContaining({ price: 0, cycle: "monthly" }),
        owner: { name: "Rahim", email: "rahim@pizza.com", phone: "01711000000", password: "Pizza-Owner-1" },
      }),
    );
    expect(await screen.findByText("Pizza-Owner-1")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("sent by SMS to 01711000000");
    expect(screen.getByText("https://app.example.test/signin?workspace=pizzashop")).toBeInTheDocument();
    expect(onCreated).toHaveBeenCalled();
  });

  it("tells the operator to send the details when nothing could be sent", async () => {
    provision.mockResolvedValue({
      tenant: { _id: "t1", slug: "cake", name: "Cake", status: "active" },
      owner: { _id: "u1", name: "Rahim", email: "rahim@pizza.com", phone: "01711000000" },
      loginUrl: "https://app.example.test/signin?workspace=cake",
      notification: { channel: null, sent: false },
    });
    render(<CreateSellerForm onCreated={vi.fn()} onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/seller name/i), "Cake");
    await fillOwner();
    await userEvent.click(screen.getByRole("button", { name: /create seller/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(/platform sms is not set up/i);
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
