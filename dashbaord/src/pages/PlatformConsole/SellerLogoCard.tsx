import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiImage, FiUpload } from "react-icons/fi";
import { errorMessage } from "../../platform/api";
import { logoApi } from "../../platform/endpoints";
import { cardClass, primaryButtonClass, secondaryButtonClass } from "./ui";

const ACCEPT = ".jpg,.jpeg,.png,.webp";
const MAX_BYTES = 10 * 1024 * 1024;
const BUSY = new Set(["pending", "processing"]);

/**
 * The seller's logo, the same image their own Site Information page sets. It is
 * uploaded to the seller's Cloudinary in the background, so the card keeps
 * checking until the upload has finished and then refreshes the preview.
 */
const SellerLogoCard = ({ tenantId, canEdit }: { tenantId: string; canEdit: boolean }) => {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");

  const logo = useQuery({
    queryKey: ["platform", "logo", tenantId],
    queryFn: () => logoApi.get(tenantId),
    refetchInterval: (query) => (BUSY.has(query.state.data?.status ?? "") ? 3000 : false),
  });

  const status = logo.data?.status ?? "";
  const wasBusy = useRef(false);
  useEffect(() => {
    if (BUSY.has(status)) {
      wasBusy.current = true;
      return;
    }
    if (!wasBusy.current) return;
    wasBusy.current = false;
    if (status === "uploaded") {
      toast.success("Logo is live");
      queryClient.invalidateQueries({ queryKey: ["platform", "storefront-content"] });
    } else if (status === "failed") {
      toast.error("Logo upload failed");
    }
  }, [status, queryClient]);

  useEffect(() => {
    if (!file) return setPreview("");
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const upload = useMutation({
    mutationFn: (chosen: File) => logoApi.upload(tenantId, chosen),
    onSuccess: (data) => {
      toast.success("Logo uploaded, processing");
      setFile(null);
      queryClient.setQueryData(["platform", "logo", tenantId], data);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const choose = (chosen: File | undefined) => {
    if (input.current) input.current.value = "";
    if (!chosen) return;
    if (!/\.(jpe?g|png|webp)$/i.test(chosen.name)) return toast.error("Use a JPG, PNG or WEBP image");
    if (chosen.size > MAX_BYTES) return toast.error("Logo must be 10 MB or smaller");
    setFile(chosen);
  };

  if (logo.isLoading) return <div className={`${cardClass} h-28 animate-pulse`} aria-busy="true" />;
  if (!logo.data) return <p className="text-sm text-error-600">Could not load the logo</p>;

  const shown = preview || logo.data.url;
  const busy = BUSY.has(status);

  return (
    <section className={`${cardClass} flex flex-wrap items-center gap-4 p-5`}>
      <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
        {shown ? (
          <img src={shown} alt="Seller logo" className="size-full object-contain" />
        ) : (
          <FiImage className="size-7 text-gray-400" aria-hidden />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white/90">Logo</h3>
        <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          {!logo.data.hasSiteInformation
            ? "This seller has no Site Information yet. Create it from the seller's dashboard, then upload the logo here."
            : busy
              ? "Uploading to the seller's image storage. It goes live when this finishes."
              : status === "failed"
                ? `The last upload failed${logo.data.lastError ? `: ${logo.data.lastError}` : ""}. Try again.`
                : "Shown in the website header, footer and browser tab. JPG, PNG or WEBP, up to 10 MB."}
        </p>
      </div>

      {canEdit && logo.data.hasSiteInformation && (
        <div className="flex shrink-0 gap-2">
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            className="hidden"
            aria-label="Choose logo image"
            onChange={(e) => choose(e.target.files?.[0])}
          />
          {file ? (
            <>
              <button type="button" disabled={upload.isPending} onClick={() => setFile(null)} className={secondaryButtonClass}>
                Cancel
              </button>
              <button type="button" disabled={upload.isPending} onClick={() => upload.mutate(file)} className={primaryButtonClass}>
                {upload.isPending ? "Uploading..." : "Save logo"}
              </button>
            </>
          ) : (
            <button type="button" disabled={busy} onClick={() => input.current?.click()} className={secondaryButtonClass}>
              <FiUpload className="size-3.5" /> {logo.data.url ? "Change logo" : "Upload logo"}
            </button>
          )}
        </div>
      )}
    </section>
  );
};

export default SellerLogoCard;
