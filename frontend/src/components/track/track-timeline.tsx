import { CheckIcon, DotIcon } from "@/components/track/track-icons";
import { cn } from "@/lib/cn";
import { STAGES, type TrackingStage } from "@/lib/track-order";

function formatStamp(at: string | undefined, reached: boolean) {
  if (!at) return reached ? "Done" : "Pending";
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
  current,
  placedAt,
  updatedAt,
}: {
  current: TrackingStage;
  placedAt: string;
  /** When the order reached `current`; the shop keeps no time for the stages between */
  updatedAt: string;
}) {
  const currentIndex = STAGES.findIndex((s) => s.stage === current);
  // Delivered is the end: it reads as done, not as a stage still running
  const finished = current === "delivered";
  const events = STAGES.map((s, index) => ({
    ...s,
    id: s.stage,
    at: index === 0 ? placedAt : index === currentIndex ? updatedAt : undefined,
  }));

  return (
    <ol className="relative">
      {events.map((event, index) => {
        const done = index < currentIndex || (finished && index === currentIndex);
        const live = index === currentIndex && !finished;
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
                  {formatStamp(event.at, done || live)}
                </p>
              </div>
              <p className="mt-0.5 text-caption text-text-secondary">{event.detail}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
