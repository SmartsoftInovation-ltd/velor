import { headers } from "next/headers";
import { chatChannels } from "@/lib/chat-channels";
import { getStore, storeHostFrom } from "@/lib/store-api";
import { ChatButton } from "./chat-button";

// The floating chat button; not drawn until the store has a way to be reached
export async function ChatWidget() {
  const channels = chatChannels(await getStore(storeHostFrom(await headers())));
  if (!channels.length) return null;

  return <ChatButton channels={channels} />;
}
