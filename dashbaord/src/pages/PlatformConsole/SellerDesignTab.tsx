import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiCheck, FiGlobe, FiGrid, FiHome, FiMenu, FiRotateCcw } from "react-icons/fi";
import { errorMessage } from "../../platform/api";
import { settingsApi } from "../../platform/endpoints";
import { usePlatformAuth } from "../../platform/PlatformAuthContext";
import { useSellerPreviewUrl } from "./useSellerPreviewUrl";
import { useStorefrontContent } from "./useStorefrontContent";
import StorefrontPrototype, {
  DEFAULT_DESIGN,
  designFrom,
  STOREFRONT_DEFAULT_COLOR,
  type StoreContent,
  type WebsiteDesign,
} from "./StorefrontPrototype";
import { cardClass, inputClass, primaryButtonClass, secondaryButtonClass } from "./ui";

export type { WebsiteDesign };

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
  {
    value: "buy",
    label: "Buy Now",
    hint: "Add to cart and Buy Now, side by side",
    picture: (
      <span className="flex h-full flex-col gap-1 rounded border border-gray-300 p-1 dark:border-gray-600">
        <span className="flex-1 rounded-sm bg-gray-300 dark:bg-gray-600" />
        <span className="flex gap-0.5">
          <span className="block h-1.5 flex-1 rounded-full bg-gray-800 dark:bg-gray-200" />
          <span className="block h-1.5 flex-1 rounded-full bg-accent-500" />
        </span>
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

const Block = ({ className = "" }: { className?: string }) => (
  <span className={`block rounded-sm bg-gray-300 dark:bg-gray-600 ${className}`} />
);

const CATEGORIES = [
  {
    value: "image",
    label: "Image",
    hint: "Photo with the name on it",
    picture: (
      <span className="flex h-full gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="flex flex-1 flex-col justify-end rounded-sm bg-gray-500 p-0.5">
            <span className="block h-0.5 rounded-full bg-white/90" />
          </span>
        ))}
      </span>
    ),
  },
  {
    value: "round",
    label: "Round",
    hint: "Round photo, name below",
    picture: (
      <span className="flex h-full items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="flex flex-1 flex-col items-center gap-1">
            <span className="block aspect-square w-full rounded-full bg-gray-300 dark:bg-gray-600" />
            <Bar className="w-2/3" />
          </span>
        ))}
      </span>
    ),
  },
  {
    value: "card",
    label: "Card",
    hint: "Round photo in a white card, name below",
    picture: (
      <span className="flex h-full items-stretch gap-1">
        {[0, 1].map((i) => (
          <span
            key={i}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <span className="block size-3 rounded-full bg-gray-300 dark:bg-gray-600" />
            <Bar className="w-1/2" />
          </span>
        ))}
      </span>
    ),
  },
  {
    value: "name",
    label: "Name only",
    hint: "Just the names",
    picture: (
      <span className="flex h-full flex-wrap content-center gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-2.5 w-[45%] rounded-full border border-gray-300 dark:border-gray-600" />
        ))}
      </span>
    ),
  },
];

const GALLERY = [
  {
    value: "left",
    label: "Left",
    hint: "Photos on the left",
    picture: (
      <span className="flex h-full gap-1">
        <Block className="w-1/2" />
        <span className="flex flex-1 flex-col justify-center gap-1"><Bar /><Bar className="w-2/3" /></span>
      </span>
    ),
  },
  {
    value: "right",
    label: "Right",
    hint: "Photos on the right",
    picture: (
      <span className="flex h-full gap-1">
        <span className="flex flex-1 flex-col justify-center gap-1"><Bar /><Bar className="w-2/3" /></span>
        <Block className="w-1/2" />
      </span>
    ),
  },
];

const THUMBS = [
  {
    value: "side",
    label: "Side",
    hint: "Small photos beside the big one",
    picture: (
      <span className="flex h-full gap-1">
        <span className="flex w-1/5 flex-col gap-0.5"><Block className="flex-1" /><Block className="flex-1" /><Block className="flex-1" /></span>
        <Block className="flex-1" />
      </span>
    ),
  },
  {
    value: "bottom",
    label: "Bottom",
    hint: "Small photos under the big one",
    picture: (
      <span className="flex h-full flex-col gap-1">
        <Block className="flex-1" />
        <span className="flex h-1/4 gap-0.5"><Block className="flex-1" /><Block className="flex-1" /><Block className="flex-1" /></span>
      </span>
    ),
  },
];

const FILTERS = [
  {
    value: "left",
    label: "Left",
    hint: "Filters beside the products",
    picture: (
      <span className="flex h-full gap-1">
        <span className="w-1/4 rounded-sm bg-accent-500" />
        <Block className="flex-1" />
      </span>
    ),
  },
  {
    value: "right",
    label: "Right",
    hint: "Filters on the right",
    picture: (
      <span className="flex h-full gap-1">
        <Block className="flex-1" />
        <span className="w-1/4 rounded-sm bg-accent-500" />
      </span>
    ),
  },
  {
    value: "popup",
    label: "Popup",
    hint: "A Filters button, products use the full width",
    picture: (
      <span className="flex h-full flex-col gap-1">
        <span className="h-1.5 w-1/3 rounded-sm bg-accent-500" />
        <Block className="flex-1" />
      </span>
    ),
  },
];

const FOOTERS = [
  {
    value: "full",
    label: "Full",
    hint: "Newsletter, links and contact",
    picture: (
      <span className="flex h-full flex-col justify-end gap-1">
        <Bar className="w-1/2" />
        <span className="flex gap-1"><Block className="h-4 flex-1" /><Block className="h-4 flex-1" /><Block className="h-4 flex-1" /></span>
      </span>
    ),
  },
  {
    value: "compact",
    label: "Compact",
    hint: "Payment methods and copyright only",
    picture: (
      <span className="flex h-full flex-col justify-end">
        <Block className="h-2" />
      </span>
    ),
  },
];

const BUTTONS = [
  {
    value: "solid",
    label: "Solid",
    hint: "Filled, with a soft shadow",
    picture: <span className="flex h-full items-center"><span className="h-5 w-full rounded bg-accent-500 shadow-md" /></span>,
  },
  {
    value: "flat",
    label: "Flat",
    hint: "Filled, no shadow",
    picture: <span className="flex h-full items-center"><span className="h-5 w-full rounded bg-accent-500" /></span>,
  },
  {
    value: "outline",
    label: "Outline",
    hint: "Border only, fills on hover",
    picture: <span className="flex h-full items-center"><span className="h-5 w-full rounded border-2 border-accent-500" /></span>,
  },
];

const menuPicture = (band: string, pill = "bg-accent-500") => (
  <span className="flex h-full items-center">
    <span className={`flex h-5 w-full items-center gap-1 rounded-sm px-1 ${band}`}>
      <span className={`h-2.5 w-1/3 rounded-full ${pill}`} />
      <span className="h-1 w-1/4 rounded-full bg-gray-400" />
    </span>
  </span>
);

const MENU_COLORS = [
  { value: "sunken", label: "Soft", hint: "Light tint", picture: menuPicture("bg-gray-100 dark:bg-white/5") },
  { value: "surface", label: "White", hint: "Same as the header", picture: menuPicture("border border-gray-200 bg-white dark:border-gray-700") },
  { value: "brand", label: "Color", hint: "The website color", picture: menuPicture("bg-accent-500", "bg-white/40") },
  { value: "inverse", label: "Dark", hint: "Dark band", picture: menuPicture("bg-gray-800") },
];

const MENU_ALIGN = [
  {
    value: "left",
    label: "Left",
    hint: "Menu starts at the left",
    picture: <span className="flex h-full items-center gap-1"><Bar className="w-1/5" /><Bar className="w-1/5" /><Bar className="w-1/5" /></span>,
  },
  {
    value: "center",
    label: "Center",
    hint: "Menu in the middle",
    picture: <span className="flex h-full items-center justify-center gap-1"><Bar className="w-1/5" /><Bar className="w-1/5" /><Bar className="w-1/5" /></span>,
  },
];

const ANNOUNCEMENT_MAX = 120;

// One group of choices, set apart by a hairline
const OptionSection = ({
  icon,
  title,
  text,
  children,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  children: ReactNode;
}) => (
  <section aria-label={title} className="space-y-4 border-t border-gray-100 pt-5 first:border-t-0 first:pt-0 dark:border-gray-800">
    <div className="flex items-center gap-2.5">
      <span className="shrink-0 text-gray-400 dark:text-gray-500 [&>svg]:size-4" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-gray-900 dark:text-white/90">{title}</span>
        <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{text}</span>
      </span>
    </div>
    {children}
  </section>
);

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
    <legend className="text-[13px] font-medium text-gray-800 dark:text-gray-200">{title}</legend>
    <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">{where}</p>
    <div className={`grid gap-2 ${options.length === 4 ? "grid-cols-4" : options.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
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
            className={`group relative rounded-lg border p-1 text-center outline-none transition focus-visible:ring-2 focus-visible:ring-accent-500/30 disabled:cursor-not-allowed ${
              selected
                ? "border-accent-500 ring-1 ring-accent-500"
                : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
            }`}
          >
            <span className="block h-11 rounded-md bg-gray-50 p-1 dark:bg-white/5">{option.picture}</span>
            <span
              className={`block truncate py-1 text-[11px] font-medium ${
                selected ? "text-accent-600 dark:text-accent-400" : "text-gray-600 dark:text-gray-400"
              }`}
            >
              {option.label}
            </span>
            {selected && (
              <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-accent-500 text-white" aria-hidden="true">
                <FiCheck className="size-2.5" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  </fieldset>
);

export const DesignStudio = ({
  saved,
  color,
  content,
  previewUrl,
  canEdit,
  saving,
  onSave,
}: {
  saved: WebsiteDesign;
  color: string;
  content?: StoreContent;
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
      <section className={`${cardClass} flex flex-col overflow-hidden xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)]`}>
        <div className="border-b border-gray-100 p-5 dark:border-gray-800">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white/90">Website design</h3>
          <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            Try a layout and see it in the preview. Shoppers see it after you save.
          </p>
        </div>
        {/* No scrollbar to look at, so the fade is what says more waits below */}
        <div className="no-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto p-5 [mask-image:linear-gradient(to_bottom,black_calc(100%-28px),transparent)]">
          <OptionSection icon={<FiMenu />} title="Header" text="Announcement bar and menu">
          <fieldset>
            <legend className="sr-only">Announcement bar</legend>
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span>
                <span className="block text-[13px] font-medium text-gray-800 dark:text-gray-200">Announcement bar</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">Above the header, on every shopping page</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                aria-label="Show the bar"
                className="peer sr-only"
                checked={design.announcementEnabled === "on"}
                disabled={!canEdit}
                onChange={(e) => change("announcementEnabled")(e.target.checked ? "on" : "off")}
              />
              <span
                aria-hidden="true"
                className="relative h-5 w-9 shrink-0 rounded-full bg-gray-200 transition peer-checked:bg-accent-500 dark:bg-gray-700 dark:peer-checked:bg-accent-500 peer-focus-visible:ring-2 peer-focus-visible:ring-accent-500/30 after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:after:translate-x-4"
              />
            </label>
            <input
              aria-label="Announcement text"
              className={`${inputClass} mt-2`}
              placeholder="Free delivery on orders over ৳2,000"
              maxLength={ANNOUNCEMENT_MAX}
              value={design.announcementText}
              readOnly={!canEdit}
              onChange={(e) => change("announcementText")(e.target.value)}
            />
            {design.announcementEnabled === "on" && !design.announcementText.trim() && (
              <p className="mt-1 text-xs text-warning-600 dark:text-warning-400">Add some text, or the bar stays hidden.</p>
            )}
          </fieldset>
          <OptionGroup title="Menu color" where="The menu row under the header" options={MENU_COLORS} value={design.menuColor} disabled={!canEdit} onChange={change("menuColor")} />
          <OptionGroup title="Menu position" where="Large screens" options={MENU_ALIGN} value={design.menuAlign} disabled={!canEdit} onChange={change("menuAlign")} />

          </OptionSection>
          <OptionSection icon={<FiHome />} title="Home page" text="Banner and category cards">
          <OptionGroup title="Banner" where="Top of the home page" options={BANNERS} value={design.bannerLayout} disabled={!canEdit} onChange={change("bannerLayout")} />
          <OptionGroup title="Category card" where="Shop by category, on the home page" options={CATEGORIES} value={design.categoryLayout} disabled={!canEdit} onChange={change("categoryLayout")} />

          </OptionSection>
          <OptionSection icon={<FiGrid />} title="Products" text="Cards, grid and product page">
          <OptionGroup title="Product card" where="Home and Shop pages" options={CARDS} value={design.cardLayout} disabled={!canEdit} onChange={change("cardLayout")} />
          <OptionGroup title="Product grid" where="Large screens. Phones keep 2 per row." options={GRIDS} value={design.gridColumns} disabled={!canEdit} onChange={change("gridColumns")} />
          <OptionGroup title="Shop filters" where="Shop page, large screens" options={FILTERS} value={design.filterLayout} disabled={!canEdit} onChange={change("filterLayout")} />
          <OptionGroup title="Product gallery" where="Product page, large screens" options={GALLERY} value={design.galleryPosition} disabled={!canEdit} onChange={change("galleryPosition")} />
          <OptionGroup title="Thumbnails" where="Product page, when it has several photos" options={THUMBS} value={design.thumbnailPosition} disabled={!canEdit} onChange={change("thumbnailPosition")} />

          </OptionSection>
          <OptionSection icon={<FiGlobe />} title="Whole website" text="Buttons and footer">
          <OptionGroup title="Buttons" where="Every page, cart and checkout too" options={BUTTONS} value={design.buttonStyle} disabled={!canEdit} onChange={change("buttonStyle")} />
          <OptionGroup title="Footer" where="Bottom of every shopping page" options={FOOTERS} value={design.footerLayout} disabled={!canEdit} onChange={change("footerLayout")} />
          </OptionSection>
        </div>

        {canEdit && (
          <div className="space-y-2 border-t border-gray-100 p-4 dark:border-gray-800">
            <button
              type="button"
              disabled={!changed || saving}
              onClick={() => onSave({ ...design, announcementText: design.announcementText.trim() })}
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

      <StorefrontPrototype url={previewUrl} color={color} design={design} content={content} />
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
  const content = useStorefrontContent(tenantId);

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
      saved={designFrom(general)}
      color={String(general?.primaryColor || STOREFRONT_DEFAULT_COLOR)}
      content={content}
      previewUrl={previewUrl}
      canEdit={isSuperadmin}
      saving={save.isPending}
      onSave={(design) => save.mutate(design)}
    />
  );
};

export default SellerDesignTab;
