interface RoleLike {
  _id: string;
  slug: string;
  name: string;
}

// The owner role is assigned by the platform only; never offer it in role pickers
const OWNER_SLUGS = ["owner", "superadmin"];

export const assignableRoles = <T extends RoleLike>(roles: T[] | undefined | null): T[] =>
  (roles || []).filter((role) => !OWNER_SLUGS.includes(role.slug));
