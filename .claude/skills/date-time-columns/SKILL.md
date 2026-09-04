---
name: date-time-columns
description: Use when adding, editing, or reviewing any date column (Date, Created At, Updated At, etc.) inside a table row (desktop grid row or mobile card) in the Baig Digital dashboard (`dashbaord/`). Triggers on requests like "add a date column", "show the time too", "add created at column", "time should be under the date". Every date column shows date and time stacked, time includes seconds and AM/PM.
version: 1.0.0
---

# Date/Time Columns — Baig Digital Dashboard

Every date-type column (Date, Created At, Updated At, etc.) in any table — desktop row or mobile card — shows **date on top, time stacked directly underneath**. Never date-only, and never date/time on the same line.

## Rules

- **Stack, don't inline**: date and time are two separate lines (`block` spans), time under date — not `"04 Sep 2026, 03:45:12 PM"` on one line.
- **Time always includes seconds and AM/PM**: `hh:mm:ss A` — never omit seconds, never 24-hour format.
- **Date format**: `DD MMM YYYY` (e.g. `04 Sep 2026`).
- **Styling**: date line is the primary text color/weight for that column; time line is smaller and muted (`text-[11px]` / `text-xs`, `text-gray-400 dark:text-gray-500`).
- Apply to **every** date field shown in a table — `date`, `createdAt`, `updatedAt` — each gets its own stacked date+time, not just one of them.
- Missing/invalid dates render as `—`, never a JS `Invalid Date` string or a blank cell for the date line (the time line can be empty).

## Which formatter to use

This codebase has two acceptable formatter approaches depending on what the file already imports — don't introduce the other one into a file that already picked one:

- If the file already imports `moment` (e.g. `PurchaseTable.tsx`), use `moment(value).format("DD MMM YYYY")` and `moment(value).format("hh:mm:ss A")`.
- If the file has no `moment` import (e.g. `SupplierPayementTable.tsx`), use the native `Date` helpers below rather than adding a new `moment` import just for this.

### Native `Date` helpers (no `moment` dependency)

```tsx
const formatDate = (dateStr?: string): string => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (dateStr?: string): string => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
};
```

### `moment` equivalent

```tsx
moment(value).format("DD MMM YYYY");   // date line
moment(value).format("hh:mm:ss A");    // time line
```

## Desktop row — reference markup

```tsx
<div className="px-3">
  <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
    {formatDate(item.date)}
  </p>
  <p className="text-[11px] text-gray-400 dark:text-gray-500">
    {formatTime(item.date)}
  </p>
</div>
```

## Mobile card — reference markup

Use with the project's `MobileCardRow` (children accept `React.ReactNode`, so pass stacked spans instead of a plain string):

```tsx
<MobileCardRow label="Date">
  <span className="block">{formatDate(item.date)}</span>
  <span className="block text-xs text-gray-400 dark:text-gray-500">
    {formatTime(item.date)}
  </span>
</MobileCardRow>
```

## Adding a Created At (or similar) column

1. Confirm the backend model has `timestamps: true` and the read endpoint isn't a `$project`/aggregate stage that drops `createdAt` — many list endpoints in this backend use an aggregate pipeline with an explicit `$project`, and `createdAt` is easy to leave out. Add `createdAt: 1` there if missing.
2. Add the field to the row's TypeScript interface: `createdAt?: string;`.
3. Add a header label ("Created At") to the `COLUMNS` array and a matching track to `gridTemplateColumns` (a data column, so `1fr` — see the table-list skill's grid rules).
4. Render it with the same stacked date+time block as every other date column, in both the desktop row and the mobile card.

## Column width note

A date+time stacked cell needs more horizontal room than a bare date — when adding time to an existing date-only column (or adding a new date column), give it enough width in `gridTemplateColumns` that the time line (`hh:mm:ss A`, ~11 characters) doesn't wrap or get clipped. Don't leave it at whatever width was sized for a date-only line.

## Checklist before shipping a date/time column

- [ ] Date and time are stacked (two lines), not inlined on one line
- [ ] Time format is `hh:mm:ss A` — seconds and AM/PM both present
- [ ] Time line is visually secondary (smaller, muted) vs. the date line
- [ ] Applied to both desktop row and mobile card
- [ ] Applied to every date field in the row, not just one
- [ ] Missing dates show `—`, not `Invalid Date` or a crash
- [ ] `createdAt` (or whichever field) actually reaches the frontend — check for a `$project` stage on the backend that might be dropping it
- [ ] Column width in `gridTemplateColumns` was widened to fit the time line
