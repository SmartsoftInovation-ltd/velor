import { Button } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";

/**
 * Presentation only — the field is not wired to a mailing list yet, so the
 * form has no action and the button does not submit.
 */
export function FooterNewsletter() {
  return (
    <div className="grid gap-6 border-b border-border-subtle py-10 lg:grid-cols-2 lg:items-center lg:gap-12">
      <div className="space-y-1.5">
        <h2 className="text-h3 font-semibold tracking-tight text-text-primary">
          Get the drop before it sells out
        </h2>
        <p className="text-small text-text-secondary">
          New arrivals, restocks and member-only offers. One email a week, no noise.
        </p>
      </div>

      <div className="flex w-full max-w-md gap-2 lg:ml-auto">
        <Input
          type="email"
          aria-label="Email address"
          placeholder="you@example.com"
          className="flex-1"
        />
        <Button variant="primary" iconEnd={<ArrowRightIcon />}>
          Subscribe
        </Button>
      </div>
    </div>
  );
}
