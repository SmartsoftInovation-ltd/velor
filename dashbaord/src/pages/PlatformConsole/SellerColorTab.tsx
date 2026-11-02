import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiCheck, FiExternalLink, FiGlobe, FiRefreshCw, FiRotateCcw } from "react-icons/fi";
import { errorMessage } from "../../platform/api";
import { domainsApi, settingsApi } from "../../platform/endpoints";
import { usePlatformAuth } from "../../platform/PlatformAuthContext";
import { brandRamp, RAMP_STEPS } from "./brandRamp";
import {
  cardClass,
  Field,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "./ui";

// What the storefront wears when a store has picked nothing (its stylesheet's
// own --brand-500).
const STOREFRONT_DEFAULT_COLOR = "#fc630a";
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

// The seller's real website, painted live with the color being tried
const WebsiteFrame = ({ url, color }: { url: string; color: string }) => {
  const frame = useRef<HTMLIFrameElement>(null);
  const [path, setPath] = useState("/");
  const [reloads, setReloads] = useState(0);
  const origin = new URL(url).origin;

  const paint = () =>
    frame.current?.contentWindow?.postMessage({ type: "brand-preview:color", color }, origin);
  const latestPaint = useRef(paint);
  latestPaint.current = paint;

  useEffect(paint, [color, origin]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type !== "brand-preview:ready") return;
      setPath(String(event.data.path ?? "/"));
      latestPaint.current();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [origin]);

  return (
    <>
      <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-gray-300 dark:bg-gray-600" />
          <span className="size-2.5 rounded-full bg-gray-300 dark:bg-gray-600" />
          <span className="size-2.5 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>
        <p className="min-w-0 flex-1 truncate rounded-lg bg-gray-100 px-3 py-1.5 font-mono text-xs text-gray-500 dark:bg-white/5 dark:text-gray-400">
          {new URL(url).host}
          {path === "/" ? "" : path}
        </p>
        <button
          type="button"
          title="Reload website"
          aria-label="Reload website"
          onClick={() => {
            setPath("/");
            setReloads((n) => n + 1);
          }}
          className="flex size-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/5"
        >
          <FiRefreshCw className="size-4" />
        </button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          title="Open website in a new tab"
          aria-label="Open website in a new tab"
          className="flex size-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/5"
        >
          <FiExternalLink className="size-4" />
        </a>
      </div>
      <iframe
        key={reloads}
        ref={frame}
        src={url}
        title="Seller website preview"
        onLoad={paint}
        className="h-[calc(100vh-10rem)] min-h-[640px] w-full bg-white"
      />
    </>
  );
};

export const ColorStudio = ({
  saved,
  previewUrl,
  canEdit,
  saving,
  onSave,
}: {
  saved: string;
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
        {/* The chosen color, and every shade the website will make from it */}
        <div
          className="flex h-28 flex-col justify-end p-5 transition-colors duration-300"
          style={{ background: shown, color: ramp.onBrand }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest opacity-80">
            {valid || saved ? "Website color" : "Default website color"}
          </p>
          <p className="font-mono text-2xl font-semibold uppercase">{shown}</p>
        </div>
        <div className="flex" aria-hidden="true">
          {RAMP_STEPS.map((step) => (
            <span
              key={step}
              title={String(step)}
              className="h-3 flex-1 transition-colors duration-300"
              style={{ background: ramp.light[step] }}
            />
          ))}
        </div>

        <div className="space-y-6 p-5">
          <div>
            <p className="mb-2.5 text-sm font-medium text-gray-700 dark:text-gray-300">Suggested colors</p>
            <div className="grid grid-cols-3 gap-2">
              {SUGGESTED_COLORS.map(({ hex, name }) => {
                const selected = shown === hex;
                return (
                  <button
                    key={hex}
                    type="button"
                    aria-label={`Use color ${hex}`}
                    aria-pressed={selected}
                    disabled={!canEdit}
                    onClick={() => setColor(hex)}
                    className={`rounded-xl border p-1.5 text-left transition disabled:cursor-not-allowed ${
                      selected
                        ? "border-gray-900 dark:border-white"
                        : "border-gray-200 hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-500"
                    }`}
                  >
                    <span
                      className="flex h-9 items-center justify-center rounded-lg"
                      style={{ background: hex, color: brandRamp(hex).onBrand }}
                    >
                      {selected && <FiCheck className="size-4" />}
                    </span>
                    <span className="mt-1 block px-0.5 text-xs text-gray-600 dark:text-gray-400">{name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-end gap-2.5">
            <div className="min-w-0 flex-1">
              <Field id="website-color" label="Website color">
                <input
                  id="website-color"
                  className={`${inputClass} font-mono`}
                  placeholder="Default"
                  value={color}
                  readOnly={!canEdit}
                  aria-invalid={Boolean(trimmed) && !valid}
                  onChange={(e) => setColor(e.target.value)}
                />
              </Field>
            </div>
            <input
              type="color"
              aria-label="Pick any color"
              title="Pick any color"
              className="h-11 w-14 shrink-0 cursor-pointer rounded-xl border border-gray-200 bg-white p-1 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-white/5"
              value={shown}
              disabled={!canEdit}
              onChange={(e) => setColor(e.target.value)}
            />
          </div>
          {Boolean(trimmed) && !valid && (
            <p className="-mt-4 text-xs text-error-600">Use a hex value like #2563eb</p>
          )}

          <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-white/5">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
              style={{ background: shown, color: ramp.onBrand }}
            >
              Aa
            </span>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Button text will be <strong className="font-semibold text-gray-800 dark:text-gray-200">{ramp.onBrandIsDark ? "dark" : "white"}</strong>
              , chosen automatically so it stays readable.
            </p>
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

      <section className={`${cardClass} min-w-0 overflow-hidden`}>
        {previewUrl ? (
          <WebsiteFrame url={previewUrl} color={shown} />
        ) : (
          <div className="flex min-h-[640px] flex-col items-center justify-center gap-3 p-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400">
              <FiGlobe className="size-5" />
            </span>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">No live website yet</p>
            <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">
              The preview shows this seller's real website, so it needs an active domain.
              The color can still be saved now.
            </p>
            <Link to="?tab=domains" className={secondaryButtonClass}>Go to Domains</Link>
          </div>
        )}
      </section>
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
  const domains = useQuery({
    queryKey: ["platform", "domains", tenantId],
    queryFn: () => domainsApi.list(tenantId),
  });

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

  const active = domains.data?.filter((domain) => domain.status === "active") ?? [];
  const host = (active.find((domain) => domain.isPrimary) ?? active[0])?.host;
  const previewUrl = import.meta.env.VITE_STOREFRONT_PREVIEW_URL || (host ? `https://${host}` : "");

  return (
    <ColorStudio
      saved={String(current.data.settings.general?.primaryColor ?? "")}
      previewUrl={previewUrl}
      canEdit={isSuperadmin}
      saving={save.isPending}
      onSave={(color) => save.mutate(color)}
    />
  );
};

export default SellerColorTab;
