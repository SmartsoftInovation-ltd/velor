---
name: action-buttons
description: Use when adding, editing, or reviewing action buttons (Print/View/Edit/Toggle/Delete) inside any table row (desktop grid row or mobile card) in the Baig Digital dashboard (`dashbaord/`). Triggers on requests like "add action buttons", "make the action buttons like X", "fix the toggle color", "make buttons white with 4px radius". This is the current house style — supersedes any older `rounded-2xl` / border-only toggle pattern seen in older tables.
version: 1.0.0
---

# Action Buttons — Baig Digital Dashboard

The exact button style used in the Supplier Payment table (`dashbaord/src/components/tables/SupplierTable/SupplierPayementTable.tsx`). Apply this to every table's action column — desktop row and mobile card — so all lists look identical.

## Rules

- **Radius**: `rounded` (4px) on every action button. Never `rounded-xl`/`rounded-2xl`/`rounded-full` for these.
- **Background**:
  - Neutral actions (Print, View, Edit, Delete-icon-only): **white** background (`bg-white dark:bg-gray-900`) with a light border (`border border-gray-200 dark:border-gray-700`). Icon color is muted gray, with a colored hover tint per action.
  - **Toggle (Active/Deactivate) only**: solid color, no border, white icon —
    - Active (currently on) → **green** (`bg-green-500 hover:bg-green-600`)
    - Inactive (currently off) → **red** (`bg-red-500 hover:bg-red-600`)
- **Size**: `size-8` on desktop rows, `size-10` (`max-md:size-11`) on mobile cards.
- **Icon size**: `size-3.5`–`size-4` on desktop, `size-4`–`size-5` on mobile.
- Wrap every desktop button in the project's `Tooltip` (portal-based, see the table-list skill) — mobile cards skip tooltips (no hover on touch).
- Buttons sit in a `flex items-center gap-1.5` (desktop) / `flex items-center gap-2` (mobile) row, right-aligned or centered depending on the column.

## Desktop row — reference markup

```tsx
<div className="px-3 flex items-center justify-center gap-1.5">
  <Tooltip text="Print">
    <button
      onClick={() => navigate(`/x-print/${item._id}`)}
      className="size-8 flex items-center justify-center rounded bg-white border border-gray-200 dark:border-gray-700 dark:bg-gray-900 text-gray-500 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"
    >
      <IoIosPrint className="size-3.5" />
    </button>
  </Tooltip>

  <Tooltip text="Edit">
    <button
      onClick={() => navigate(`/x-edit/${item._id}`)}
      className="size-8 flex items-center justify-center rounded bg-white border border-gray-200 dark:border-gray-700 dark:bg-gray-900 text-gray-500 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors"
    >
      <FaEdit className="size-3.5" />
    </button>
  </Tooltip>

  <Tooltip text={item.isActive ? "Deactivate" : "Activate"}>
    <button
      onClick={() => { setSelectedItem(item); setShowToggleModal(true); }}
      className={`size-8 flex items-center justify-center rounded text-white transition-colors ${
        item.isActive ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"
      }`}
    >
      {item.isActive ? <FaToggleOn className="size-4" /> : <FaToggleOff className="size-4" />}
    </button>
  </Tooltip>

  <Tooltip text="Delete">
    <button
      onClick={() => { setSelectedItem(item); setShowDeleteModal(true); }}
      className="size-8 flex items-center justify-center rounded bg-white border border-gray-200 dark:border-gray-700 dark:bg-gray-900 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
    >
      <MdDelete className="size-4" />
    </button>
  </Tooltip>
</div>
```

## Mobile card — reference markup

```tsx
<div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-gray-100 dark:border-white/[0.05]">
  <button
    onClick={() => navigate(`/x-print/${item._id}`)}
    className="max-md:size-11 size-10 p-0 flex items-center justify-center rounded bg-white border border-gray-200 dark:border-gray-700 dark:bg-gray-900 text-gray-500 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"
  >
    <IoIosPrint className="size-4" />
  </button>

  <button
    onClick={() => navigate(`/x-edit/${item._id}`)}
    className="max-md:size-11 size-10 p-0 flex items-center justify-center rounded bg-white border border-gray-200 dark:border-gray-700 dark:bg-gray-900 text-gray-500 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors"
  >
    <FaEdit className="size-4" />
  </button>

  <button
    onClick={() => { setSelectedItem(item); setShowToggleModal(true); }}
    className={`max-md:size-11 size-10 p-0 flex items-center justify-center rounded text-white transition-colors ${
      item.isActive ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"
    }`}
  >
    {item.isActive ? <FaToggleOn className="size-5" /> : <FaToggleOff className="size-5" />}
  </button>

  <button
    onClick={() => { setSelectedItem(item); setShowDeleteModal(true); }}
    className="max-md:size-11 size-10 p-0 flex items-center justify-center rounded bg-white border border-gray-200 dark:border-gray-700 dark:bg-gray-900 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
  >
    <MdDelete className="size-4" />
  </button>
</div>
```

## Per-action hover-tint reference

| Action | Icon color | Hover tint |
|---|---|---|
| Print | `text-gray-500` | `hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10` |
| View | `text-gray-500` | `hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10` |
| Edit | `text-gray-500` | `hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10` |
| Delete | `text-red-500` | `hover:bg-red-50 dark:hover:bg-red-500/10` |
| Toggle (on) | white (solid green bg) | `hover:bg-green-600` |
| Toggle (off) | white (solid red bg) | `hover:bg-red-600` |

## What NOT to do

- Do not use `rounded-2xl`, `rounded-xl`, or `rounded-full` — always `rounded` (4px).
- Do not leave the toggle button as text-color-only / transparent background — it must be a solid green or red fill.
- Do not fill Print/View/Edit/Delete with solid brand/red backgrounds — those stay white with a border; only the icon or a hover tint carries color.
- Do not skip the border on the white buttons — without it they disappear against a white table row in light mode.

## Checklist before shipping an action column

- [ ] Every button is `rounded` (4px), never a larger radius
- [ ] Print/View/Edit/Delete are white background + border, colored icon/hover only
- [ ] Toggle is solid `bg-green-500` when active, solid `bg-red-500` when inactive — white icon
- [ ] Desktop uses `size-8`; mobile uses `size-10` (`max-md:size-11`)
- [ ] Desktop buttons wrapped in the portal `Tooltip`; mobile buttons are not
- [ ] Dark mode covered: `dark:bg-gray-900`, `dark:border-gray-700` on white buttons
