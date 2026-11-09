import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiCheck, FiRotateCcw } from "react-icons/fi";
import { errorMessage } from "../../platform/api";
import { settingsApi } from "../../platform/endpoints";
import { usePlatformAuth } from "../../platform/PlatformAuthContext";
import { brandRamp } from "./brandRamp";
import { useSellerPreviewUrl } from "./useSellerPreviewUrl";
import { useStorefrontContent } from "./useStorefrontContent";
import StorefrontPrototype, { designFrom, STOREFRONT_DEFAULT_COLOR, type StoreContent, type WebsiteDesign } from "./StorefrontPrototype";
import {
  cardClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "./ui";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

const SUGGESTED_COLORS = [
  { hex: STOREFRONT_DEFAULT_COLOR, name: "Orange" },
  { hex: "#dc2626", name: "Red" },
  { hex: "#db2777", name: "Pink" },
  { hex: "#7c3aed", name: "Violet" },
  { hex: "#2563eb", name: "Blue" },
  { hex: "#0891b2", name: "Teal" },
  { hex: "#0f9d63", name: "Green" },
  { hex: "#ca8a04", name: "Gold" },
  { hex: "#1c1917", name: "Charcoal" },
];

export const ColorStudio = ({
  saved,
  design,
  content,
  previewUrl,
  canEdit,
  saving,
  onSave,
}: {
  saved: string;
  design: WebsiteDesign;
  content?: StoreContent;
  previewUrl: string;
  canEdit: boolean;
  saving: boolean;
  onSave: (color: string) => void;
}) => {
  const [color, setColor] = useState(saved);
  useEffect(() => setColor(saved), [saved]);

  const trimmed = color.trim();
  const valid = HEX_COLOR.test(trimmed);
  const shown = (valid ? trimmed : saved || STOREFRONT_DEFAULT_COLOR).toLowerCase();
  const ramp = useMemo(() => brandRamp(shown), [shown]);
  const changed = trimmed.toLowerCase() !== saved.toLowerCase();

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
      <section className={`${cardClass} overflow-hidden xl:sticky xl:top-24`}>
        <div className="space-y-5 p-5">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white/90">Website color</h3>
            <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              Used for buttons, links and highlights across the website.
            </p>
          </div>

          <div>
            <p className="mb-3 flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300">
              Suggested
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                {SUGGESTED_COLORS.find(({ hex }) => hex === shown)?.name ?? "Custom"}
              </span>
            </p>
            <div className="grid grid-cols-5 gap-3">
              {SUGGESTED_COLORS.map(({ hex, name }) => {
                const selected = shown === hex;
                return (
                  <button
                    key={hex}
                    type="button"
                    title={name}
                    aria-label={`Use color ${hex}`}
                    aria-pressed={selected}
                    disabled={!canEdit}
                    onClick={() => setColor(hex)}
                    className={`flex aspect-square items-center justify-center rounded-full outline-none ring-offset-2 transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-accent-500 disabled:cursor-not-allowed disabled:hover:scale-100 dark:ring-offset-gray-900 ${
                      selected ? "ring-2 ring-gray-900 dark:ring-white" : ""
                    }`}
                    style={{ background: hex, color: brandRamp(hex).onBrand }}
                  >
                    {selected && <FiCheck className="size-4" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="website-color" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Custom color
            </label>
            {/* The swatch and the code are one field: picking fills the code */}
            <div className={`flex h-11 items-center gap-2.5 rounded-xl border bg-white pl-1.5 pr-3 focus-within:ring-2 focus-within:ring-accent-500/20 dark:bg-gray-900 ${
              Boolean(trimmed) && !valid ? "border-error-500" : "border-gray-200 focus-within:border-accent-500 dark:border-gray-700"
            }`}>
              <input
                type="color"
                aria-label="Pick any color"
                title="Pick any color"
                className="size-8 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0 disabled:cursor-not-allowed [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
                value={shown}
                disabled={!canEdit}
                onChange={(e) => setColor(e.target.value)}
              />
              <input
                id="website-color"
                className="min-w-0 flex-1 bg-transparent font-mono text-sm uppercase text-gray-800 outline-none placeholder:normal-case placeholder:text-gray-400 dark:text-gray-200"
                placeholder="Default"
                value={color}
                readOnly={!canEdit}
                aria-invalid={Boolean(trimmed) && !valid}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>
            {Boolean(trimmed) && !valid && (
              <p className="mt-1.5 text-xs text-error-600">Use a hex value like #2563EB</p>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Button text stays readable: <strong className="font-semibold text-gray-800 dark:text-gray-200">{ramp.onBrandIsDark ? "dark" : "white"}</strong>
            </p>
            <span
              className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{ background: shown, color: ramp.onBrand }}
            >
              Add to cart
            </span>
          </div>

          {canEdit && (
            <div className="space-y-2">
              <button
                type="button"
                disabled={!changed || !valid || saving}
                onClick={() => onSave(trimmed)}
                className={`${primaryButtonClass} h-11 w-full`}
              >
                Save color
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!changed || saving}
                  onClick={() => setColor(saved)}
                  className={`${secondaryButtonClass} flex-1`}
                >
                  <FiRotateCcw className="size-3.5" /> Discard
                </button>
                {saved && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => onSave("")}
                    className={`${secondaryButtonClass} flex-1`}
                  >
                    Use default
                  </button>
                )}
              </div>
            </div>
          )}
          <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            Saved color reaches shoppers on their next page load. This dashboard keeps its own color.
          </p>
        </div>
      </section>

      <StorefrontPrototype url={previewUrl} color={shown} design={design} content={content} />
    </div>
  );
};

const SellerColorTab = ({ tenantId }: { tenantId: string }) => {
  const { isSuperadmin } = usePlatformAuth();
  const queryClient = useQueryClient();
  const current = useQuery({
    queryKey: ["platform", "settings", tenantId],
    queryFn: () => settingsApi.get(tenantId),
  });
  const previewUrl = useSellerPreviewUrl(tenantId);
  const content = useStorefrontContent(tenantId);

  const save = useMutation({
    mutationFn: (primaryColor: string) =>
      settingsApi.update(tenantId, "general", { primaryColor }),
    onSuccess: (_data, primaryColor) => {
      toast.success(primaryColor ? "Website color saved" : "Website color reset");
      queryClient.invalidateQueries({
        queryKey: ["platform", "settings", tenantId],
      });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (current.isLoading) {
    return <div className={`${cardClass} h-96 animate-pulse`} aria-busy="true" />;
  }
  if (!current.data)
    return <p className="text-sm text-error-600">Could not load settings</p>;

  return (
    <ColorStudio
      saved={String(current.data.settings.general?.primaryColor ?? "")}
      design={designFrom(current.data.settings.general)}
      content={content}
      previewUrl={previewUrl}
      canEdit={isSuperadmin}
      saving={save.isPending}
      onSave={(color) => save.mutate(color)}
    />
  );
};

export default SellerColorTab;
