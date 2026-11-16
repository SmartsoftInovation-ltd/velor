import type { Store } from "@/lib/store-api";

export type ChatChannel = { id: "messenger" | "whatsapp" | "call"; label: string; href: string };

const isUrl = (value: string) => /^https?:\/\//i.test(value);
const digits = (value: string) => value.replace(/[^\d+]/g, "");

/**
 * The ways to reach the store that the seller filled in under Store
 * Information. A WhatsApp number or Messenger page name saved without a full
 * link is turned into one.
 */
export function chatChannels(store: Store | null): ChatChannel[] {
  const messenger = store?.messengerLink?.trim();
  const whatsapp = store?.whatsappLink?.trim();
  const phone = store?.phone?.trim();
  const channels: ChatChannel[] = [];

  if (messenger) {
    channels.push({
      id: "messenger",
      label: "Messenger",
      href: isUrl(messenger) ? messenger : `https://m.me/${encodeURIComponent(messenger)}`,
    });
  }
  if (whatsapp) {
    const number = digits(whatsapp).replace(/^\+/, "");
    if (isUrl(whatsapp) || number) {
      channels.push({ id: "whatsapp", label: "WhatsApp", href: isUrl(whatsapp) ? whatsapp : `https://wa.me/${number}` });
    }
  }
  if (phone && digits(phone)) channels.push({ id: "call", label: "Call", href: `tel:${digits(phone)}` });

  return channels;
}
