import Link from "next/link";
import { headers } from "next/headers";
import { AppImage } from "@/components/ui/app-image";
import { cn } from "@/lib/cn";
import { getStore, storeHostFrom } from "@/lib/store-api";

// The default wordmark, shown until the API names the store for this domain
const FALLBACK_NAME = "ShoPzio";

/** `onDark` is the wordmark for the black footer, in the store's brand color */
export async function Logo({ onDark = false }: { onDark?: boolean }) {
  const store = await getStore(storeHostFrom(await headers()));

  return (
    <Link
      href="/"
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-md text-h3 font-bold tracking-tight transition-opacity duration-200 hover:opacity-90",
        onDark ? "text-brand-500" : "text-text-primary",
      )}
    >
      {/* The mark is above the fold in every route, so it loads eagerly. It
          carries no alt of its own — the wordmark beside it is the label. */}
      <AppImage
        src={store?.logo || "/logo.png"}
        alt=""
        width={40}
        height={40}
        loading="eager"
        className="size-10 object-contain"
      />
      {store?.name || FALLBACK_NAME}
    </Link>
  );
}
