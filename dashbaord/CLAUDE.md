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
npm test           # Vitest + Testing Library (jsdom)
npm run test:watch
```

## Environment

Create a `.env` file in the root (it is gitignored):

```
VITE_API_URL=http://<backend-host>/api/v1
VITE_SOCKET_URL=http://<backend-host>
VITE_STOREFRONT_PREVIEW_URL=     # local storefront for the console's Website Color preview, e.g. http://localhost:3001; empty = the seller's own domain (the storefront needs DASHBOARD_URL set to accept colors)
VITE_PLATFORM_WORKSPACES=        # platform workspace(s) whose owner sees Platform Console in the sidebar; empty = none (operators open /platform directly)
```

## Multi-tenancy

One build serves every store. Sign-in asks for a **workspace** (store slug, remembered in localStorage, or `?workspace=` deep link); `useAxiosSecure` sends it as `x-tenant` on every request. `AuthContext` exposes `tenant`, `features` (which integrations the platform configured), `isOwner` and `can()` built from the API's effective permissions. Wrap pages that need an integration in `FeatureGate`. **Platform Console** (sidebar module: Sellers, Store Settings, Operators) is visible only to the **owner** of a workspace in `VITE_PLATFORM_WORKSPACES`; sellers get every other module and find Store Settings under Settings. Console pages sit behind `PlatformGate`: a platform operator signs in with email + password (`POST /platform/auth/login`, which returns an OTP challenge only), then verifies the 6-digit SMS code (`POST /platform/auth/verify-otp`) to get a platform token (own axios instance in `src/platform/api.ts`, localStorage). That sign-in happens once: when the token is gone or expired the gate trades the refresh cookie (`POST /platform/auth/refresh`, 7 days, path-scoped to `/platform/auth`) for a new one, so returning to the console asks for nothing. "Sign out of the console" in the header user dropdown is what ends it; the dashboard session no longer does, and a dead store token never redirects away from `/platform/*` (`useAxiosSecure.tsx`). Each operator has their own phone, and the sign-in code is texted to it (`PLATFORM_ADMIN_PHONE` only covers accounts saved before operators had one). An operator edits their own name, email, phone and password at `/platform/profile` (`PATCH /platform/auth/me`, support role included — the superadmin-only `/platform/users` routes are for managing other operators). There is no access code and no client-side secret; the workspace allowlist in `visibility.ts` only controls sidebar visibility. Console UI kit: `src/pages/PlatformConsole/ui.tsx`, accent color tokens `accent-*` (`#0F9D63`). Per-store local drafts use `scopedStorageKey()` (`src/lib/session.ts`); sign-out clears the query cache, the store's drafts and the socket.

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

Singleton `socket.io-client` instance authenticated with the access token (server rooms per store). Call `initSocket()` once to connect and `getSocket()` anywhere else; `disconnectSocket()` runs on sign-out. URL from `VITE_SOCKET_URL`.

### Contexts

- `ThemeContext` — `"light"` / `"dark"` toggled and persisted in `localStorage`
- `SidebarContext` — sidebar expanded/hover/mobile-open state

### Styling

Tailwind CSS v4 (via `@tailwindcss/postcss`). Dark mode uses the `dark` class on `<html>`. Use `tailwind-merge` (`twMerge` / `clsx`) for conditional class composition.

### Redesign style

The app is moving from the old blue button look (`#DCE8FF` / `#1D4ED8`) to the Platform Console accent green (`accent-*`, `#0F9D63`). When asked to redesign or restyle any page, follow `.claude/rules/ui-redesign.md`: primary, secondary and destructive button colors, soft per-action row buttons (view gray, edit amber, toggle green/gray, delete red, 4px radius), the status pill, the serial ID column, the sidebar rail and the `shine` hover sweep. The Category module is the finished reference.
