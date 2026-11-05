import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CreateCustomerTypeForm from "./CreateCustomerTypeForm";

const navigate = vi.fn();
const post = vi.fn();

vi.mock("react-router", async (original) => ({
  ...(await original<typeof import("react-router")>()),
  useNavigate: () => navigate,
}));
vi.mock("../../hooks/useAxiosSecure", () => ({ default: { post: (...a: unknown[]) => post(...a) } }));
vi.mock("../../hooks/useIsMobile", () => ({ default: () => false }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const setup = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CreateCustomerTypeForm />
    </QueryClientProvider>,
  );

const submit = () => fireEvent.click(screen.getByRole("button", { name: "Create Customer Type" }));

describe("CreateCustomerTypeForm", () => {
  beforeEach(() => {
    navigate.mockReset();
    post.mockReset();
  });

  it("saves the trimmed name and goes to the customer type list", async () => {
    post.mockResolvedValue({});
    setup();
    fireEvent.change(screen.getByLabelText(/Customer Type Name/), { target: { value: "  Wholesale " } });
    submit();

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/customer-type-list"));
    expect(post).toHaveBeenCalledWith("/customer/create-customertype", { customerType: "Wholesale" });
  });

  it("does not send a blank name", async () => {
    setup();
    fireEvent.change(screen.getByLabelText(/Customer Type Name/), { target: { value: "   " } });
    submit();

    expect(await screen.findByText("Customer type name is required.")).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });

  it("stays on the form when the server rejects the name", async () => {
    post.mockRejectedValue({ response: { data: { message: "already exists" } } });
    setup();
    fireEvent.change(screen.getByLabelText(/Customer Type Name/), { target: { value: "VIP" } });
    submit();

    await waitFor(() => expect(post).toHaveBeenCalled());
    await waitFor(() => expect((screen.getByRole("button", { name: "Create Customer Type" }) as HTMLButtonElement).disabled).toBe(false));
    expect(navigate).not.toHaveBeenCalled();
  });
});
