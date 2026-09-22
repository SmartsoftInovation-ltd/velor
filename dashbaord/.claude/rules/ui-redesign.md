# UI redesign style (accent green)

Apply this style whenever asked to "redesign", "restyle", "migrate the color" or "make it look like the Platform Console" for any page, form, list or table. The Category module (`src/components/tables/CategoryTable/CategoryTable.tsx`, `src/components/category/*`, `src/pages/Category/CategoryList.tsx`, `CreateCategory.tsx`, `CategoryView.tsx`) is the finished reference: copy its classes instead of inventing new ones.

## Color tokens

- Use the `accent-*` scale from `src/index.css` (`accent-500` = `#0F9D63`, the Platform Console green). Never add new hex colors.
- Remove the old blue look everywhere you touch: `bg-[#DCE8FF]`, `hover:bg-[#C7DAFF]`, `text-[#1D4ED8]`, `border-[#1D4ED8]`, and `brand-*` on buttons, focus rings and active states.
- Soft tones use the `-50` background, `-600` text, `-100` hover, plus dark variants `dark:bg-<c>-500/15 dark:text-<c>-400 dark:hover:bg-<c>-500/25`.

## Buttons

`src/components/ui/button/Button.tsx` has a blue base look (`bg-[#DCE8FF]`) and `rounded-md`. Class order does not reliably override it, so **prefix overriding color and radius classes with `!`** (`!bg-accent-500`, `!rounded`) whenever the base look could win.

| Button | Classes |
|---|---|
| Primary (Create, Save, Update, Submit, Edit on a view page, confirm Activate/Deactivate) | `bg-accent-500 hover:bg-accent-600 text-white` (use `!` variants on `Button`), `font-semibold` |
| Refresh / secondary icon button in page header | `!border-accent-100 !bg-accent-50 hover:!bg-accent-100 !text-accent-600 dark:!border-accent-500/20 dark:!bg-accent-500/15 dark:!text-accent-400` |
| Destructive confirm ("Yes, Delete") | `bg-error-500 hover:bg-error-600 text-white` |
| Spinner inside a solid button | `border-white/30 border-t-white` |

Every `Button` already gets the hover shine sweep (`shine` utility, see below). Do not remove it.

## Row action buttons (tables and mobile cards)

Icon-only, `size-10 p-0 !rounded border-none transition-all active:scale-90` (4px radius), soft tone per action:

| Action | Classes |
|---|---|
| View | `!bg-gray-100 !text-gray-600 hover:!bg-gray-200 hover:!text-gray-900 dark:!bg-white/5 dark:!text-gray-400 dark:hover:!bg-white/10` |
| Edit | `!bg-warning-50 !text-warning-600 hover:!bg-warning-100 hover:!text-warning-700 dark:!bg-warning-500/15 dark:!text-warning-400 dark:hover:!bg-warning-500/25` |
| Toggle, active | `!bg-accent-50 !text-accent-600 hover:!bg-accent-100 dark:!bg-accent-500/15 dark:!text-accent-400 dark:hover:!bg-accent-500/25` |
| Toggle, inactive | `!bg-gray-100 !text-gray-400 hover:!bg-gray-200 hover:!text-gray-500 dark:!bg-white/5 dark:!text-gray-500 dark:hover:!bg-white/10` |
| Delete | `!bg-error-50 !text-error-600 hover:!bg-error-100 dark:!bg-error-500/15 dark:!text-error-400 dark:hover:!bg-error-500/25` |

Mobile cards add `max-md:size-11` to the same buttons.

## Status and serial in lists

- Status: the pill from the Platform Console seller list (`StatusPill` in `CategoryTable.tsx`): `rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset`, accent tone with a pulsing `bg-accent-500` dot for Active, error tone with a `bg-error-500` dot for Inactive. Do not use the solid `Badge` for status.
- Serial column: header "Serial ID", value in `rounded-md bg-accent-50 px-2 py-0.5 font-mono text-xs font-semibold text-accent-700 dark:bg-accent-500/15 dark:text-accent-400`; fall back to `#<index>` when the record has no serial.
- A module without a serial gets one the way supplier, purchase and category do: a `<module>SerialId` field set in a `post("save")` hook from a `Counter` key (`<MODULE>_SERIAL`) as `<PREFIX>-${await getInvoicePrefix()}-NN`, plus a per-tenant backfill migration in `backend/src/migrations/` that also calls `bumpNsVersion("<namespace>")` so cached lists refresh.

## Inputs

Search inputs and fields: `focus:ring-accent-500/20`, icon `group-focus-within:text-accent-500`.

## Sidebar (already done, keep it)

- Active and hover states use `accent-*` (`menu-item-*` and `menu-dropdown-item-*` utilities in `src/index.css`).
- Submenus render through `RailList` in `src/layout/AppSidebar.tsx`: no dots; one 3px green bar sits on the gray rail and slides (0.5s ease-in-out) to the active item. Keep the list `pl-2` gap.

## Shine sweep

`shine` utility in `src/index.css`: a white streak sweeps across on hover, 0.8s by default (`--shine-duration`; `Button` sets `[--shine-duration:0.45s]` so buttons sweep faster than sidebar items), dimmer in dark mode and off for reduced motion. It is built into `Button`, `menu-item` and `menu-dropdown-item`. Add `shine` to any other clickable element that should match (plain `<button>` or `<Link>` styled as a button).
