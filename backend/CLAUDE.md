# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # start with nodemon (development)
npm start            # same as dev
npm run build        # deploy via pm2 (production)
npm run worker:image # start image upload worker (separate process)
npm run seed:permissions
npm run seed:roles
npm run seed:delivery
# The store staff seeder takes credentials as flags, so its password is never stored
npm run superAdmin -- --email you@example.com --password '…'          # store staff superadmin
npm run seed:platform-admin       # platform operator, from PLATFORM_ADMIN_* in .env
#   add --reset to seed:platform-admin to apply a changed PLATFORM_ADMIN_PASSWORD
```

```bash
npm test             # Jest: unit + integration (in-memory MongoDB replica set, local Redis for the app boot test)
npm run test:watch
```

Tests never load the real `.env` (`dotenv` is mocked in `jest.config.js`).

## Multi-tenancy

Implemented; build notes and production cutover checklist in `../docs/multitenant-sprints.md`. Every business model applies `src/tenancy/tenantPlugin.js`; queries are scoped to the tenant set with `runForTenant()` (`src/tenancy/context.js`). New models must apply the plugin or be listed in `src/tenancy/registry.js` — a test enforces this. `TENANCY_MODE=strict` (what `.env` ships) makes a query without a tenant context throw; `shadow` leaves it unscoped and exists only for migration work. There is no default store — every request names its store with the `x-tenant` header.


## Environment Variables

Required: `DATABASE_URL`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SCCERET` (note the typo — used as-is in the codebase), `REDIS_URL`, `PORT`, `NODE_ENV`, `FRONTEND_URL`, `DASHBOARD_URL`, Cloudinary credentials (`CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`), SSLCommerz keys, courier API credentials.

## v2 Migration Plan

`zCommerce-v2-Architecture.md` documents a planned major refactor. Key schema changes:
- `variant.model.js` becomes an **embedded subdocument inside Product** (currently a separate collection with its own `_id` and `slug`).
- `subcategory.model.js` is replaced by a self-referential `Category` (`parent: null` = root).
- New models: `FlashSale`, `AttributeDefinition`, merged `Banner`.
- `discount.model.js` gets production-grade multi-level targeting (variant → product → brand → category → global priority cascade).

The current `src/models/` reflects v1. Do not implement v2 schema changes without confirming the migration is in scope.

