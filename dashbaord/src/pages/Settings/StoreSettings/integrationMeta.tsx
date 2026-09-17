import type { ReactNode } from "react";
import { FiCloud, FiCpu, FiCreditCard, FiMail, FiMessageSquare, FiTruck } from "react-icons/fi";
import type { Features } from "../../../context/AuthContext";
import type { SectionValues } from "./types";

export interface FieldMeta {
  label: string;
  help?: string;
  placeholder?: string;
  options?: Record<string, string>;
  /** Field is only relevant when this returns true */
  visible?: (values: SectionValues) => boolean;
}

export interface IntegrationMeta {
  title: string;
  description: string;
  group: "Messaging" | "Payments" | "Delivery" | "Media & AI";
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
        label: "Sending method",
        options: { smtp: "Your own mail server (SMTP)", platform: "Platform mailbox", disabled: "Don't send email" },
        help: "SMTP works with Gmail app passwords, Zoho, Mailgun and most providers.",
      },
      fromName: { label: "Sender name", placeholder: "Velor" },
      fromEmail: { label: "Sender email", placeholder: "orders@yourstore.com" },
      replyTo: { label: "Reply-to email", placeholder: "support@yourstore.com" },
      smtpHost: { label: "SMTP host", placeholder: "smtp.gmail.com", visible: smtpOnly },
      smtpPort: { label: "SMTP port", placeholder: "587", visible: smtpOnly },
      smtpSecure: { label: "Use SSL/TLS (port 465)", visible: smtpOnly },
      smtpUser: { label: "SMTP username", placeholder: "orders@yourstore.com", visible: smtpOnly },
      smtpPassword: { label: "SMTP password", help: "For Gmail, use an app password.", visible: smtpOnly },
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
    group: "Media & AI",
    icon: <FiCloud />,
    connected: (f) => f.cloudinary,
    fields: {
      enabled: { label: "Enable Cloudinary" },
      cloudName: { label: "Cloud name", placeholder: "your-cloud" },
      apiKey: { label: "API key (numeric)" },
      apiSecret: { label: "API secret" },
    },
  },
  groq: {
    title: "AI assistant (Groq)",
    description: "Answers product questions in the shopping assistant.",
    group: "Media & AI",
    icon: <FiCpu />,
    connected: (f) => f.ai,
    fields: {
      enabled: { label: "Enable AI assistant" },
      apiKey: { label: "Groq API key", placeholder: "gsk_…" },
      model: { label: "Model", placeholder: "llama-3.3-70b-versatile" },
      temperature: { label: "Creativity (0–1)", help: "Lower is more precise." },
    },
  },
};

export const GROUP_ORDER: IntegrationMeta["group"][] = ["Messaging", "Payments", "Delivery", "Media & AI"];

export const fieldLabel = (sectionKey: string, name: string) =>
  INTEGRATIONS[sectionKey]?.fields[name]?.label ??
  name.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
