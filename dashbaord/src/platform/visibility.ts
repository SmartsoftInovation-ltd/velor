// The Platform Console link appears in the sidebar only for the owner of a
// workspace listed in VITE_PLATFORM_WORKSPACES; empty lists none, so no seller
// ever sees it. This only hides the link: the console itself is guarded by the
// separate platform sign-in (PlatformGate), whatever the store.

export const platformWorkspaces = (raw: string | undefined): string[] =>
  (raw || "")
    .split(",")
    .map((slug) => slug.trim().toLowerCase())
    .filter(Boolean);

export const canSeePlatformConsole = ({
  workspace,
  isOwner,
  allowed,
}: {
  workspace: string | null;
  isOwner: boolean;
  allowed: string[];
}) => isOwner && Boolean(workspace) && allowed.includes((workspace as string).toLowerCase());

export const PLATFORM_WORKSPACES = platformWorkspaces(import.meta.env.VITE_PLATFORM_WORKSPACES);
