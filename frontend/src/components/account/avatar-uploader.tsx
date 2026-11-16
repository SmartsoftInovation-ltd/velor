"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AppImage } from "@/components/ui/app-image";
import { CameraIcon, SpinnerIcon } from "@/components/ui/icons-account";
import { updatePhotoAction } from "@/lib/actions/account";
import { cn } from "@/lib/cn";
import { shrinkPhoto } from "@/lib/shrink-photo";

/**
 * The account photo with a camera button to change it. The photo is shrunk in
 * the browser first (a phone photo is several MB; a 512px avatar is ~100 KB),
 * then shown at once while the store uploads it in the background. While it
 * is still uploading the page re-checks every few seconds.
 */
export function AvatarUploader({
  image,
  pending,
  initials,
}: {
  image: string | null;
  pending: boolean;
  initials: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  // The local preview, and the server photo it is standing in for
  const [preview, setPreview] = useState<{ url: string; over: string | null } | null>(null);
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();
  const working = busy || pending;
  // Once the server has a new photo of its own, the local preview steps aside
  const shown = preview && (working || image === preview.over) ? preview.url : image;

  // The worker usually finishes within seconds; stop asking after a minute
  useEffect(() => {
    if (!pending) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (tries > 20) clearInterval(timer);
      else router.refresh();
    }, 3000);
    return () => clearInterval(timer);
  }, [pending, router]);

  const send = (form: FormData) =>
    startTransition(async () => {
      const result = await updatePhotoAction({}, form);
      if (result.error) {
        setError(result.error);
        setPreview(null);
      }
    });

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    try {
      const photo = await shrinkPhoto(file);
      setPreview({ url: URL.createObjectURL(photo), over: image });
      const form = new FormData();
      form.append("photo", photo, "photo.jpg");
      send(form);
    } catch {
      setError("That file could not be read as a photo.");
    }
  };

  const remove = () => {
    setError("");
    setPreview(null);
    const form = new FormData();
    form.append("remove", "1");
    send(form);
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <span className="flex size-24 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-h1 font-bold text-text-brand ring-4 ring-bg-surface shadow-md">
          {shown ? (
            <AppImage src={shown} alt="" width={96} height={96} className="size-full object-cover" unoptimized={shown.startsWith("blob:")} />
          ) : (
            initials || "?"
          )}
          {working ? (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white">
              <SpinnerIcon className="size-6 animate-spin" />
            </span>
          ) : null}
        </span>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={working}
          aria-label={shown ? "Change photo" : "Add photo"}
          className={cn(
            "absolute -right-1 -bottom-1 flex size-9 items-center justify-center rounded-full border-2 border-bg-surface bg-brand-500 text-on-brand shadow-md transition-transform duration-200 ease-[var(--ease-hover)] hover:scale-105",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          <CameraIcon className="size-4" />
        </button>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            onPick(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>

      <p className="mt-3 min-h-5 text-micro text-text-tertiary" aria-live="polite">
        {error ? (
          <span className="text-danger-text">{error}</span>
        ) : working ? (
          "Uploading your photo…"
        ) : shown ? (
          <button type="button" onClick={remove} className="font-medium text-text-secondary underline-offset-2 hover:text-danger-text hover:underline">
            Remove photo
          </button>
        ) : (
          "JPG, PNG or WEBP"
        )}
      </p>
    </div>
  );
}
