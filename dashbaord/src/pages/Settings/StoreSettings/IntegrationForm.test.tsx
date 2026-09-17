import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import IntegrationForm from "./IntegrationForm";
import type { SectionSchema, SectionValues } from "./types";

const sms: SectionSchema = {
  key: "sms",
  path: "sms",
  testable: true,
  fields: [
    { name: "enabled", type: "boolean", required: false, default: false },
    { name: "provider", type: "enum", required: false, default: "bulksmsbd", values: ["bulksmsbd"] },
    { name: "apiUrl", type: "uri", required: true, default: "" },
    { name: "balanceUrl", type: "uri", required: false, default: "" },
    { name: "apiKey", type: "secret", required: true },
    { name: "senderId", type: "string", required: true, default: "" },
  ],
};

const email: SectionSchema = {
  key: "email",
  path: "email",
  testable: true,
  fields: [
    { name: "mode", type: "enum", required: false, default: "smtp", values: ["smtp", "disabled"] },
    { name: "fromName", type: "string", required: false, default: "" },
    { name: "smtpHost", type: "string", required: true, default: "" },
    { name: "smtpPassword", type: "secret", required: true },
  ],
};

const renderForm = (props: Partial<Parameters<typeof IntegrationForm>[0]> = {}) => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onTest = vi.fn().mockResolvedValue({ ok: true });
  render(
    <IntegrationForm
      schema={sms}
      values={{ enabled: false, provider: "bulksmsbd", apiUrl: "", balanceUrl: "", apiKey: { isSet: false, last4: "" }, senderId: "" }}
      canEdit
      onSave={onSave}
      onTest={onTest}
      {...props}
    />,
  );
  return { onSave, onTest };
};

describe("IntegrationForm", () => {
  it("uses human labels and saves only what changed", async () => {
    const { onSave } = renderForm();

    await userEvent.click(screen.getByRole("switch", { name: /enable sms/i }));
    await userEvent.type(screen.getByLabelText(/api url/i), "http://sms.example.test/send");
    await userEvent.type(screen.getByLabelText(/^api key/i), "secret-key-1234");
    await userEvent.type(screen.getByLabelText(/sender id/i), "8809617");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        enabled: true,
        apiUrl: "http://sms.example.test/send",
        apiKey: "secret-key-1234",
        senderId: "8809617",
      }),
    );
  });

  it("shows a stored secret masked, replaces it only on request and can remove it", async () => {
    const stored: SectionValues = { enabled: true, provider: "bulksmsbd", apiUrl: "http://x.test", balanceUrl: "", apiKey: { isSet: true, last4: "9876" }, senderId: "880" };
    const { onSave } = renderForm({ values: stored });

    expect(screen.getByText("•••• 9876")).toBeInTheDocument();
    expect(screen.queryByLabelText(/^api key/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /remove api key/i }));
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ apiKey: null }));
  });

  it("keeps Save disabled until something changes and asks to save before testing", async () => {
    renderForm();
    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/sender id/i), "1");
    expect(screen.getByRole("button", { name: /test connection/i })).toBeDisabled();
    expect(screen.getByText(/save your changes to test/i)).toBeInTheDocument();
  });

  it("tests the saved connection and shows the result", async () => {
    const { onTest } = renderForm({ onTest: vi.fn().mockResolvedValue({ ok: false, error: "Invalid API key" }) });
    await userEvent.click(screen.getByRole("button", { name: /test connection/i }));
    expect(await screen.findByText("Invalid API key")).toBeInTheDocument();
    expect(onTest).toBeDefined();
  });

  it("shows the API's validation message", async () => {
    const onSave = vi.fn().mockRejectedValue({ response: { data: { message: "Cannot enable sms: missing apiUrl" } } });
    renderForm({ onSave });
    await userEvent.click(screen.getByRole("switch", { name: /enable sms/i }));
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Cannot enable sms: missing apiUrl");
  });

  it("only shows SMTP fields when email sending is on", async () => {
    renderForm({ schema: email, values: { mode: "disabled", fromName: "", smtpHost: "", smtpPassword: { isSet: false, last4: "" } } });
    expect(screen.queryByLabelText(/smtp host/i)).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText(/email sending/i), "smtp");
    expect(screen.getByLabelText(/smtp host/i)).toBeInTheDocument();
  });

  it("is read-only without edit rights", () => {
    renderForm({ canEdit: false });
    expect(screen.getByLabelText(/sender id/i)).toBeDisabled();
    expect(screen.queryByRole("button", { name: /save changes/i })).not.toBeInTheDocument();
  });
});
