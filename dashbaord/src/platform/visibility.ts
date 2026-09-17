// The Platform Console belongs to the platform's own store: only the owner of a
// workspace listed in VITE_PLATFORM_WORKSPACES sees it. Sellers get every other
// module. The API enforces the same rule on /platform/auth/console-access.

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
