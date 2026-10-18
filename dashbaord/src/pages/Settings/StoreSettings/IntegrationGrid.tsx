import { useCallback, useEffect, useRef, useState } from "react";
import { FiX } from "react-icons/fi";
import { TbAppWindow, TbLayoutSidebarRight } from "react-icons/tb";
import type { Features } from "../../../context/AuthContext";
import IntegrationForm from "./IntegrationForm";
import { GROUP_ORDER, INTEGRATIONS } from "./integrationMeta";
import type { SectionSchema, SectionValues, TestResult } from "./types";
import { scopedStorageKey } from "../../../lib/session";

const card =
  "rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]";

export const StatusPill = ({ connected }: { connected: boolean }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
      connected
        ? "bg-accent-50 text-accent-700 ring-1 ring-inset ring-accent-500/20 dark:bg-accent-500/15 dark:text-accent-400"
        : "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400"
    }`}
  >
    <span
      className={`size-1.5 rounded-full ${connected ? "bg-accent-500" : "bg-gray-400"}`}
    />
    {connected ? "Connected" : "Not connected"}
  </span>
);

export type PanelLayout = "drawer" | "modal";
// Per store: a preference, but one store's choice should not follow the browser
// into another store's settings screen.
const layoutKey = () => scopedStorageKey("integrationPanelLayout");

const readLayout = (): PanelLayout => {
  try {
    return localStorage.getItem(layoutKey()) === "modal" ? "modal" : "drawer";
  } catch {
    return "drawer";
  }
};

// Configuration form of one integration, as a right-side drawer or a centered modal
const IntegrationPanel = ({
  section,
  connected,
  layout,
  onLayoutChange,
  onClose,
  children,
}: {
  section: SectionSchema;
  connected: boolean;
  layout: PanelLayout;
  onLayoutChange: (layout: PanelLayout) => void;
  onClose: () => void;
  children: React.ReactNode;
}) => {
  const isModal = layout === "modal";
  const meta = INTEGRATIONS[section.key];
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div
      className={`fixed inset-0 z-99999 flex ${isModal ? "items-center justify-center p-4" : "justify-end"}`}
    >
      <div
        className="animate-fade-in absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${meta?.title ?? section.key} settings`}
        data-layout={layout}
        className={`relative flex w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-gray-900 ${
          isModal
            ? "animate-modal-in h-[min(88vh,820px)] max-w-2xl rounded-3xl"
            : "animate-drawer-in h-full max-w-xl sm:m-3 sm:h-[calc(100%-1.5rem)] sm:rounded-3xl"
        }`}
      >
        <header className="relative shrink-0 overflow-hidden border-b border-gray-100 bg-gradient-to-br from-accent-50 via-white to-white px-6 py-6 dark:border-gray-800 dark:from-accent-500/10 dark:via-gray-900 dark:to-gray-900">
          <div className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-accent-500/10 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(15,157,99,0.10)_1px,transparent_1px)] [background-size:16px_16px] [mask-image:linear-gradient(to_left,black,transparent_70%)]" />
          <div className="relative flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white text-xl text-accent-600 shadow-theme-sm ring-1 ring-accent-100 dark:bg-gray-800 dark:text-accent-400 dark:ring-accent-500/20">
              {meta?.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-accent-700 dark:text-accent-400">
                  {meta?.group}
                </span>
                <StatusPill connected={connected} />
              </div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-gray-900 dark:text-white/90">
                {meta?.title ?? section.key}
              </h2>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                {meta?.description}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => onLayoutChange(isModal ? "drawer" : "modal")}
                aria-label={isModal ? "Open as drawer" : "Open as modal"}
                title={isModal ? "Open as drawer" : "Open as modal"}
                className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white/80 text-gray-500 backdrop-blur transition hover:bg-white hover:text-accent-600 dark:border-gray-700 dark:bg-gray-800/80 dark:hover:text-accent-400"
              >
                {isModal ? (
                  <TbLayoutSidebarRight className="size-4" />
                ) : (
                  <TbAppWindow className="size-4" />
                )}
              </button>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white/80 text-gray-500 backdrop-blur transition hover:bg-white hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800/80 dark:hover:text-white"
              >
                <FiX className="size-4" />
              </button>
            </div>
          </div>
        </header>
        <div className="min-h-0 flex-1">{children}</div>
      </section>
    </div>
  );
};

interface IntegrationGridProps {
  schema: SectionSchema[];
  settings: Record<string, SectionValues>;
  features: Features;
  canManage: boolean;
  onSave: (
    section: SectionSchema,
    patch: Record<string, unknown>,
  ) => Promise<void>;
  onTest: (section: SectionSchema) => Promise<TestResult>;
}

// Integration cards (4 per row) with a side panel to configure one. Used by the
// Platform Console store detail (Sellers → a seller).
const IntegrationGrid = ({
  schema,
  settings,
  features,
  canManage,
  onSave,
  onTest,
}: IntegrationGridProps) => {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [layout, setLayout] = useState<PanelLayout>(readLayout);
  const changeLayout = useCallback((next: PanelLayout) => {
    setLayout(next);
    try {
      localStorage.setItem(layoutKey(), next);
    } catch {
      // storage unavailable: the choice lasts for this page only
    }
  }, []);
  const closePanel = useCallback(() => setOpenKey(null), []);

  const sections = schema.filter((section) => INTEGRATIONS[section.key]);
  const openSection = sections.find((section) => section.key === openKey);
  const data = { features };

  return (
    <>
      {/* Integrations: 4 per row on wide screens, ordered by group */}
      <section aria-labelledby="integrations-heading">
        <h3
          id="integrations-heading"
          className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
        >
          Integrations
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...sections]
            .sort(
              (a, b) =>
                GROUP_ORDER.indexOf(INTEGRATIONS[a.key].group) -
                GROUP_ORDER.indexOf(INTEGRATIONS[b.key].group),
            )
            .map((section) => {
              const meta = INTEGRATIONS[section.key];
              const connected = meta.connected(data.features);
              return (
                <article
                  key={section.key}
                  aria-label={meta.title}
                  className={`${card} flex flex-col p-5 transition hover:shadow-theme-md`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-gray-100 text-lg text-gray-600 dark:bg-white/5 dark:text-gray-300">
                      {meta.icon}
                    </span>
                    <StatusPill connected={connected} />
                  </div>
                  <p className="mt-4 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    {meta.group}
                  </p>
                  <h4 className="text-base font-semibold text-gray-800 dark:text-white/90">
                    {meta.title}
                  </h4>
                  <p className="mt-1 flex-1 text-sm text-gray-500 dark:text-gray-400">
                    {meta.description}
                  </p>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => setOpenKey(section.key)}
                      className={`mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                        connected
                          ? "border border-accent-200 bg-accent-50 text-accent-700 hover:bg-accent-100 dark:border-accent-500/30 dark:bg-accent-500/10 dark:text-accent-400 dark:hover:bg-accent-500/20"
                          : "bg-accent-500 text-white shadow-[0_1px_2px_rgba(15,157,99,0.35)] hover:bg-accent-600"
                      }`}
                    >
                      {connected ? "Configure" : "Configure & connect"}
                    </button>
                  )}
                </article>
              );
            })}
        </div>
      </section>

      {openSection && (
        <IntegrationPanel
          section={openSection}
          connected={INTEGRATIONS[openSection.key].connected(features)}
          layout={layout}
          onLayoutChange={changeLayout}
          onClose={closePanel}
        >
          <IntegrationForm
            key={`${openSection.key}-${version}`}
            schema={openSection}
            values={settings[openSection.key] || {}}
            canEdit={canManage}
            onSave={async (patch) => {
              await onSave(openSection, patch);
              setVersion((v) => v + 1);
            }}
            onTest={() => onTest(openSection)}
          />
        </IntegrationPanel>
      )}
    </>
  );
};

export const countConnected = (schema: SectionSchema[], features: Features) =>
  schema.filter((section) => INTEGRATIONS[section.key]?.connected(features))
    .length;

export default IntegrationGrid;
