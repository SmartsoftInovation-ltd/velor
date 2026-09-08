# Spec — authentication screens

Status: **UI only.** Every form on these routes is static markup — no `action`,
no validation, no session. This document is the handoff for the backend work;
do not implement it here.

## Routes

All five live in the `(auth)` route group, so they share no URL segment:

| Route | Screen |
| --- | --- |
| `/sign-in` | Email + password, remember-me, social providers |
| `/sign-up` | Name, email, phone, password, terms consent |
| `/forgot-password` | Email, requests a reset code |
| `/verify-otp` | 6-digit code, 5-minute validity window |
| `/reset-password` | New password + confirmation |

## Expected endpoints

Shapes only — none of these exist yet.

### `POST /api/auth/sign-in`
```jsonc
// request
{ "email": "you@example.com", "password": "…", "remember": true }
// 200
{ "user": { "id": "u_1", "name": "Taufik Islam", "email": "…" } }
// 401
{ "error": "invalid_credentials" }
```
Sets an httpOnly session cookie. `remember` extends its lifetime to 30 days.

### `POST /api/auth/sign-up`
```jsonc
// request
{ "firstName": "…", "lastName": "…", "email": "…", "phone": "…", "password": "…" }
// 201
{ "user": { "id": "u_1", … }, "verificationRequired": true }
// 409
{ "error": "email_taken" }
```

### `POST /api/auth/forgot-password`
```jsonc
{ "email": "you@example.com" }
// 202 — always, whether or not the address exists
{ "expiresInSeconds": 300 }
```
Always 202: a different response for an unknown address tells an attacker which
emails are registered.

### `POST /api/auth/verify-otp`
```jsonc
{ "email": "…", "code": "123456" }
// 200
{ "resetToken": "…" }        // short-lived, single use
// 400
{ "error": "invalid_code" | "expired_code" }
```
The code is valid for **300 seconds**, which is what the on-screen countdown
shows. Resend issues a new code and restarts that window.

### `POST /api/auth/reset-password`
```jsonc
{ "resetToken": "…", "password": "…" }
// 204
// 400
{ "error": "invalid_token" | "weak_password" | "password_reused" }
```

## Rules for whoever wires this up

- **Validate on the server.** The client-side hints (8 characters, one number)
  are convenience, never a control.
- **Rate-limit** `forgot-password` and `verify-otp` per email and per IP.
  Six digits is 10^6 — brute force is the obvious attack.
- **Never return the code** in any response body, log line, or error.
- Reads stay in Server Components; writes go through Server Actions in
  `src/lib/actions/`, not hand-rolled route handlers, unless a non-browser
  client needs the endpoint.
