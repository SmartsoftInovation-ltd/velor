import { Button } from "@/components/ui/button";
import { BadgeSamples } from "./badges";
import {
  ArrowRightIcon,
  CartIcon,
  CompareIcon,
  HeartIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Panel, Section, TokenName } from "./section";

export function Buttons() {
  return (
    <Section
      title="Buttons"
      description="Four intents, three sizes, one shape. Every variant carries a real background — a control that only appears on hover reads as text, not as something clickable. Hovering sweeps a soft highlight across the fill."
    >
      <Panel className="space-y-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" icon={<CartIcon />}>
              Add to cart
            </Button>
            <Button variant="secondary" icon={<HeartIcon />}>
              Save for later
            </Button>
            <Button variant="subtle" icon={<CompareIcon />}>
              Compare
            </Button>
            <Button variant="danger" icon={<TrashIcon />}>
              Remove
            </Button>
            <Button variant="primary" icon={<CartIcon />} disabled>
              Sold out
            </Button>
          </div>
          <TokenName>primary · secondary · subtle · danger · disabled</TokenName>
        </div>

        <div className="space-y-3 border-t border-border-subtle pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" icon={<CartIcon />}>
              Small
            </Button>
            <Button size="md" icon={<CartIcon />}>
              Medium
            </Button>
            <Button size="lg" icon={<CartIcon />}>
              Large
            </Button>
            <Button variant="secondary" iconEnd={<ArrowRightIcon />}>
              Continue
            </Button>
          </div>
          <TokenName>h-8 / h-10 / h-12 · icon · iconEnd</TokenName>
        </div>

        <div className="space-y-3 border-t border-border-subtle pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" aria-label="Add to cart" icon={<CartIcon />} />
            <Button
              variant="secondary"
              aria-label="Save to wishlist"
              icon={<HeartIcon />}
            />
            <Button variant="subtle" aria-label="Compare" icon={<CompareIcon />} />
            <Button
              variant="danger"
              size="lg"
              aria-label="Remove"
              icon={<TrashIcon />}
            />
          </div>
          <TokenName>Icon-only — square, aria-label required</TokenName>
        </div>
      </Panel>
    </Section>
  );
}

export function FormControls() {
  return (
    <Section
      title="Inputs & badges"
      description="Focus is a single 1px brand border that swaps in place — no outline, no glow. The control never changes size, so a focused field never nudges the row it sits in."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="ds-email"
              className="text-small font-medium text-text-secondary"
            >
              Email
            </label>
            <Input id="ds-email" type="email" placeholder="you@example.com" />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="ds-search"
              className="text-small font-medium text-text-secondary"
            >
              With icon
            </label>
            <Input id="ds-search" placeholder="Search products" icon={<CompareIcon />} />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="ds-disabled"
              className="text-small font-medium text-text-secondary"
            >
              Disabled
            </label>
            <Input id="ds-disabled" placeholder="Unavailable" disabled />
          </div>
          <TokenName>focus: 1px border-brand, no outline</TokenName>
        </Panel>

        <BadgeSamples />
      </div>
    </Section>
  );
}
