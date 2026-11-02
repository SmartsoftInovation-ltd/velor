import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiRotateCcw } from "react-icons/fi";
import { errorMessage } from "../../platform/api";
import { settingsApi } from "../../platform/endpoints";
import { usePlatformAuth } from "../../platform/PlatformAuthContext";
import { useSellerPreviewUrl } from "./useSellerPreviewUrl";
import WebsitePreview from "./WebsitePreview";
import { cardClass, primaryButtonClass, secondaryButtonClass } from "./ui";

export type WebsiteDesign = { bannerLayout: string; cardLayout: string; gridColumns: string };

const DEFAULT_DESIGN: WebsiteDesign = { bannerLayout: "split", cardLayout: "standard", gridColumns: "4" };

const Bar = ({ className = "" }: { className?: string }) => (
  <span className={`block h-1 rounded-full bg-gray-300 dark:bg-gray-600 ${className}`} />
);

// Small drawings of each choice
const BANNERS = [
  {
    value: "split",
    label: "Split",
    hint: "Color beside image",
    picture: (
      <span className="flex h-full overflow-hidden rounded">
        <span className="flex w-3/5 flex-col justify-center gap-1 bg-accent-500 p-1.5">
          <span className="block h-1 w-3/4 rounded-full bg-white/90" />
          <span className="block h-1 w-1/2 rounded-full bg-white/60" />
        </span>
        <span className="flex-1 bg-gray-300 dark:bg-gray-600" />
      </span>
    ),
  },
  {
    value: "full",
    label: "Full image",
    hint: "Text over the image",
    picture: (
      <span className="flex h-full flex-col justify-center gap-1 rounded bg-gray-500 p-1.5">
        <span className="block h-1 w-1/2 rounded-full bg-white/90" />
        <span className="block h-1 w-1/3 rounded-full bg-white/60" />
      </span>
    ),
  },
  {
    value: "boxed",
    label: "Boxed",
    hint: "Rounded, with margins",
    picture: (
      <span className="flex h-full p-1.5">
        <span className="flex flex-1 overflow-hidden rounded-md">
          <span className="w-3/5 bg-accent-500" />
          <span className="flex-1 bg-gray-300 dark:bg-gray-600" />
        </span>
      </span>
    ),
  },
];

const CARDS = [
  {
    value: "standard",
    label: "Standard",
    hint: "All details",
    picture: (
      <span className="flex h-full flex-col gap-1 rounded border border-gray-300 p-1 dark:border-gray-600">
        <span className="flex-1 rounded-sm bg-gray-300 dark:bg-gray-600" />
        <Bar className="w-2/3" />
        <span className="block h-1.5 rounded-sm bg-accent-500" />
      </span>
    ),
  },
  {
    value: "minimal",
    label: "Minimal",
    hint: "Clean, no border",
    picture: (
      <span className="flex h-full flex-col gap-1">
        <span className="flex-1 rounded bg-gray-300 dark:bg-gray-600" />
        <Bar className="w-2/3" />
        <span className="block h-1.5 rounded-sm bg-accent-500" />
      </span>
    ),
  },
  {
    value: "overlay",
    label: "Overlay",
    hint: "Text on the image",
    picture: (
      <span className="flex h-full flex-col justify-end gap-1 rounded bg-gray-500 p-1">
        <span className="block h-1 w-2/3 rounded-full bg-white/90" />
        <span className="block h-1.5 rounded-sm bg-accent-500" />
      </span>
    ),
  },
];

const GRIDS = ["3", "4", "5"].map((value) => ({
  value,
  label: `${value} per row`,
  hint: value === "4" ? "Default" : value === "3" ? "Bigger cards" : "More products",
  picture: (
    <span className="flex h-full items-center gap-1">
      {Array.from({ length: Number(value) }).map((_, i) => (
        <span key={i} className="h-3/4 flex-1 rounded-sm bg-gray-300 dark:bg-gray-600" />
      ))}
    </span>
  ),
}));

const OptionGroup = ({
  title,
  where,
  options,
  value,
  disabled,
  onChange,
}: {
  title: string;
  where: string;
  options: { value: string; label: string; hint: string; picture: ReactNode }[];
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) => (
  <fieldset>
    <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</legend>
    <p className="mb-2.5 text-xs text-gray-500 dark:text-gray-400">{where}</p>
    <div className="grid grid-cols-3 gap-2">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            aria-label={`${title}: ${option.label}`}
            title={option.hint}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`rounded-xl border p-1.5 text-left transition disabled:cursor-not-allowed ${
              selected
                ? "border-accent-500 bg-accent-50 dark:bg-accent-500/15"
                : "border-gray-200 hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-500"
            }`}
          >
            <span className="block h-14 rounded-lg bg-white p-1 dark:bg-gray-900">{option.picture}</span>
            <span
              className={`mt-1 block px-0.5 text-xs font-medium ${
                selected ? "text-accent-600 dark:text-accent-400" : "text-gray-600 dark:text-gray-400"
              }`}
            >
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  </fieldset>
);

export const DesignStudio = ({
  saved,
  previewUrl,
  canEdit,
  saving,
  onSave,
}: {
  saved: WebsiteDesign;
  previewUrl: string;
  canEdit: boolean;
  saving: boolean;
  onSave: (design: WebsiteDesign) => void;
}) => {
  const [design, setDesign] = useState(saved);
  const savedKey = JSON.stringify(saved);
  useEffect(() => setDesign(JSON.parse(savedKey)), [savedKey]);

  const change = (field: keyof WebsiteDesign) => (value: string) =>
    setDesign((current) => ({ ...current, [field]: value }));
  const changed = JSON.stringify(design) !== savedKey;
  const isDefault = savedKey === JSON.stringify(DEFAULT_DESIGN);

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
      <section className={`${cardClass} space-y-6 p-5 xl:sticky xl:top-24`}>
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white/90">Website design</h3>
          <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            Try a layout and it changes in the preview. Shoppers see it only after you save.
          </p>
        </div>

        <OptionGroup
          title="Banner"
          where="Top of the home page"
          options={BANNERS}
          value={design.bannerLayout}
          disabled={!canEdit}
          onChange={change("bannerLayout")}
        />
        <OptionGroup
          title="Product card"
          where="Home and shop pages"
          options={CARDS}
          value={design.cardLayout}
          disabled={!canEdit}
          onChange={change("cardLayout")}
        />
        <OptionGroup
          title="Product grid"
          where="Large screens. Phones keep 2 per row."
          options={GRIDS}
          value={design.gridColumns}
          disabled={!canEdit}
          onChange={change("gridColumns")}
        />

        {canEdit && (
          <div className="space-y-2">
            <button
              type="button"
              disabled={!changed || saving}
              onClick={() => onSave(design)}
              className={`${primaryButtonClass} h-11 w-full`}
            >
              Save design
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!changed || saving}
                onClick={() => setDesign(saved)}
                className={`${secondaryButtonClass} flex-1`}
              >
                <FiRotateCcw className="size-3.5" /> Discard
              </button>
              {!isDefault && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => onSave(DEFAULT_DESIGN)}
                  className={`${secondaryButtonClass} flex-1`}
                >
                  Use default
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <WebsitePreview
        url={previewUrl}
        message={{
          type: "brand-preview:design",
          banner: design.bannerLayout,
          card: design.cardLayout,
          grid: design.gridColumns,
        }}
      />
    </div>
  );
};

const SellerDesignTab = ({ tenantId }: { tenantId: string }) => {
  const { isSuperadmin } = usePlatformAuth();
  const queryClient = useQueryClient();
  const current = useQuery({
    queryKey: ["platform", "settings", tenantId],
    queryFn: () => settingsApi.get(tenantId),
  });
  const previewUrl = useSellerPreviewUrl(tenantId);

  const save = useMutation({
    mutationFn: (design: WebsiteDesign) => settingsApi.update(tenantId, "general", design),
    onSuccess: () => {
      toast.success("Website design saved");
      queryClient.invalidateQueries({ queryKey: ["platform", "settings", tenantId] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (current.isLoading) {
    return <div className={`${cardClass} h-96 animate-pulse`} aria-busy="true" />;
  }
  if (!current.data)
    return <p className="text-sm text-error-600">Could not load settings</p>;

  const general = current.data.settings.general;
  return (
    <DesignStudio
      saved={{
        bannerLayout: String(general?.bannerLayout ?? DEFAULT_DESIGN.bannerLayout),
        cardLayout: String(general?.cardLayout ?? DEFAULT_DESIGN.cardLayout),
        gridColumns: String(general?.gridColumns ?? DEFAULT_DESIGN.gridColumns),
      }}
      previewUrl={previewUrl}
      canEdit={isSuperadmin}
      saving={save.isPending}
      onSave={(design) => save.mutate(design)}
    />
  );
};

export default SellerDesignTab;
