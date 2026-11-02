import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiCheck } from "react-icons/fi";
import { errorMessage } from "../../platform/api";
import { settingsApi } from "../../platform/endpoints";
import { usePlatformAuth } from "../../platform/PlatformAuthContext";
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
  "#fc630a",
  "#dc2626",
  "#db2777",
  "#7c3aed",
  "#2563eb",
  "#0891b2",
  "#0f9d63",
  "#ca8a04",
  "#1c1917",
];

// The storefront's rule (frontend/src/lib/brand-theme.ts): white text on the
// color when it clears 3:1, dark text otherwise.
const textOn = (hex: string) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return 1.05 / (luminance + 0.05) >= 3 ? "#fff" : "#1c1917";
};

const SellerColorTab = ({ tenantId }: { tenantId: string }) => {
  const { isSuperadmin } = usePlatformAuth();
  const queryClient = useQueryClient();
  const current = useQuery({
    queryKey: ["platform", "settings", tenantId],
    queryFn: () => settingsApi.get(tenantId),
  });
  const saved = String(current.data?.settings.general?.primaryColor ?? "");

  const [color, setColor] = useState(saved);
  useEffect(() => setColor(saved), [saved]);

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
    return <div className={`${cardClass} h-64 animate-pulse`} aria-busy="true" />;
  }
  if (!current.data)
    return <p className="text-sm text-error-600">Could not load settings</p>;

  const trimmed = color.trim();
  const valid = HEX_COLOR.test(trimmed);
  const shown = (valid ? trimmed : saved || STOREFRONT_DEFAULT_COLOR).toLowerCase();

  return (
    <section className={`${cardClass} grid gap-8 p-6 lg:grid-cols-2`}>
      <div className="space-y-5">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white/90">
            Website color
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Buttons, links and highlights on this seller's website. Shoppers see
            it on their next page load. The dashboard keeps its own color.
          </p>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Suggested colors
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`Use color ${swatch}`}
                aria-pressed={shown === swatch}
                disabled={!isSuperadmin}
                onClick={() => setColor(swatch)}
                style={{ background: swatch, color: textOn(swatch) }}
                className="flex size-9 items-center justify-center rounded-lg border border-black/10 transition hover:scale-105 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {shown === swatch && <FiCheck className="size-4" />}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <input
            type="color"
            aria-label="Pick any color"
            className="h-11 w-14 cursor-pointer rounded-lg border border-gray-200 bg-white p-1 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-white/5"
            value={shown}
            disabled={!isSuperadmin}
            onChange={(e) => setColor(e.target.value)}
          />
          <div className="w-36">
            <Field id="website-color" label="Website color">
              <input
                id="website-color"
                className={`${inputClass} font-mono`}
                placeholder="Default"
                value={color}
                readOnly={!isSuperadmin}
                onChange={(e) => setColor(e.target.value)}
              />
            </Field>
          </div>
        </div>

        {isSuperadmin && (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={trimmed === saved || !valid || save.isPending}
              onClick={() => save.mutate(trimmed)}
              className={`${primaryButtonClass} h-11`}
            >
              Save color
            </button>
            {saved && (
              <button
                type="button"
                disabled={save.isPending}
                onClick={() => save.mutate("")}
                className={`${secondaryButtonClass} h-11`}
              >
                Use default
              </button>
            )}
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          Preview
        </p>
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700">
          <div
            className="rounded-lg p-5"
            style={{ background: shown, color: textOn(shown) }}
          >
            <p className="text-lg font-bold">New arrivals</p>
            <p className="mt-1 text-sm opacity-90">
              How the banner reads in this color.
            </p>
          </div>
          <span
            className="inline-flex h-10 items-center rounded-md px-4 text-sm font-medium"
            style={{ background: shown, color: textOn(shown) }}
          >
            Add to cart
          </span>
        </div>
      </div>
    </section>
  );
};

export default SellerColorTab;
