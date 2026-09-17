import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import IntegrationGrid from "./IntegrationGrid";
import type { SectionSchema } from "./types";

const schema: SectionSchema[] = [
  { key: "sms", path: "sms", testable: true, fields: [{ name: "enabled", type: "boolean", required: false, default: false }] },
];
const features = { sms: false, email: false, sslcommerz: false, couriers: { pathao: false, steadfast: false }, cloudinary: false, ai: false };

const renderGrid = () =>
  render(
    <IntegrationGrid schema={schema} settings={{ sms: { enabled: false } }} features={features} canManage onSave={vi.fn()} onTest={vi.fn()} />,
  );

describe("IntegrationGrid", () => {
  it("uses the green accent for the configure button", () => {
    renderGrid();
    expect(screen.getByRole("button", { name: /configure & connect/i })).toHaveClass("bg-accent-500");
  });

  it("switches the settings panel between drawer and modal and remembers the choice", async () => {
    renderGrid();
    await userEvent.click(screen.getByRole("button", { name: /configure & connect/i }));
    expect(screen.getByRole("dialog", { name: /sms settings/i })).toHaveAttribute("data-layout", "drawer");

    await userEvent.click(screen.getByRole("button", { name: /open as modal/i }));
    expect(screen.getByRole("dialog", { name: /sms settings/i })).toHaveAttribute("data-layout", "modal");
    expect(localStorage.getItem("integrationPanelLayout")).toBe("modal");

    await userEvent.click(screen.getByRole("button", { name: /^close$/i }));
    await userEvent.click(screen.getByRole("button", { name: /configure & connect/i }));
    expect(screen.getByRole("dialog", { name: /sms settings/i })).toHaveAttribute("data-layout", "modal");

    await userEvent.click(screen.getByRole("button", { name: /open as drawer/i }));
    expect(screen.getByRole("dialog", { name: /sms settings/i })).toHaveAttribute("data-layout", "drawer");
  });
});
