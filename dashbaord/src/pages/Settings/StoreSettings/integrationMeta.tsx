import type { ReactNode } from "react";
import { FiCloud, FiCreditCard, FiMail, FiMessageSquare, FiTruck } from "react-icons/fi";
import type { Features } from "../../../context/AuthContext";
import type { SectionValues } from "./types";

export interface FieldMeta {
  label: string;
  help?: string;
  placeholder?: string;
  options?: Record<string, string>;
  /** Offered in a dropdown, but the field still accepts any other value */
  suggestions?: { value: string; label?: string }[];
  /** Field is only relevant when this returns true */
  visible?: (values: SectionValues) => boolean;
}

export interface IntegrationMeta {
  title: string;
  description: string;
  group: "Messaging" | "Payments" | "Delivery" | "Media";
  icon: ReactNode;
  connected: (features: Features) => boolean;
  fields: Record<string, FieldMeta>;
}

const smtpOnly = (values: SectionValues) => values.mode === "smtp";

// Human labels and help for the settings schema returned by the API
export const INTEGRATIONS: Record<string, IntegrationMeta> = {
  sms: {
    title: "SMS",
    description: "Order confirmations and due reminders by SMS (BulkSMSBD).",
    group: "Messaging",
    icon: <FiMessageSquare />,
    connected: (f) => f.sms,
    fields: {
      enabled: { label: "Enable SMS" },
      provider: { label: "Provider", options: { bulksmsbd: "BulkSMSBD" } },
      apiUrl: { label: "API URL", placeholder: "http://bulksmsbd.net/api/smsapi" },
      balanceUrl: { label: "Balance URL", placeholder: "http://bulksmsbd.net/api/getBalanceApi", help: "Used to show your remaining SMS balance." },
      apiKey: { label: "API key" },
      senderId: { label: "Sender ID", placeholder: "8809617…" },
    },
  },
  email: {
    title: "Email",
    description: "Order emails, password resets and verification links.",
    group: "Messaging",
    icon: <FiMail />,
    connected: (f) => f.email,
    fields: {
      mode: {
        label: "Email sending",
        options: { smtp: "On — send from this mail server", disabled: "Off — don't send email" },
        help: "Your store sends its own email. Works with Gmail app passwords, Zoho, Mailgun and most providers.",
      },
      fromName: { label: "Sender name", placeholder: "Velor" },
      fromEmail: { label: "Sender email", placeholder: "orders@yourstore.com", help: "Shown as the sender, and where replies go. Leave empty to use the SMTP username." },
      smtpHost: {
        label: "SMTP host",
        placeholder: "smtp.gmail.com",
        help: "Your provider's server. Pick one or type your own.",
        suggestions: [
          { value: "smtp.gmail.com", label: "smtp.gmail.com (Gmail, Workspace)" },
          { value: "smtp.zoho.com", label: "smtp.zoho.com (Zoho)" },
          { value: "smtp.office365.com", label: "smtp.office365.com (Outlook, Microsoft 365)" },
          { value: "smtp.mailgun.org", label: "smtp.mailgun.org (Mailgun)" },
          { value: "smtp.sendgrid.net", label: "smtp.sendgrid.net (SendGrid)" },
        ],
        visible: smtpOnly,
      },
      smtpPort: {
        label: "SMTP port",
        placeholder: "587",
        help: "587 with SSL/TLS off, or 465 with it on. Port 25 is blocked by most hosts.",
        suggestions: [
          { value: "587", label: "587 — STARTTLS (usual)" },
          { value: "465", label: "465 — SSL/TLS" },
        ],
        visible: smtpOnly,
      },
      smtpSecure: { label: "Use SSL/TLS (port 465)", help: "Turn on only when the port is 465.", visible: smtpOnly },
      smtpUser: { label: "SMTP username", placeholder: "orders@yourstore.com", help: "Usually the full mailbox address. Some providers use a different username.", visible: smtpOnly },
      smtpPassword: { label: "SMTP password", help: "For Gmail and Zoho, generate an app password — your normal login password will not work.", visible: smtpOnly },
    },
  },
  sslcommerz: {
    title: "SSLCommerz",
    description: "Accept card and mobile banking payments online.",
    group: "Payments",
    icon: <FiCreditCard />,
    connected: (f) => f.sslcommerz,
    fields: {
      enabled: { label: "Enable SSLCommerz" },
      isLive: { label: "Live mode", help: "Off = sandbox. Turn on only with live store credentials." },
      storeId: { label: "Store ID", placeholder: "yourstore_live" },
      storePassword: { label: "Store password" },
    },
  },
  pathao: {
    title: "Pathao",
    description: "Create Pathao deliveries and receive status updates.",
    group: "Delivery",
    icon: <FiTruck />,
    connected: (f) => f.couriers.pathao,
    fields: {
      enabled: { label: "Enable Pathao" },
      baseUrl: { label: "API base URL", placeholder: "https://api-hermes.pathao.com" },
      clientId: { label: "Client ID" },
      clientSecret: { label: "Client secret" },
      username: { label: "Merchant login email" },
      password: { label: "Merchant login password" },
      storeId: { label: "Pathao store ID" },
      webhookSecret: { label: "Webhook secret", help: "Same value as in the Pathao merchant panel." },
    },
  },
  steadfast: {
    title: "Steadfast",
    description: "Create Steadfast consignments and receive status updates.",
    group: "Delivery",
    icon: <FiTruck />,
    connected: (f) => f.couriers.steadfast,
    fields: {
      enabled: { label: "Enable Steadfast" },
      baseUrl: { label: "API base URL", placeholder: "https://portal.packzy.com/api/v1" },
      apiKey: { label: "API key" },
      secretKey: { label: "Secret key" },
      webhookToken: { label: "Webhook bearer token", help: "Same token as in the Steadfast panel." },
    },
  },
  cloudinary: {
    title: "Cloudinary",
    description: "Stores product, banner and profile images.",
    group: "Media",
    icon: <FiCloud />,
    connected: (f) => f.cloudinary,
    fields: {
      enabled: { label: "Enable Cloudinary" },
      cloudName: { label: "Cloud name", placeholder: "your-cloud" },
      apiKey: { label: "API key (numeric)" },
      apiSecret: { label: "API secret" },
    },
  },
};

export const GROUP_ORDER: IntegrationMeta["group"][] = ["Messaging", "Payments", "Delivery", "Media"];

export const fieldLabel = (sectionKey: string, name: string) =>
  INTEGRATIONS[sectionKey]?.fields[name]?.label ??
  name.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
