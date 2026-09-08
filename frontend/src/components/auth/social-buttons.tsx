import { Button } from "@/components/ui/button";
import { AppleIcon, GoogleIcon } from "@/components/ui/icons-auth";

/**
 * The two providers, split off so both the sign-in and sign-up forms stay
 * short. Buttons rather than links: these hand off to an OAuth flow that does
 * not exist yet.
 */
export function SocialButtons() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border-subtle" aria-hidden="true" />
        <span className="text-caption font-medium tracking-wide text-text-tertiary uppercase">
          or
        </span>
        <span className="h-px flex-1 bg-border-subtle" aria-hidden="true" />
      </div>

      <Button variant="secondary" size="lg" icon={<GoogleIcon />} fullWidth>
        Continue with Google
      </Button>
      <Button variant="secondary" size="lg" icon={<AppleIcon />} fullWidth>
        Continue with Apple
      </Button>
    </div>
  );
}
