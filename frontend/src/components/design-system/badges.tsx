import { Badge, StatusDot } from "@/components/ui/badge";
import { CartIcon, TrashIcon } from "@/components/ui/icons";
import { Panel, TokenName } from "./section";

const TONES = ["neutral", "brand", "success", "danger", "warning", "info"] as const;

const LABELS: Record<(typeof TONES)[number], string> = {
  neutral: "SKU 001",
  brand: "30% OFF",
  success: "Free shipping",
  danger: "Sold out",
  warning: "Low stock",
  info: "Pre-order",
};

const VARIANTS = [
  ["subtle", "the default, for quiet chips on a card"],
  ["solid", "for badges over imagery, where a tint is lost"],
  ["outline", "for dense rows, where six fills would shout"],
] as const;

/** The badge half of the Inputs & badges section. */
export function BadgeSamples() {
  return (
    <Panel className="space-y-5">
      {VARIANTS.map(([variant, note]) => (
        <div key={variant} className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {TONES.map((tone) => (
              <Badge key={tone} tone={tone} variant={variant}>
                {LABELS[tone]}
              </Badge>
            ))}
          </div>
          <TokenName>
            {variant} &mdash; {note}
          </TokenName>
        </div>
      ))}

      <div className="space-y-2 border-t border-border-subtle pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge size="sm" tone="brand" variant="solid">
            30% OFF
          </Badge>
          <Badge size="md" tone="brand" variant="solid">
            30% OFF
          </Badge>
          <Badge tone="success" icon={<CartIcon />}>
            Free shipping
          </Badge>
          <Badge tone="danger" variant="outline" icon={<TrashIcon />}>
            Removed
          </Badge>
        </div>
        <TokenName>h-5 / h-6 · icon — the same API as Button</TokenName>
      </div>

      <div className="space-y-2 border-t border-border-subtle pt-4">
        <div className="flex flex-wrap gap-4">
          <StatusDot tone="success">In stock</StatusDot>
          <StatusDot tone="warning">Only 3 left</StatusDot>
          <StatusDot tone="danger">Out of stock</StatusDot>
          <StatusDot tone="info">Pre-order</StatusDot>
          <StatusDot tone="neutral">Discontinued</StatusDot>
        </div>
        <TokenName>StatusDot — no fill, reads as text</TokenName>
      </div>
    </Panel>
  );
}
