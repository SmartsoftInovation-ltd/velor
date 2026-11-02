# ShoPzio Design System

A modern ecommerce design system: Geist, a warm neutral ramp, and one brand
orange carried over from the original Figma file.

Live reference: `/design-system` (`npm run dev`).

---

## 1. The one rule

**Components never touch a raw value.** No hex codes, no `sand-500`, no
`text-[13px]`. A component asks for `bg-surface` or `text-secondary`; the token
layer decides what that means under the current theme.

```
Primitive  →  Semantic  →  Tailwind utility  →  Component
--brand-500   --color-brand-500   bg-brand-500     <button className="bg-brand-500">
```

- **Store color:** a seller's `primaryColor`, set in the Platform Console, replaces the
  `--brand-*` ramp at render time (`src/lib/brand-theme.ts`). So never hardcode a brand
  value, and put `text-on-brand`, not `text-white`, on a brand fill: a light store color
  needs dark text.
- **Primitives** (`--brand-500`, `--sand-700`) are raw values, defined once in
  `globals.css` and referenced only by the semantic layer. Never used directly.
- **Semantics** (`--color-bg-surface`, `--color-text-secondary`) carry meaning,
  not appearance. These are what you use.

Break the rule in one component and that component stops following the theme.

---

## 2. What carried over, and what did not

`#FC630A` is the only value kept from the original Figma file. Everything
around it was rebuilt: the typeface, the type scale, the neutral ramp, radius,
elevation, motion, and a full dark theme the file never had.

The old system used Poppins with pill buttons and a Trello-ish grey. This one
uses Geist, 8px button corners, and a warm neutral — the change is deliberate,
not a port.

---

## 3. Two decisions worth knowing

**The neutral ramp is warm, not grey.** Every step from `--sand-0` to
`--sand-1000` carries a trace of the brand hue. A pure grey makes orange read
cold and slightly dirty next to it; a warm neutral makes the two look like one
family. This is the single most load-bearing choice in the palette — if you
swap the brand hue, re-tint the neutrals to match.

**The brand ramp inverts in dark mode.** `--color-brand-100` points at a deep
shade under `[data-theme="dark"]`, so `brand-100` is *always* the quiet tint and
`brand-800` *always* the loud one. Write `bg-brand-100` once and it reads
correctly in both themes — never reach for a `dark:` variant on a brand step.

---

## 4. Theming

Dark mode is driven by `[data-theme]` on `<html>` — deliberately not
`prefers-color-scheme`, so an explicit choice beats the OS setting.

1. **`@custom-variant dark`** binds Tailwind's `dark:` prefix to the attribute.
2. **`@theme inline`** — the `inline` matters. Utilities resolve the variable at
   use-site, so flipping the attribute re-themes the page with no CSS
   regeneration and no re-render.
3. **An inline script in `layout.tsx`** applies the stored theme before first
   paint, preventing a white flash. It must stay synchronous and inline.
   `<html>` carries `suppressHydrationWarning` because that script necessarily
   makes the server HTML and the live DOM differ on this one element.

Only the mappings change between themes; token names are identical in both.

---

## 5. Tokens

### Brand

`brand-50` … `brand-900` around `#FC630A`. `brand-500` is the primary.
Supporting tokens: `text-brand`, `border-brand`, `shadow-brand`.

Note `text-brand` maps to `orange-600` in light and `orange-400` in dark — the
darker shades fail contrast on a dark ground.

### Surfaces

| Token | Use |
|---|---|
| `bg-canvas` | The page behind everything |
| `bg-surface` | Cards, panels — the default content plane |
| `bg-elevated` | Menus, popovers, modals |
| `bg-sunken` | Wells, inputs, quiet fills |
| `bg-hover` / `bg-active` | Interaction states |
| `bg-inverse` | Inverted blocks |

### Text

`text-primary` (headings, body) · `text-secondary` (supporting copy) ·
`text-tertiary` (meta, captions) · `text-disabled` · `text-inverse` ·
`text-brand`.

### Borders

`border-subtle` (dividers) · `border-default` (cards, inputs) ·
`border-strong` (emphasis, hover) · `border-brand` (focus, selection).

### Status

Four states, each a trio:

- `*-subtle` — tint for backgrounds
- `*-solid` — dots, bars, filled buttons
- `*-text` — foreground, clears 4.5:1 **on its own tint**

`success` · `danger` · `warning` · `info`.

Pair `-text` only with its matching `-subtle`. `text-danger-text` on
`bg-surface` is not a contrast-checked combination.

### Type scale

Geist, eight steps. Line-height and letter-spacing are bound to each step, so a
size change never needs a matching `leading-` or `tracking-` utility.

| Token | Size | Line height | Tracking |
|---|---|---|---|
| `text-display` | 40px | 1.1 | -0.03em |
| `text-h1` | 32px | 1.15 | -0.02em |
| `text-h2` | 24px | 1.25 | -0.02em |
| `text-h3` | 19px | 1.3 | -0.01em |
| `text-body` | 15px | 1.6 | — |
| `text-small` | 13px | 1.5 | — |
| `text-caption` | 12px | 1.4 | — |
| `text-micro` | 11px | 1.4 | +0.02em |

Weights: 400 / 500 / 600. There is no 700 — semibold is the heaviest step.

Add `.tabular` to prices, quantities and any column of figures. Without it,
proportional digits make numbers jitter as they change.

### Radius

Radius climbs with the size of the surface.

`rounded-xs` 4px · `rounded-sm` 6px (badges) · `rounded-md` 8px (buttons,
inputs) · `rounded-lg` 12px (cards) · `rounded-xl` 16px (modals) ·
`rounded-full` (avatars, dots).

### Elevation

`shadow-xs` → `shadow-xl`, plus `shadow-brand` for the primary button.

Shadows are tinted with the **neutral** hue — never the brand, and never pure
black. A brand-coloured shadow reads as a glow and muddies the edge it sits
under; pure black over a warm surface reads as dirty grey. `shadow-brand` is
simply one step deeper than `shadow-sm`, in the same neutral hue. Under dark
they go deeper and tighter rather than disappearing.

### Motion

`ease-out` `cubic-bezier(0.16, 1, 0.3, 1)` — default, most transitions
`ease-in-out` — symmetrical movement
`ease-spring` — playful overshoot, use sparingly

Duration: `duration-150` for state changes, `duration-200` for movement.
`prefers-reduced-motion` is honoured globally in `globals.css`.

### Spacing

Tailwind's 4px base grid. In practice `1 2 3 4 6 8` carry almost every layout.
Sticking to these is what makes unrelated components line up without anyone
measuring.

---

## 6. Components

Three primitives live in `src/components/ui/` and are meant to be used, not
copied:

- **`Button`** — 4 variants (`primary`, `secondary`, `subtle`, `danger`),
  3 sizes, `fullWidth`, `icon` / `iconEnd`. Shared 8px radius, 150ms ease-out,
  press-scale, and a shine sweep on hover.

  **Every variant carries a real background.** There is no transparent or ghost
  button: a control that only appears on hover reads as text, not as something
  clickable. `subtle` is the quietest step and still sits on `bg-sunken`.

  Omit `children` and the button becomes a square icon-only control — pass
  `aria-label`, which is then required.

- **`AppImage`** — the only image component. See §6.1.
- **`Badge`** — 6 tones × 3 variants × 2 sizes, plus `icon`. Deliberately the
  same API shape as `Button`, so the two are learned once:

  | Variant | Use |
  |---|---|
  | `subtle` | The default — quiet chips on a card |
  | `solid` | Over imagery, where a tint would be lost |
  | `outline` | Dense rows, where six fills would shout |

  Heights (`h-5` / `h-6`) match the two smallest button steps, so a badge lines
  up beside a small button without adjustment.

- **`StatusDot`** — a coloured dot plus label. Shares Badge's tone names and
  type sizes but carries no fill, so it reads as text and can sit inline in a
  card body without competing with a real badge.
- **`Input`** — same radius and border tokens as a secondary button, so form
  rows and button rows align without adjustment.

### 6.1 Images

`AppImage` wraps `next/image` and fixes the house rules in one place:

| Rule | How |
|---|---|
| Full quality | `quality={100}`, hard-coded, backed by a `qualities: [100]` allowlist in `next.config.ts` |
| Lazy by default | `loading="lazy"` unless overridden |
| Fallback | `onError` swaps to `/image-fallback.svg` |

- **Never write a raw `<img>`.** ESLint fails the build on it
  (`@next/next/no-img-element`). Raw tags skip optimisation, lazy loading and
  layout-shift protection.
- **`alt` is required.** Decorative image? `alt=""`, never omitted.
- **Always give `width` + `height`, or `fill` inside a positioned parent.**
  Missing dimensions cause layout shift.
- **With `fill`, always set `sizes`** — without it the browser downloads the
  largest candidate.
- **Aspect ratio is preserved**: fixed dimensions keep the intrinsic ratio;
  inside a `fill` well use `object-contain` so art is never distorted.
- **Above-the-fold hero only:** `loading="eager"` plus `preload`. In Next 16
  `priority` is deprecated.
- **Remote images need a `remotePatterns` entry** in `next.config.ts`. Do not
  reach for `unoptimized`.

`AppImage` is a Client Component only because `onError` is a function prop and
cannot cross the RSC boundary. It is a leaf — importing it does **not** make the
importing page a Client Component.

### 6.2 Motion

`.shine` parks a gradient band off the left edge of a control and sweeps it
across on hover. It is transform-only, so it never triggers layout. On a
light-surfaced control add `.shine-dark` — a white band is invisible there.

Both are switched off under `prefers-reduced-motion`.

### Focus

A single **1px brand border** — no outline, no glow ring. `globals.css` draws it
as a `box-shadow` ring on `:focus-visible`, which means it never shifts layout
the way a real border would; inputs swap their own border colour in place, so a
focused field never nudges the row it sits in.

Do not add per-component focus styles. Overriding this fragments keyboard
navigation.

### File size

`max-lines` in `eslint.config.mjs` fails the build past **150 lines** per file
(blank lines and comments excluded). It is a smell detector, not a formatting
rule: when a file approaches it, extract a sibling component — do not get under
the cap by deleting comments.

### Class names

Compose them as **complete strings**. Tailwind scans source text, so an
interpolated `bg-brand-${step}` generates no CSS at all — the class silently
does nothing. Write the full string, or map over an array of full strings.

---

## 7. Layout

```
src/
  app/
    globals.css              Tokens. The whole system lives here.
    layout.tsx               Geist + no-flash theme script
    page.tsx                 → redirects to /design-system
    design-system/page.tsx   The reference page
    board/[slug]/page.tsx    Placeholder shop route
  components/
    ui/                      Real primitives — use these
      app-image.tsx  button.tsx  badge.tsx  input.tsx
      icons.tsx      theme-toggle.tsx
    design-system/           Reference sections (delete with the route)
      section.tsx            Section + TokenName + Panel
      typography.tsx  palette.tsx  surfaces.tsx
      badges.tsx      elevation.tsx    spacing.tsx
      media.tsx       board-preview.tsx
public/
  image-fallback.svg       Shown when a source fails
  products/                Placeholder product art
  lib/cn.ts
```

`components/design-system/` is reference material — delete it and the
`/design-system` route once the real UI lands. `globals.css` and
`components/ui/` are what ship.

---

## 8. Adding a token

1. Add the primitive under `:root` in `globals.css`.
2. Map a semantic name to it in **both** `:root` and `[data-theme="dark"]`.
3. Expose it in `@theme inline`.

Miss step 2 and the token silently keeps its light value in dark mode — no
error, just a wrong colour. Miss step 3 and no utility is generated.
