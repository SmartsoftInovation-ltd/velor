import Link from "next/link";
import { AppImage } from "@/components/ui/app-image";

export function Logo() {
  return (
    <Link
      href="/"
      className="flex shrink-0 items-center gap-2 rounded-md text-h3 font-bold tracking-tight text-text-primary transition-opacity duration-200 hover:opacity-90"
    >
      {/* The mark is above the fold in every route, so it loads eagerly. It
          carries no alt of its own — the wordmark beside it is the label. */}
      <AppImage
        src="/logo.png"
        alt=""
        width={40}
        height={40}
        loading="eager"
        className="size-10 object-contain"
      />
      ShoPzio
    </Link>
  );
}
