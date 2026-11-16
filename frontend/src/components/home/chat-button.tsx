"use client";

import { useEffect, useState } from "react";
import { CloseIcon } from "@/components/ui/icons";
import { ChatIcon, LinkedInIcon, MessengerIcon, XIcon, YouTubeIcon } from "@/components/ui/icons-chat";
import { FacebookIcon, InstagramIcon, MapPinIcon, PhoneIcon, WhatsAppIcon } from "@/components/ui/icons-footer";
import type { ChatChannel } from "@/lib/chat-channels";
import { cn } from "@/lib/cn";

// Each app's own colour, so the button is recognised at a glance
const LOOK = {
  messenger: { Icon: MessengerIcon, tone: "bg-[#0084ff]" },
  whatsapp: { Icon: WhatsAppIcon, tone: "bg-[#25d366]" },
  facebook: { Icon: FacebookIcon, tone: "bg-[#1877f2]" },
  instagram: { Icon: InstagramIcon, tone: "bg-[#e4405f]" },
  youtube: { Icon: YouTubeIcon, tone: "bg-[#ff0000]" },
  twitter: { Icon: XIcon, tone: "bg-[#000000] ring-1 ring-white/20" },
  linkedin: { Icon: LinkedInIcon, tone: "bg-[#0a66c2]" },
  map: { Icon: MapPinIcon, tone: "bg-[#34a853]" },
  call: { Icon: PhoneIcon, tone: "bg-brand-500" },
} as const;

/** A round button in the corner that fans out the store's chat options */
export function ChatButton({ channels }: { channels: ChatChannel[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-center gap-3 sm:right-6 sm:bottom-6">
      {/* Up to nine options: on a short screen the column scrolls instead of
          running off the top. The padding leaves room for the hover zoom. */}
      <ul
        id="chat-options"
        inert={!open}
        className="flex max-h-[calc(100dvh-7rem)] flex-col items-center gap-3 overflow-y-auto p-1 [scrollbar-width:none]"
      >
        {channels.map(({ id, label, href }, index) => {
          const { Icon, tone } = LOOK[id];
          return (
            <li
              key={id}
              // The option nearest the button moves first, on the way in and out
              style={{ transitionDelay: `${(open ? channels.length - 1 - index : index) * 45}ms` }}
              className={cn(
                "transition-[opacity,transform] duration-300 ease-[var(--ease-out)] motion-reduce:transition-none",
                open ? "translate-y-0 scale-100 opacity-100" : "translate-y-6 scale-50 opacity-0",
              )}
            >
              <a
                href={href}
                aria-label={label}
                title={label}
                {...(id === "call" ? {} : { target: "_blank", rel: "noopener noreferrer" })}
                className={cn(
                  "flex size-12 items-center justify-center rounded-full text-white shadow-lg transition-transform duration-200 ease-[var(--ease-hover)] hover:scale-110",
                  tone,
                )}
              >
                <Icon className="size-6" />
              </a>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="chat-options"
        aria-label={open ? "Close chat options" : "Chat with us"}
        className="relative flex size-14 items-center justify-center rounded-full bg-bg-inverse text-text-inverse shadow-xl transition-transform duration-200 ease-[var(--ease-hover)] hover:scale-105 active:scale-95"
      >
        {!open ? <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-bg-inverse opacity-20 motion-reduce:hidden" /> : null}
        <ChatIcon className={cn("absolute size-7 transition-[opacity,transform] duration-300", open ? "scale-50 -rotate-90 opacity-0" : "opacity-100")} />
        <CloseIcon className={cn("absolute size-6 transition-[opacity,transform] duration-300", open ? "opacity-100" : "scale-50 rotate-90 opacity-0")} />
      </button>
    </div>
  );
}
