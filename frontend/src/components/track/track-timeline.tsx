import { CheckIcon, DotIcon } from "@/components/track/track-icons";
import { cn } from "@/lib/cn";
import type { TrackingEvent, TrackingStage } from "@/lib/catalog/order-fixture";
import { STAGE_ORDER } from "@/lib/catalog/order-fixture";

function formatStamp(at?: string) {
  if (!at) return "Pending";
  return new Date(at).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Dhaka",
  });
}

/**
 * A vertical rail: done stages are filled, the live one pulses, the rest sit
 * greyed. The rail segment above each node is coloured by that node's state,
 * so the fill stops exactly at the current stage.
 */
export function TrackTimeline({
  events,
  current,
}: {
  events: TrackingEvent[];
  current: TrackingStage;
}) {
  const currentIndex = STAGE_ORDER.indexOf(current);

  return (
    <ol className="relative">
      {events.map((event, index) => {
        const stageIndex = STAGE_ORDER.indexOf(event.stage);
        const done = stageIndex < currentIndex;
        const live = stageIndex === currentIndex;
        const last = index === events.length - 1;

        return (
          <li key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
            {!last ? (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-8 left-[0.9375rem] h-full w-0.5 rounded-full",
                  done ? "bg-success-solid" : "bg-border-subtle",
                )}
              />
            ) : null}

            <span
              className={cn(
                "relative z-1 flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150",
                done && "border-success-solid bg-success-solid text-white",
                live && "border-brand-500 bg-brand-500 text-on-brand shadow-brand",
                !done && !live && "border-border-default bg-bg-surface text-text-disabled",
              )}
            >
              {live ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 animate-ping rounded-full bg-brand-500 opacity-40"
                />
              ) : null}
              {done ? <CheckIcon className="size-4" /> : <DotIcon className="size-2.5" />}
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p
                  className={cn(
                    "text-small font-semibold",
                    done || live ? "text-text-primary" : "text-text-tertiary",
                  )}
                >
                  {event.label}
                </p>
                <p
                  className={cn(
                    "text-caption tabular",
                    live ? "font-medium text-text-brand" : "text-text-tertiary",
                  )}
                >
                  {formatStamp(event.at)}
                </p>
              </div>
              <p className="mt-0.5 text-caption text-text-secondary">{event.detail}</p>
              <p className="mt-0.5 text-micro text-text-tertiary">{event.location}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
