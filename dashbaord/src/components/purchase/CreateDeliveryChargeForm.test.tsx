import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CreateDeliveryChargeForm from "./CreateDeliveryChargeForm";

vi.mock("../../hooks/useAxiosSecure", () => ({ default: { post: vi.fn() } }));
vi.mock("../../hooks/useIsMobile", () => ({ default: () => false }));

describe("CreateDeliveryChargeForm", () => {
  it("marks both fields as required with a red asterisk", () => {
    render(<CreateDeliveryChargeForm />);

    ["name", "deliveryCharge"].forEach((id) => {
      const label = document.querySelector(`label[for="${id}"]`) as HTMLElement;
      const star = label.querySelector(".text-red-500");
      expect(star?.textContent).toBe("*");
    });
    expect(screen.getByText("Delivery Name")).toBeTruthy();
  });
});
