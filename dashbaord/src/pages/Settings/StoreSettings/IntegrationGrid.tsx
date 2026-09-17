import { useCallback, useEffect, useRef, useState } from "react";
import { FiX } from "react-icons/fi";
import type { Features } from "../../../context/AuthContext";
import IntegrationForm from "./IntegrationForm";
import { GROUP_ORDER, INTEGRATIONS } from "./integrationMeta";
import type { SectionSchema, SectionValues, TestResult } from "./types";

const card = "rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]";

export const StatusPill = ({ connected }: { connected: boolean }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
      connected
        ? "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400"
        : "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400"
    }`}
  >
    <span className={`size-1.5 rounded-full ${connected ? "bg-success-500" : "bg-gray-400"}`} />
    {connected ? "Connected" : "Not connected"}
  </span>
);

// Right-side panel with the configuration form of one integration
const IntegrationPanel = ({ section, onClose, children }: { section: SectionSchema; onClose: () => void; children: React.ReactNode }) => {
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
    <div className="fixed inset-0 z-99999 flex justify-end">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${meta?.title ?? section.key} settings`}
        className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl dark:bg-gray-900"
      >
        <header className="flex items-start gap-3 border-b border-gray-200 px-6 py-5 dark:border-gray-800">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-lg text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            {meta?.icon}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">{meta?.title ?? section.key}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{meta?.description}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 dark:hover:bg-white/5"
          >
            <FiX className="size-5" />
          </button>
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
  onSave: (section: SectionSchema, patch: Record<string, unknown>) => Promise<void>;
  onTest: (section: SectionSchema) => Promise<TestResult>;
}

// Integration cards (4 per row) with a side panel to configure one. Used by the
// store's own Store Settings page and by the Platform Console store detail.
const IntegrationGrid = ({ schema, settings, features, canManage, onSave, onTest }: IntegrationGridProps) => {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const closePanel = useCallback(() => setOpenKey(null), []);

  const sections = schema.filter((section) => INTEGRATIONS[section.key]);
  const openSection = sections.find((section) => section.key === openKey);
  const data = { features };

  return (
    <>
      {/* Integrations: 4 per row on wide screens, ordered by group */}
      <section aria-labelledby="integrations-heading">
        <h3 id="integrations-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Integrations
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...sections]
            .sort((a, b) => GROUP_ORDER.indexOf(INTEGRATIONS[a.key].group) - GROUP_ORDER.indexOf(INTEGRATIONS[b.key].group))
            .map((section) => {
              const meta = INTEGRATIONS[section.key];
              const connected = meta.connected(data.features);
              return (
                <article key={section.key} aria-label={meta.title} className={`${card} flex flex-col p-5 transition hover:shadow-theme-md`}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-gray-100 text-lg text-gray-600 dark:bg-white/5 dark:text-gray-300">
                      {meta.icon}
                    </span>
                    <StatusPill connected={connected} />
                  </div>
                  <p className="mt-4 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">{meta.group}</p>
                  <h4 className="text-base font-semibold text-gray-800 dark:text-white/90">{meta.title}</h4>
                  <p className="mt-1 flex-1 text-sm text-gray-500 dark:text-gray-400">{meta.description}</p>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => setOpenKey(section.key)}
                      className={`mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                        connected
                          ? "border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
                          : "bg-brand-500 text-white hover:bg-brand-600"
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
        <IntegrationPanel section={openSection} onClose={closePanel}>
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
  schema.filter((section) => INTEGRATIONS[section.key]?.connected(features)).length;

export default IntegrationGrid;
