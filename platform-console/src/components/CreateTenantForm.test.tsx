import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CreateTenantForm from "./CreateTenantForm";

const provision = vi.fn();
vi.mock("../api/endpoints", () => ({ tenantsApi: { provision: (...a: unknown[]) => provision(...a) } }));

describe("CreateTenantForm", () => {
  it("provisions a store with its owner and shows the one-time password and login link", async () => {
    provision.mockResolvedValue({
      tenant: { _id: "t1", slug: "pizzashop", name: "Pizza Shop", status: "active" },
      owner: { _id: "u1", name: "Rahim", email: "rahim@pizza.com", phone: "01711000000", temporaryPassword: "TempPass-123456" },
      loginUrl: "https://app.example.test/signin?workspace=pizzashop",
    });
    const onCreated = vi.fn();
    render(<CreateTenantForm onCreated={onCreated} />);

    await userEvent.type(screen.getByLabelText(/store name/i), "Pizza Shop");
    await userEvent.type(screen.getByLabelText(/workspace/i), "pizzashop");
    await userEvent.type(screen.getByLabelText(/max staff/i), "10");
    await userEvent.type(screen.getByLabelText(/owner name/i), "Rahim");
    await userEvent.type(screen.getByLabelText(/owner email/i), "rahim@pizza.com");
    await userEvent.type(screen.getByLabelText(/owner phone/i), "01711000000");
    await userEvent.click(screen.getByRole("button", { name: /create store/i }));

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
    render(<CreateTenantForm onCreated={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/store name/i), "API");
    await userEvent.type(screen.getByLabelText(/workspace/i), "api");
    await userEvent.type(screen.getByLabelText(/owner name/i), "Rahim");
    await userEvent.type(screen.getByLabelText(/owner email/i), "rahim@pizza.com");
    await userEvent.type(screen.getByLabelText(/owner phone/i), "01711000000");
    await userEvent.click(screen.getByRole("button", { name: /create store/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("reserved slug");
  });
});
