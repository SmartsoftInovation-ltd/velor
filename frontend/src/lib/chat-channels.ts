import type { Store } from "@/lib/store-api";

export type ChatChannel = {
  id: "messenger" | "whatsapp" | "facebook" | "instagram" | "youtube" | "twitter" | "linkedin" | "map" | "call";
  label: string;
  href: string;
};

const isUrl = (value: string) => /^https?:\/\//i.test(value);
const digits = (value: string) => value.replace(/[^\d+]/g, "");
// A page or handle saved without a link ("velor.bd", "@velor") opens on that site
const profile = (value: string, site: string) =>
  isUrl(value) ? value : `https://${site}/${encodeURIComponent(value.replace(/^@/, ""))}`;

/**
 * The ways to reach the store that the seller filled in under Store
 * Information, in the order its form lists them. A WhatsApp number, or a
 * page name or handle, saved without a full link is turned into one.
 */
export function chatChannels(store: Store | null): ChatChannel[] {
  const messenger = store?.messengerLink?.trim();
  const whatsapp = store?.whatsappLink?.trim();
  const facebook = store?.facebookLink?.trim();
  const instagram = store?.instagramLink?.trim();
  const youtube = store?.youtubeLink?.trim();
  const twitter = store?.twitterLink?.trim();
  const linkedin = store?.linkedinLink?.trim();
  const map = store?.googleMapLink?.trim();
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
  if (facebook) channels.push({ id: "facebook", label: "Facebook", href: profile(facebook, "facebook.com") });
  if (instagram) channels.push({ id: "instagram", label: "Instagram", href: profile(instagram, "instagram.com") });
  if (youtube) channels.push({ id: "youtube", label: "YouTube", href: profile(youtube, "youtube.com") });
  if (twitter) channels.push({ id: "twitter", label: "X (Twitter)", href: profile(twitter, "x.com") });
  if (linkedin) channels.push({ id: "linkedin", label: "LinkedIn", href: profile(linkedin, "linkedin.com/company") });
  if (map) {
    channels.push({
      id: "map",
      label: "Find us on Google Maps",
      href: isUrl(map) ? map : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(map)}`,
    });
  }
  if (phone && digits(phone)) channels.push({ id: "call", label: "Call", href: `tel:${digits(phone)}` });

  return channels;
}
