# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Baig Digital ecommerce Admin Dashboard — a React 19 + TypeScript SPA built with Vite. It is a multi-domain ERP-style dashboard covering orders, products, inventory, purchasing, accounting, employees, couriers, and more.

## Commands

```bash
npm run dev        # Start dev server (Vite)
npm run build      # Type-check then build (tsc -b && vite build)
npm run lint       # ESLint
npm run preview    # Serve the dist/ build
```

There is no test suite configured.

## Environment

Create a `.env` file in the root (it is gitignored):

```
VITE_API_URL=http://<backend-host>/api/v1
```

`useAxiosSecure` (`src/hooks/useAxiosSecure.tsx`) creates a shared Axios instance using this URL with `withCredentials: true`. It intercepts 401 responses, attempts a token refresh at `/auth/refresh-token`, and redirects to `/signin` on failure.

## Architecture

### Entry & Providers (`src/main.tsx`)

Providers wrap the app in this order: `QueryClientProvider` (TanStack Query) → `ThemeProvider` → `AppWrapper` (react-helmet-async).

### Routing (`src/App.tsx`)

All routes are defined here with `React.lazy` + `Suspense`. Every authenticated route is nested inside:

```
<ProtectedRoute>        ← checks localStorage for "accessToken"
  <AppLayout />         ← sidebar + header shell
    <Outlet />          ← page content
```

Public routes (`/signin`, `/signup`) live outside `ProtectedRoute`.

### Layout (`src/layout/`)

- `AppLayout` — wraps `SidebarProvider`, renders `AppSidebar`, `Backdrop`, `AppHeader`, and the main `<Outlet>`
- Sidebar width toggles between 232px (expanded/hovered) and 72px (collapsed) via `SidebarContext`

### Pages vs Components split

- `src/pages/<Domain>/` — thin page wrappers (title, breadcrumbs, layout card)
- `src/components/<domain>/` — actual form and list logic
- `src/components/tables/<Domain>Table/` — domain-specific table components
- `src/components/reports/` — report filter forms; corresponding result views live in `src/components/tables/ReportTable/`

### Auth

`accessToken` is stored in `localStorage`. `ProtectedRoute` redirects to `/signin` if absent. The Axios interceptor auto-refreshes using an httpOnly cookie (`withCredentials: true`).

### Icons (`src/icons/`)

SVGs are imported as React components via `vite-plugin-svgr` (named export `ReactComponent`). All icons are re-exported from `src/icons/index.ts` — import icons from there, not directly from SVG files.

### Real-time (`src/socket/socket.ts`)

Singleton `socket.io-client` instance. Call `initSocket()` once to connect and `getSocket()` anywhere else. The socket URL is currently hardcoded to `http://localhost:3000`.

### Contexts

- `ThemeContext` — `"light"` / `"dark"` toggled and persisted in `localStorage`
- `SidebarContext` — sidebar expanded/hover/mobile-open state

### Styling

Tailwind CSS v4 (via `@tailwindcss/postcss`). Dark mode uses the `dark` class on `<html>`. Use `tailwind-merge` (`twMerge` / `clsx`) for conditional class composition.
