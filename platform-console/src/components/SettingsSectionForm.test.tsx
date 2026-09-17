import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsSectionForm from "./SettingsSectionForm";
import type { SettingsSectionSchema, SectionValues } from "../api/types";

const schema: SettingsSectionSchema = {
  key: "sms",
  path: "sms",
  testable: true,
  fields: [
    { name: "enabled", type: "boolean", required: false, default: false },
    { name: "provider", type: "enum", required: false, default: "bulksmsbd", values: ["bulksmsbd"] },
    { name: "apiUrl", type: "uri", required: true, default: "" },
    { name: "apiKey", type: "secret", required: true },
    { name: "senderId", type: "string", required: true, default: "" },
  ],
};

const values: SectionValues = {
  enabled: true,
  provider: "bulksmsbd",
  apiUrl: "http://sms.test/send",
  apiKey: { isSet: true, last4: "1234", updatedAt: "2026-09-17T00:00:00Z" },
  senderId: "880",
};

const setup = (overrides: Partial<Parameters<typeof SettingsSectionForm>[0]> = {}) => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onTest = vi.fn().mockResolvedValue({ ok: true, detail: { balance: 5 } });
  render(<SettingsSectionForm schema={schema} values={values} onSave={onSave} onTest={onTest} canEdit {...overrides} />);
  return { onSave, onTest };
};

describe("SettingsSectionForm", () => {
  it("shows that a secret is set without revealing it", () => {
    setup();
    const secret = screen.getByLabelText("apiKey");
    expect(secret).toHaveValue("");
    expect(secret).toHaveAttribute("placeholder", expect.stringContaining("1234"));
  });

  it("sends only changed fields; an untouched secret is left out", async () => {
    const { onSave } = setup();
    const sender = screen.getByLabelText("senderId");
    await userEvent.clear(sender);
    await userEvent.type(sender, "8809617");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ senderId: "8809617" }));
  });

  it("sends a typed secret, and null when the secret is cleared", async () => {
    const { onSave } = setup();
    await userEvent.type(screen.getByLabelText("apiKey"), "new-key");
    await userEvent.click(screen.getByRole("checkbox", { name: /enabled/i }));
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(onSave).toHaveBeenLastCalledWith({ enabled: false, apiKey: "new-key" }));
  });

  it("clears a stored secret", async () => {
    const { onSave } = setup();
    await userEvent.click(screen.getByRole("checkbox", { name: /clear apiKey/i }));
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ apiKey: null }));
  });

  it("disables Save until something changes", () => {
    setup();
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("runs the connection test and shows the result", async () => {
    const { onTest } = setup({ onTest: vi.fn().mockResolvedValue({ ok: false, error: "Invalid API Key" }) });
    await userEvent.click(screen.getByRole("button", { name: /test/i }));
    expect(await screen.findByText(/invalid api key/i)).toBeInTheDocument();
    expect(onTest).not.toBeUndefined();
  });

  it("is read-only for support users", () => {
    setup({ canEdit: false });
    expect(screen.getByLabelText("senderId")).toBeDisabled();
    expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
  });
});
