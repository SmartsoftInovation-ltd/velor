# Platform Console

Operator app for the multi-tenant platform: create stores (with owner account), assign each store's integration settings (SMS, email, SSLCommerz, couriers, Cloudinary, Groq) with live connection tests, suspend/activate stores, read webhook URLs and audit history, manage the permission catalog and operator accounts.

## Commands

```bash
npm install
npm run dev        # http://localhost:5174
npm test           # Vitest + Testing Library
npm run build      # tsc -b && vite build -> dist/
```

## Environment

```
VITE_API_URL=https://api.<domain>/api/v1/platform
```

The backend must allow this origin (`PLATFORM_URL`) and have `PLATFORM_ACCESS_TOKEN_SECRET` / `PLATFORM_REFRESH_TOKEN_SECRET` set. Create the first operator with `npm run seed:platform-admin` in `backend/`.

## Notes

- Access token in `sessionStorage`; refresh token is an httpOnly cookie scoped to `/api/v1/platform/auth`.
- Settings forms are generated from `GET /settings/schema`. Secret fields are write-only: blank keeps the stored value, "Clear stored value" sends `null`.
- `support` operators get a read-only console; `superadmin` can change everything.
- Serve `dist/` behind an IP allowlist (see `docs/dashboard-backend-multitenant-architecture.md` §1).
