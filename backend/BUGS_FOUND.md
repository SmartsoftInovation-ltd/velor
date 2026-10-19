# Bugs found by the Phase 1 test suite

Every entry has a test that reproduces it, kept in the suite and marked
`test.failing` with the bug id in its name. When a bug is fixed, its test starts
passing, Jest reports the `test.failing` as a failure, and the marker must be
removed (for matrix cases: delete the line in `tests/contract/knownFailures.js`).

Severity: **Critical** (data loss, cross-tenant access, money wrong at scale) ·
**High** (wrong money/stock figures, auth bypass inside a store) · **Medium**
(wrong status, broken feature, client-controlled data) · **Low** (cosmetic, wrong
error code on an edge case).

**74 bugs** — Critical 5, High 26, Medium 26, Low 17.

| Severity | Id | Summary | Test |
|---|---|---|---|
| Critical | BUG-012 | ~~Admin password change stores the password in plain text~~ **Fixed** | `integration/auth.routes.test.js` |
| Critical | BUG-018 | A sales return can take back more units than were sold | `integration/salesReturn.routes.test.js` |
| Critical | BUG-019 | A product that is not on the sale is refunded at the client's price | `integration/salesReturn.routes.test.js` |
| Critical | BUG-046 | Marking an order "Delivered" puts its stock back | `integration/commerce.routes.test.js` |
| Critical | BUG-065 | Prototype pollution through bracketed form-field names | `unit/utils.test.js` |
| High | BUG-008 | Delete-user and the permission endpoints return the password hash | `integration/auth.routes.test.js` |
| High | BUG-009 | `POST /auth/add-user` lets a user manager grant any permission | `integration/auth.routes.test.js` |
| High | BUG-010 | Login by email fails when another account has no phone | `integration/auth.routes.test.js` |
| High | BUG-011 | Login accepts query operators in email/phone | `integration/auth.routes.test.js` |
| High | BUG-014 | A sale overwrites the customer's due with the client's `balance` | `integration/sales.routes.test.js` |
| High | BUG-020 | A return against a pending/draft sale adds stock that never left | `integration/salesReturn.routes.test.js` |
| High | BUG-021 | A sales-return refund never leaves the refund account | `integration/salesReturn.routes.test.js` |
| High | BUG-024 | Editing a sales return always fails with 500 | `integration/salesReturn.routes.test.js` |
| High | BUG-025 | Concurrent purchases / returns fail with 500 on write conflicts | `integration/purchase.routes.test.js` |
| High | BUG-026 | A purchase quantity sent as a string corrupts stock | `integration/purchase.routes.test.js` |
| High | BUG-033 | Parallel stock adjustments lose updates | `integration/stockAdjust.routes.test.js` |
| High | BUG-035 | Public product endpoints publish every product's cost price | `integration/product.routes.test.js` |
| High | BUG-043 | A checkout that sells out half-way loses stock | `integration/commerce.routes.test.js` |
| High | BUG-044 | A coupon's usage limit is not enforced under concurrency | `integration/commerce.routes.test.js` |
| High | BUG-045 | Staff "create order" always fails | `integration/commerce.routes.test.js` |
| High | BUG-047 | Order status changes have no transition rules | `integration/commerce.routes.test.js` |
| High | BUG-048 | SSLCommerz IPN never checks the paid amount | `integration/commerce.routes.test.js` |
| High | BUG-052 | Deleting a customer payment does not restore the due | `integration/customer.routes.test.js` |
| High | BUG-058 | A money transfer never moves money | `integration/finance.routes.test.js` |
| High | BUG-067 | A new sale may carry "return" lines that add stock | `integration/salesIntegrity.test.js` |
| High | BUG-068 | Editing a sale after a return moves stock by twice the quantity | `integration/salesIntegrity.test.js` |
| High | BUG-069 | Sale edits are mass-assigned (`$set: req.body`) | `integration/salesIntegrity.test.js` |
| High | BUG-070 | Changing the advance used on a sale is never applied, but deleting credits it back | `integration/salesIntegrity.test.js` |
| High | BUG-071 | A signed-in shopper sees cost prices on the catalogue | `integration/salesIntegrity.test.js` |
| High | BUG-072 | Supplier payments: not transactional, and delete keeps the due cut | `integration/salesIntegrity.test.js` |
| High | BUG-073 | Every Steadfast booking fails after Steadfast accepts it | `integration/courier.test.js` |
| Medium | BUG-001 | Joi validation errors answer 500 instead of 400 | `contract/routeMatrix.test.js` |
| Medium | BUG-002 | Department/section create: `customError` arguments swapped | `contract/routeMatrix.test.js` |
| Medium | BUG-004 | Pathao city/zone/area lookups use hard-coded sandbox credentials | `integration/courier.test.js` |
| Medium | BUG-006 | Changing your password leaves existing sessions valid | `integration/auth.routes.test.js` |
| Medium | BUG-007 | User list and lookup expose reset and verification tokens | `integration/auth.routes.test.js` |
| Medium | BUG-017 | Sale-form product search cannot find a product by one word of its name | `integration/sales.routes.test.js` |
| Medium | BUG-022 | Deleting a sales return can drive stock negative | `integration/salesReturn.routes.test.js` |
| Medium | BUG-023 | "One return per invoice" has no unique index behind it | `integration/salesReturn.routes.test.js` |
| Medium | BUG-027 | The supplier's due grows by the client's `dueamount` | `integration/purchase.routes.test.js` |
| Medium | BUG-030 | Deleting or editing a purchase can drive stock negative | `integration/purchase.routes.test.js` |
| Medium | BUG-031 | A failed stock adjustment still leaves an adjustment record | `integration/stockAdjust.routes.test.js` |
| Medium | BUG-032 | Stock adjustment quantities are not validated | `integration/stockAdjust.routes.test.js` |
| Medium | BUG-036 | Deactivated products stay in the storefront's main listing | `integration/product.routes.test.js` |
| Medium | BUG-038 | Deleting a product leaves its variants behind | `integration/product.routes.test.js` |
| Medium | BUG-041 | Cart quantities sent as strings are concatenated | `integration/commerce.routes.test.js` |
| Medium | BUG-042 | Shoppers cannot merge their cart or use the wishlist | `integration/commerce.routes.test.js` |
| Medium | BUG-049 | Payment fail/cancel callbacks overwrite paid orders; statuses outside the enum | `integration/commerce.routes.test.js` |
| Medium | BUG-050 | Profit double-counts returned units when a product is on two lines | `integration/profitRules.test.js` |
| Medium | BUG-053 | Editing a customer payment always edits that customer's first payment | `integration/customer.routes.test.js` |
| Medium | BUG-054 | A sale only sees the customer's first advance payment | `integration/customer.routes.test.js` |
| Medium | BUG-055 | The customer's due limit is never enforced by the API | `integration/customer.routes.test.js` |
| Medium | BUG-056 | An account's balance can be edited directly | `integration/finance.routes.test.js` |
| Medium | BUG-057 | Manual transactions move money before they are saved, and accept negative amounts | `integration/finance.routes.test.js` |
| Medium | BUG-061 | A re-run SMS job texts recipients a second time | `worker/sms.worker.test.js` |
| Medium | BUG-062 | Failed emails are never retried | `worker/email.worker.test.js` |
| Medium | BUG-064 | A deactivated permission still grants access | `middleware/permissions.test.js` |
| Low | BUG-003 | Deleting an unknown merchant answers 500 | `contract/routeMatrix.test.js` |
| Low | BUG-005 | `validate()` calls `next()` twice on invalid input | `middleware/requestPipeline.test.js` |
| Low | BUG-013 | Creating a sale with short stock answers 500 | `integration/sales.routes.test.js` |
| Low | BUG-016 | Product search for the sale form answers 500 for a bad `limit` | `integration/sales.routes.test.js` |
| Low | BUG-028 | Purchase search puts the raw query into `$regex` | `integration/purchase.routes.test.js` |
| Low | BUG-029 | Editing a purchase without `allproduct` answers 500 | `integration/purchase.routes.test.js` |
| Low | BUG-034 | Uploading a file that is not an image answers 500 | `integration/product.routes.test.js` |
| Low | BUG-037 | Unknown product, variant or product image answers 200 | `integration/product.routes.test.js` |
| Low | BUG-039 | Variant create accepts sales counters from the client | `integration/product.routes.test.js` |
| Low | BUG-040 | Coupon create/update accept `usedCount` from the client | `integration/commerce.routes.test.js` |
| Low | BUG-051 | Customer search puts the raw query into `$regex` | `integration/customer.routes.test.js` |
| Low | BUG-059 | The money-transfer date is dropped | `integration/finance.routes.test.js` |
| Low | BUG-060 | Audit jobs are not idempotent | `worker/audit.worker.test.js` |
| Low | BUG-063 | An unset NODE_ENV returns stack traces to clients | `middleware/errorHandler.test.js` |
| Low | BUG-066 | Cache namespace version can move backwards | `unit/cacheAndCost.test.js` |
| Low | BUG-074 | The IPN success answer swaps message and data | `integration/commerce.routes.test.js` |
| Low | BUG-075 | Internal errors answer in a different envelope | `contract/envelope.test.js` |

## Details

### BUG-001 — Joi validation errors answer 500 instead of 400 (Medium)

- **Where:** `src/validation/category.validation.js`, `brand.validation.js`,
  `product.validation.js` (create and update) call `schema.validateAsync()`
  without catching; `src/lib/GlobalErrorHandeler.js` only maps Mongoose
  `ValidationError` (it checks `error.errors`, which a Joi error does not have).
- **Steps:** as an owner, `POST /api/v1/categories` (or `/brand`,
  `/product/createproduct`, `PUT /product/updateproductinfo/:slug`) with `{}`.
- **Expected:** 400 with the Joi message ("Name is required.").
- **Actual:** 500 "Something went wrong , please try agin later !!".
- **Tests:** `tests/contract/routeMatrix.test.js` (empty body / malformed id cases, via `knownFailures.js`).

### BUG-002 — Department/section create: `customError` arguments swapped (Medium)

- **Where:** `src/controller/employee.controller.js` `createEmployeeDepartment`
  and `createEmployeeSection`: `new customError(statusCodes.BAD_REQUEST, "… is required")`.
- **Steps:** `POST /api/v1/employee/create-employee-department` with `{}`.
- **Expected:** 400 "Department name is required".
- **Actual:** 500 — the status code is the message string, `res.status()` throws.
- **Tests:** `tests/contract/routeMatrix.test.js` (empty body cases).

### BUG-003 — Deleting an unknown merchant answers 500 (Low)

- **Where:** `src/controller/marchant.controller.js` `deleteMerchantById`.
- **Steps:** `DELETE /api/v1/merchant/delete-merchant/<unknown ObjectId>`.
- **Expected:** 404. **Actual:** 500 "Failed to delete merchant".
- **Tests:** `tests/contract/routeMatrix.test.js`.

### BUG-004 — Pathao city/zone/area lookups use hard-coded sandbox credentials (Medium)

- **Where:** `src/service/couriers/courierCityZone.js` (constructor), used by
  `GET /courier/cities`, `/courier/zone/:cityId`, `/courier/areas/:zoneId`.
- **Problem:** the base URL is Pathao's *sandbox* and the client id/secret/user/
  password are literals in the source. The tenant's own Pathao settings are
  never read, so a live store gets sandbox cities/zones, and any upstream
  error (including a 4xx for an unknown city) is answered 500.
- **Expected:** the tenant's configured Pathao account (422 when not
  configured), upstream 4xx mapped to a client error.
- **Tests:** `tests/integration/courier.test.js`.

### BUG-006 — Changing your password leaves existing sessions valid (Medium)

- **Where:** `src/controller/user.controller.js` `changePassword`.
- **Problem:** only the refresh token is cleared; `tokenVersion` is not bumped,
  so every access token issued before the change keeps working until it
  expires (the comment says "sessions opened with the old password are no
  longer valid"). `resetPassword` and the admin `updateUser` do bump it.
- **Steps:** sign in twice (tokens A and B); with A call
  `POST /auth/change-password`; call `GET /auth/getme` with A.
- **Expected:** 401. **Actual:** 200.
- **Tests:** `tests/integration/auth.routes.test.js` "ends sessions opened with the old password".

### BUG-007 — User list and lookup expose reset and verification tokens (Medium)

- **Where:** `getAllUser`, `getUserbyEmailOrPhone`, `getUserAddedByAdmin` in
  `src/controller/user.controller.js` (the select excludes `password` and
  `refreshToken` but not `resetPasswordToken`, `resetPasswordExpires`,
  `emailVerificationToken`). `getUserAddedByAdmin` also caches them in Redis.
- **Expected:** no token of any kind in the response. **Actual:** the
  verification token is returned in clear; it can verify the address without
  access to the mailbox.
- **Tests:** `tests/integration/auth.routes.test.js` "never expose secrets".

### BUG-008 — Delete-user and the permission endpoints return the password hash (High)

- **Where:** `deleteUser`, `addPermissionToUser`, `removePermissionFromUser`
  answer with the full Mongoose document (`User.findById` without a select).
- **Expected:** a projection without secrets. **Actual:** bcrypt hash,
  refresh token and reset token of the target account are in the response.
- **Tests:** `tests/integration/auth.routes.test.js` (two `[BUG-008]` cases).

### BUG-009 — `POST /auth/add-user` lets a user manager grant any permission (High)

- **Where:** `addUser` spreads the Joi result into `User.create`; the schema
  uses `allowUnknown: true`, so `permissions`, `isEmailVerified`,
  `tokenVersion`, `mustChangePassword`… pass straight through. Only `role` goes
  through `rbac.assertCanAssignRole`.
- **Steps:** as a staff member holding only `create-user` add/view, POST
  `/auth/add-user` with `permissions: [{ permission: <create-role id>, actions: [...] }]`.
- **Expected:** refused (403) or the field ignored. **Actual:** the new account
  holds `create-role` — privilege escalation inside the store, bypassing the
  grant rules `rbac.assertCanGrantPermissions` enforces everywhere else.
- **Tests:** `tests/integration/auth.routes.test.js` "cannot grant direct permissions".

### BUG-010 — Login by email fails when another account has no phone (High)

- **Where:** `login` (and `getUserbyEmailOrPhone`, `isSuperAdmin`,
  `registerUser`'s duplicate check): `User.findOne({ $or: [{ email }, { phone }] })`
  with one identifier `undefined`. The driver sends it as `null`, which matches
  every document missing that field.
- **Steps:** a store with an account that has no phone, created before
  another staff member; that staff member signs in by email.
- **Expected:** 200 for the account the email names. **Actual:** the phoneless
  account is picked, its password does not match, 400 "Invalid credentials".
- **Reverse effect:** an email that matches no account still matches the
  first phoneless account (often the provisioned owner) — sign-in then only
  needs that account's password, not its identifier.
- **Tests:** `tests/integration/auth.routes.test.js` "[BUG-010]".

### BUG-011 — Login accepts query operators in email/phone (High)

- **Where:** `login` passes `req.body.email` / `req.body.phone` into the query
  without type checks; `loginLimiter`'s key falls back to "no-identifier" for
  an object.
- **Steps:** `POST /auth/login { workspace, phone: { "$ne": null }, password }`.
- **Expected:** 400. **Actual:** signs in as the first account with a phone
  whose password matches — the attacker never names the account. With
  `email: { "$gt": "" }` the handler crashes (500).
- **Tests:** `tests/integration/auth.routes.test.js` "[BUG-011]".

### BUG-012 — Admin password change stores the password in plain text (Critical)

- **Where:** `updateUser` builds `{ name, email, phone, password, $inc: { tokenVersion: 1 } }`
  and calls `findByIdAndUpdate`; the hashing hook in `user.model.js`
  (`pre("findOneAndUpdate")`) does not hash a password in that update shape.
- **Steps:** `PUT /auth/user-update/:id` with `password`.
- **Expected:** bcrypt hash stored, user signs in with the new password.
- **Actual:** the password is stored verbatim; the user can no longer sign in
  (bcrypt compare fails), and anyone with database or backup access reads it.
- **Tests:** `tests/integration/auth.routes.test.js` "[BUG-012]".
- **Fixed:** the timestamps option adds `$set: { updatedAt }` to the update, so
  the hook only looked inside `$set` and skipped the top-level `password`. The
  hook now hashes a password in either place.

### BUG-013 — Creating a sale with short stock answers 500 (Low)

- **Where:** `src/controller/sales.controller.js` `createSales` throws
  `customError("Stock not enough for some items", statusCodes.SERVER_ERROR)`;
  `updateSales` answers the same condition with 400.
- **Steps:** `POST /sales/create-sales` (invoiceStatus complete) for more units than in stock.
- **Expected:** 400 (or 409). **Actual:** 500; the transaction is correctly rolled back.
- **Tests:** `tests/integration/sales.routes.test.js` "[BUG-013]".

### BUG-014 — A sale overwrites the customer's due with the client's `balance` (High)

- **Where:** `createSales` / `updateSales`:
  `customerModel.findByIdAndUpdate(customerId, { openingDues: req.body.balance || 0 })`.
- **Problem:** the customer's running due (which "is never edited by hand",
  per `customer.model.js`) is set to whatever the client sends. A request with
  `balance: 0` wipes the customer's whole due; a missing `balance` does the same.
  The rule file says money fields written by the client are never trusted.
- **Steps:** customer due 500; listed sale payable 1000, paid 200, `balance: 0`.
- **Expected:** due 1300 (500 + 800). **Actual:** 0.
- **Delete path:** `deleteSales` sets the due back to the sale's `previousDue`
  snapshot, wiping every payment received since (due 500, sale +800, payment
  −300 = 1000; delete the sale → 500 instead of 200).
- **Tests:** `tests/integration/sales.routes.test.js` and
  `tests/integration/salesIntegrity.test.js` "[BUG-014]".

### BUG-016 — Product search for the sale form answers 500 for a bad `limit` (Low)

- **Where:** `searchProductsAndVariants`: `Math.min(Number(req.query.limit || 20), 50)`
  is `NaN`, 0 or negative and goes straight into `$limit`.
- **Steps:** `GET /sales/get-sales-products?q=abc&limit=abc` (or `0`, `-5`).
- **Expected:** clamped (or 400). **Actual:** 500.
- **Tests:** `tests/integration/sales.routes.test.js` "[BUG-016]".

### BUG-017 — Sale-form product search cannot find a product by one word of its name (Medium)

- **Where:** `searchProductsAndVariants`: `isLikelyCode = /^[0-9A-Za-z\-_.]{4,}$/`
  treats every single word of four or more letters as a barcode and matches it
  only exactly against sku / barCode / qrCode / slug.
- **Steps:** product "Cotton Shirt Large"; search `q=Shirt`.
- **Expected:** the product. **Actual:** no results (two words, "cotton shirt", work).
- **Tests:** `tests/integration/sales.routes.test.js` "[BUG-017]".

### BUG-018 — A sales return can take back more units than were sold (Critical)

- **Where:** `src/controller/salesReturn.controller.js` `createSalesReturn` /
  `computeReturnAmounts`: the requested `quantity` is never compared with the
  line's sold quantity.
- **Steps:** sale of 2 units; `POST /sales-return/createsalesreturn` with `quantity: 50`.
- **Expected:** 400. **Actual:** 201 — stock +50, refund 50 × the unit price
  posted as a cash payment, the listed customer's due reduced by the same.
- **Tests:** `tests/integration/salesReturn.routes.test.js` "[BUG-018]".

### BUG-019 — A product that is not on the sale is refunded at the client's price (Critical)

- **Where:** `computeReturnAmounts`: when no sale line matches the item it falls
  back to `Number(item.unitPrice)` from the request.
- **Steps:** return a product the invoice never contained with `unitPrice: 75000`.
- **Expected:** 400. **Actual:** 201, refund 75000, stock of that product +1.
- **Tests:** `tests/integration/salesReturn.routes.test.js` "[BUG-019]".

### BUG-020 — A return against a pending/draft sale adds stock that never left (High)

- **Where:** `createSalesReturn` restocks regardless of the sale's
  `invoiceStatus`; pending and draft sales never deducted stock.
- **Expected:** 400 for a sale that is not complete. **Actual:** 201, stock inflated.
- **Tests:** `tests/integration/salesReturn.routes.test.js` "[BUG-020]".

### BUG-021 — A sales-return refund never leaves the refund account (High)

- **Where:** `recordReturnTransaction` creates the "cash payment" transaction
  but nothing `$inc`s `Account.balance`, unlike sales, purchases, purchase
  returns, customer and supplier payments and manual transactions, which all do.
- **Expected:** refund account balance − refund. **Actual:** unchanged; the
  account's stored balance and the sum of its transactions drift apart. The
  same holds for `updateSalesReturn` and `deleteSalesReturn`, and for the
  refund rows `deleteSales` cascades away.
- **Tests:** `tests/integration/salesReturn.routes.test.js` "[BUG-021]".

### BUG-022 — Deleting a sales return can drive stock negative (Medium)

- **Where:** `deleteSalesReturn` (and the revert step of `updateSalesReturn`)
  take the restock back with a bare `$inc: { stock: -qty }`; `min: 0` in the
  schema does not apply to updates.
- **Steps:** return 1 unit, sell the stock down to 0, delete the return.
- **Expected:** refused, or stock floored. **Actual:** stock −1.
- **Tests:** `tests/integration/salesReturn.routes.test.js` "[BUG-022]".

### BUG-023 — "One return per invoice" has no unique index behind it (Medium)

- **Where:** `salesReturn.model.js` pre-save hook does `findOne({ invoiceNumber })`
  outside the session; no unique index on `{ tenantId, invoiceNumber }`.
- **Problem:** parallel requests can each pass the check, creating two returns
  (two refunds, double restock) for one invoice. The race is timing-dependent;
  the test asserts the missing index deterministically.
- **Tests:** `tests/integration/salesReturn.routes.test.js` "[BUG-023]".

### BUG-024 — Editing a sales return always fails with 500 (High)

- **Where:** `updateSalesReturn` loads the sale twice (`oldSale`, `newSale`) —
  the same document when the invoice does not change, which is the normal
  case — and saves both; the second save throws a Mongoose `VersionError`.
- **Steps:** `PUT /sales-return/update-salesreturn/:id` with any valid body.
- **Expected:** 200. **Actual:** 500, transaction rolled back.
- **Tests:** `tests/integration/salesReturn.routes.test.js` "[BUG-024]".

### BUG-025 — Concurrent purchases / returns fail with 500 on write conflicts (High)

- **Where:** every controller that opens its transaction by hand with
  `session.startTransaction()` and no retry of `TransientTransactionError`:
  `salesReturn`, `purchase`, `purchaseReturn`, `customer`, `employee`,
  `sizeChart` controllers. (`sales.controller.js` uses `session.withTransaction()`,
  which retries, and its concurrency tests pass.)
- **Steps:** 8 purchases of the same product at the same moment; or several
  returns of one invoice.
- **Expected:** all purchases saved (conflicts retried); duplicate returns
  refused with 4xx. **Actual:** 7 of 8 purchases answer 500 (WriteConflict);
  returns answer 500 at random.
- **Tests:** `tests/integration/purchase.routes.test.js` and
  `tests/integration/salesReturn.routes.test.js` "[BUG-025]".

### BUG-026 — A purchase quantity sent as a string corrupts stock (High)

- **Where:** `createPurchase` / `updatePurchase`: `productInfo.stock = (productInfo.stock || 0) + quantity`
  with `quantity` straight from the body. No schema validation on this route.
- **Steps:** stock 10; purchase with `quantity: "5"`.
- **Expected:** 15. **Actual:** `10 + "5"` = `"105"`, saved as 105.
- **Tests:** `tests/integration/purchase.routes.test.js` "[BUG-026]".

### BUG-027 — The supplier's due grows by the client's `dueamount` (Medium)

- **Where:** `createPurchase` / `updatePurchase` add `req.body.dueamount` to
  `supplier.openingDues`; it is never checked against `payable − paid` (the
  server-side computation is commented out).
- **Steps:** purchase payable 2250, paid 2250, `dueamount: 9999`.
- **Expected:** supplier due unchanged. **Actual:** +9999.
- **Tests:** `tests/integration/purchase.routes.test.js` "[BUG-027]".

### BUG-028 — Purchase search puts the raw query into `$regex` (Low)

- **Where:** `searchPurchase`: `{ $regex: invoiceNumber.trim() }` without escaping.
- **Steps:** `GET /purchase/search-purchase?invoiceNumber=(` → 500;
  `?invoiceNumber=.*` matches every purchase.
- **Expected:** literal match. (Sales search escapes the same input.)
- **Tests:** `tests/integration/purchase.routes.test.js` "[BUG-028]".

### BUG-029 — Editing a purchase without `allproduct` answers 500 (Low)

- **Where:** `updatePurchase` iterates `allproduct` unconditionally after
  reverting the old stock (the transaction is rolled back).
- **Expected:** 400. **Actual:** 500 (TypeError).
- **Tests:** `tests/integration/purchase.routes.test.js` "[BUG-029]".

### BUG-030 — Deleting or editing a purchase can drive stock negative (Medium)

- **Where:** `deletePurchase` / `updatePurchase` revert stock with a bare
  `$inc: { stock: -quantity }` — no `$gte` guard, unlike sales and purchase returns.
- **Steps:** buy 5 (stock 15), sell down to 1, delete the purchase.
- **Expected:** refused (or floored). **Actual:** stock −4.
- **Tests:** `tests/integration/purchase.routes.test.js` "[BUG-030]".

### BUG-031 — A failed stock adjustment still leaves an adjustment record (Medium)

- **Where:** `src/controller/stockAdjust.controller.js` `createStockAdjust`
  creates the `StockAdjust` row first, then loads and saves the product, with
  no transaction.
- **Steps:** adjust an unknown product (404), or decrease below zero (the
  product save fails `min: 0`, 400).
- **Expected:** nothing recorded. **Actual:** the adjustment row exists and is
  listed in the stock-adjustment history and reports, though stock never moved.
- **Tests:** `tests/integration/stockAdjust.routes.test.js` "[BUG-031]".

### BUG-032 — Stock adjustment quantities are not validated (Medium)

- **Where:** `createStockAdjust`: `product.stock += increaseQuantity - decreaseQuantity`.
- **Problem:** sending only `increaseQuantity` makes the delta `NaN` (the save
  fails and leaves an orphan row, see BUG-031); a negative `increaseQuantity`
  silently decreases stock and the "plus" total.
- **Tests:** `tests/integration/stockAdjust.routes.test.js` "[BUG-032]".

### BUG-033 — Parallel stock adjustments lose updates (High)

- **Where:** create, update and delete all do `findById` → `stock += …` →
  `save()`; nothing is atomic, so concurrent adjustments overwrite each other.
- **Steps:** 20 parallel `+1` adjustments on a product with stock 10.
- **Expected:** 30. **Actual:** less (each request saved the stock it read).
- **Tests:** `tests/integration/stockAdjust.routes.test.js` "[BUG-033]".

### BUG-034 — Uploading a file that is not an image answers 500 (Low)

- **Where:** `src/middleware/multer.middleware.js` — `fileFilter` raises an
  error with `statusCode = 400`, but `singleFileUpload`,
  `multipleFileUploadWithFields` and `anyFileUpload` rewrap any non-Multer
  error as `customError(err, 500)`.
- **Steps:** `POST /product/createproduct` with `thumbnail` = a `.gif`.
- **Expected:** 400 "Only image files … are allowed". **Actual:** 500.
- **Tests:** `tests/integration/product.routes.test.js` "[BUG-034]".

### BUG-035 — Public product endpoints publish every product's cost price (High)

- **Where:** `product.controller.js` `getNewArrivalProducts`,
  `getProductsByPriceRange`, `getRelatedProducts`, `getDiscountProducts`,
  `getBestSellingProducts`, `getNameWiseSearch`. Only `getAllProducts` and
  `getProductBySlug` pass their result through `forAudience()`
  (`src/utils/publicProduct.js`), whose own comment explains why
  `purchasePrice` must never reach an anonymous visitor.
- **Steps:** without a token, `GET /product/newarrival` (or the others).
- **Expected:** no `purchasePrice`. **Actual:** the shop's cost of every
  product (and of every variant, populated) is in the response.
- **Tests:** `tests/integration/product.routes.test.js` "[BUG-035]" (5 cases).

### BUG-036 — Deactivated products stay in the storefront's main listing (Medium)

- **Where:** `getAllProducts` (`GET /product/getproduct`, public) has no
  `isActive` filter; new-arrival and related-products do filter it.
- **Expected:** a deactivated product is not listed to shoppers. **Actual:** listed.
- **Tests:** `tests/integration/product.routes.test.js` "[BUG-036]".

### BUG-037 — Unknown product, variant or product image answers 200 (Low)

- **Where:** `getProductBySlug`, `deleteProductBySlug`, `addProductImage`,
  `deleteProductImage`, `getSingleVariant`, `deactivateVariant`, `deleteVariant`
  answer `200 { product: null }` / `"… not found"` instead of 404 (the
  dashboard cannot tell a miss from a hit by status).
- **Tests:** `tests/integration/product.routes.test.js` "[BUG-037]".

### BUG-038 — Deleting a product leaves its variants behind (Medium)

- **Where:** `deleteProductBySlug` deletes the product only. Its variants keep
  pointing at a missing product and still come up in the sale-form search,
  stock lists and variant reports.
- **Tests:** `tests/integration/product.routes.test.js` "[BUG-038]".

### BUG-039 — Variant create accepts sales counters from the client (Low)

- **Where:** `validateVariant` uses `allowUnknown: true` and `createVariant`
  spreads the result into the document, so `posSold`, `totalSales`,
  `salesReturnStock`, `purchaseQuantityStock`… can be set on create (product
  create strips unknown fields correctly).
- **Tests:** `tests/integration/product.routes.test.js` "[BUG-039]".

### BUG-040 — Coupon create/update accept `usedCount` from the client (Low)

- **Where:** `src/validation/coupon.validation.js` (`allowUnknown: true`) and
  `createCoupon` / `updateCoupon` pass the whole result to the model.
- **Problem:** `usedCount` (and any other field) is writable — a used-up coupon
  can be reset to 0 uses by an edit. Also, on a validation error
  `validateCoupon` calls `next(err)` and returns `undefined`, so the controller
  keeps running on `undefined` and the error handler is invoked twice.
- **Tests:** `tests/integration/commerce.routes.test.js` "[BUG-040]".

### BUG-041 — Cart quantities sent as strings are concatenated (Medium)

- **Where:** `src/controller/cart.controller.js` `addToCartController`:
  `cart.items[i].quantity + quantity` with `quantity` from the body.
- **Steps:** add 1, then add `quantity: "2"`.
- **Expected:** 3. **Actual:** `1 + "2"` = `"12"`: refused as "Insufficient
  stock" when stock < 12, otherwise stored as 12 units.
- **Tests:** `tests/integration/commerce.routes.test.js` "[BUG-041]".

### BUG-042 — Shoppers cannot merge their cart or use the wishlist (Medium)

- **Where:** `POST /cart/merge` and every `/wishList/*` route use `authGuard`,
  which only accepts `aud: "staff"` tokens. A storefront session (`aud: "shopper"`)
  is answered 401, so a guest's cart is lost on sign-in and the wishlist is
  unusable from the storefront.
- **Tests:** `tests/integration/commerce.routes.test.js` "[BUG-042]" (2 cases).

### BUG-043 — A checkout that sells out half-way loses stock (High)

- **Where:** `src/controller/shopOrder.controller.js` `createOrder`: lines are
  decremented one at a time; when one fails, the order is deleted but the
  lines already decremented are not given back (no transaction, no rollback).
- **Steps:** stock 5, a cart with two lines of 3 units of the same product.
- **Expected:** 409 and stock 5. **Actual:** 409 and stock 2 — 3 units vanish.
- **Tests:** `tests/integration/commerce.routes.test.js` "[BUG-043]".

### BUG-044 — A coupon's usage limit is not enforced under concurrency (High)

- **Where:** storefront `createOrder` (`applyCoupon`), staff `createOrder` and
  POS orders: `usedCount >= usageLimit` is read, the order is written, then
  `$inc: { usedCount: 1 }` runs unconditionally.
- **Steps:** a coupon limited to 1 use; 10 checkouts with it at the same moment.
- **Expected:** at most 1 order carries it. **Actual:** several (4 in the run
  recorded), `usedCount` ends above `usageLimit`.
- **Tests:** `tests/integration/commerce.routes.test.js` "[BUG-044]".

### BUG-045 — Staff "create order" always fails (High)

- **Where:** `src/controller/order.controller.js` `createOrder` sums
  `item.totalPrice`, a field cart items do not have (the cart stores
  `itemTotal`), so `totalAmount`/`finalAmount` are `NaN` and the order fails
  validation; the catch rewraps it as 500.
- **Steps:** add an item to the staff cart; `POST /order/createorder`.
- **Expected:** 201. **Actual:** 500 "Cast to Number failed for value NaN".
- **Tests:** `tests/integration/commerce.routes.test.js` "[BUG-045]".

### BUG-046 — Marking an order "Delivered" puts its stock back (Critical)

- **Where:** `updateOrder`: `if (orderStatus === "Cancelled" || orderStatus === "Delivered")`
  runs the stock rollback for both.
- **Steps:** order of 2 units; `PUT /order/order-update/:id { orderStatus: "Delivered" }`.
- **Expected:** stock unchanged (the goods left). **Actual:** stock +2 for every
  delivered order — inventory is overstated by everything ever delivered.
- **Tests:** `tests/integration/commerce.routes.test.js` "[BUG-046]".

### BUG-047 — Order status changes have no transition rules (High)

- **Where:** `updateOrder` / `deleteOrder`.
- **Problem:** any status can follow any other, and side effects repeat:
  sending "Cancelled" twice restocks twice; deleting a cancelled order
  restocks a third time; "Cancelled" → "Pending" never takes the stock again.
- **Tests:** `tests/integration/commerce.routes.test.js` "[BUG-047]" (2 cases).

### BUG-048 — SSLCommerz IPN never checks the paid amount (High)

- **Where:** `src/controller/payment.controller.js` `ipnPayment` marks the
  order paid whenever the gateway says VALID, without comparing
  `validationResponse.amount` (and currency) with the order's `finalAmount`.
- **Problem:** a genuine payment of a small amount, validated by the gateway,
  confirms an order of any size if its `tran_id` is used.
- **Tests:** `tests/integration/commerce.routes.test.js` "[BUG-048]" (gateway mocked with nock).

### BUG-049 — Payment fail/cancel callbacks overwrite paid orders; statuses outside the enum (Medium)

- **Where:** `failPayment`, `cancelPayment`, `ipnPayment`.
- **Problem:** fail/cancel are not verified with the gateway and update any
  order by `tran_id`, including one already paid; all three write
  `orderStatus` values that are not in the schema enum ("failed", "cancelled",
  "confirmed" — the enum uses "Cancelled", "Confirmed"), via
  `findOneAndUpdate` without validators, so status counts and filters miss them.
- **Tests:** `tests/integration/commerce.routes.test.js` "[BUG-049]" (2 cases).

### BUG-050 — Profit double-counts returned units when a product is on two lines (Medium)

- **Where:** `src/utils/saleProfit.util.js` `soldLineStages`: `returnedQty` is
  the sum of every return item matching the line's product/variant, computed
  per line. When the same product appears on two lines of one invoice, one
  returned unit is subtracted from both lines.
- **Rule:** `.claude/rules/profit-calculation.md` — "Only the units still with
  the customer carry cost: quantity − returned quantity".
- **Steps:** one invoice, two lines of 2 units of the same product (cost 100),
  one unit returned.
- **Expected:** buy price 300. **Actual:** 200 — profit overstated by one
  unit's cost (and the Product Profit report drops two units instead of one).
- **Tests:** `tests/integration/profitRules.test.js` "[BUG-050]". The rest of
  the formula matches an independent oracle over 60 random invoices.

### BUG-051 — Customer search puts the raw query into `$regex` (Low)

- **Where:** `customer.controller.js` `getAllCustomers` (`q`).
- **Steps:** `GET /customer/get-customers?q=(` → 500; `?q=.*` lists everyone.
- **Tests:** `tests/integration/customer.routes.test.js` "[BUG-051]".

### BUG-052 — Deleting a customer payment does not restore the due (High)

- **Where:** `deleteCustomerPaymentRecived` deletes the payment and reverses the
  account, but never adds the amount back to `customer.openingDues` (no
  transaction either).
- **Steps:** due 1000, receive 400 (due 600), delete that payment.
- **Expected:** due 1000. **Actual:** due 600 — the money left the account but
  the customer is still credited with having paid it.
- **Tests:** `tests/integration/customer.routes.test.js` "[BUG-052]".

### BUG-053 — Editing a customer payment always edits that customer's first payment (Medium)

- **Where:** `PUT /customer/update-customer-payment-recived/:customer` →
  `customerPaymentRecived.findOne({ customer })`.
- **Problem:** a customer with several payments cannot have the 2nd or later
  one corrected; the request cannot name a payment (its id answers 404).
- **Tests:** `tests/integration/customer.routes.test.js` "[BUG-053]".

### BUG-054 — A sale only sees the customer's first advance payment (Medium)

- **Where:** `createSales`: `customerAdvancePaymentModel.findOne({ customer })`
  reads the first advance document; its `balance` is the running balance at
  that payment, not the customer's total.
- **Steps:** two advances of 500; a sale adjusting 800 of advance.
- **Expected:** 201. **Actual:** 400 "Insufficient advance balance. Available: 500".
- **Tests:** `tests/integration/customer.routes.test.js` "[BUG-054]".

### BUG-055 — The customer's due limit is never enforced by the API (Medium)

- **Where:** `customer.dueLimit` is stored and shown as CREDIT LIMIT in reports,
  but `createSales` / `updateSales` never check it (the seller's discount
  limit is re-checked server-side "because a client can be bypassed"; the
  credit limit is not).
- **Tests:** `tests/integration/customer.routes.test.js` "[BUG-055]".

### BUG-056 — An account's balance can be edited directly (Medium)

- **Where:** `src/controller/account.controller.js` `updateAccount`:
  `findOneAndUpdate({ slug }, { ...req.body })`.
- **Problem:** `PUT /account/update-account/:slug { balance: 999999 }` sets the
  balance with no transaction behind it; the stored balance and the ledger
  diverge, and the change is not audited.
- **Tests:** `tests/integration/finance.routes.test.js` "[BUG-056]".

### BUG-057 — Manual transactions move money before they are saved, and accept negative amounts (Medium)

- **Where:** `createTransaction` `$inc`s the account first, then creates the
  row, with no session; the amount has no lower bound.
- **Steps:** a valid request with `date: "not-a-date"` → 400, but the account
  has already moved by the amount. `amount: -500` on a "cash payment"
  raises the balance.
- **Tests:** `tests/integration/finance.routes.test.js` "[BUG-057]" (2 cases).

### BUG-058 — A money transfer never moves money (High)

- **Where:** `src/controller/moneyTransfer.controller.js` `createMoneyTransfer`
  (and update/delete) only write a `MoneyTransfer` record: neither account's
  balance changes and no ledger rows are written, so the account balances,
  the dashboard and every ledger report ignore transfers. Accounts are not
  checked to exist, and a transfer to the same account is accepted.
- **Tests:** `tests/integration/finance.routes.test.js` "[BUG-058]" (2 cases).

### BUG-059 — The money-transfer date is dropped (Low)

- **Where:** the controller writes `date`; the schema field is `Date`
  (capital D), so strict mode discards the value the user picked.
- **Tests:** `tests/integration/finance.routes.test.js` "[BUG-059]".

### BUG-060 — Audit jobs are not idempotent (Low)

- **Where:** `src/workers/audit.worker.js` — a bare `insertOne` per run; the
  job id is not used as a key. A job that runs twice (retry after the write
  but before the ack, a stalled job re-run) writes the entry twice.
- **Tests:** `tests/worker/audit.worker.test.js` "[BUG-060]".

### BUG-061 — A re-run SMS job texts recipients a second time (Medium)

- **Where:** `src/workers/sms.worker.js` sends to every recipient in
  `job.data.recipients`, never consulting the log's per-recipient status.
- **Problem:** a retried or stalled job re-sends to everyone already marked
  "sent" (and pays for it), and `sentCount` is `$inc`ed again before being
  overwritten.
- **Tests:** `tests/worker/sms.worker.test.js` "[BUG-061]".

### BUG-062 — Failed emails are never retried (Medium)

- **Where:** `src/helpers/nodemailer.js` `sendEmail` catches SMTP errors and
  returns `null` unless `throwOnError` is passed; `src/workers/email.worker.js`
  does not pass it, so a failed send "completes" and the queue's 3 attempts
  with backoff never run. The invoice email is silently lost.
- **Tests:** `tests/worker/email.worker.test.js` "[BUG-062]".

### BUG-005 — `validate()` calls `next()` twice on invalid input (Low)

- **Where:** `src/middleware/validate.js`: `if (error) next(new customError(...))`
  is not followed by `return`, so `req[property] = value; next()` runs too.
- **Effect:** the controller is not re-run (Express has already moved past the
  route), but the second `next()` re-enters routing after the response was
  sent; with other route layouts this becomes "headers already sent".
- **Tests:** `tests/middleware/requestPipeline.test.js` "[BUG-005]".

### BUG-063 — An unset NODE_ENV returns stack traces to clients (Low)

- **Where:** `src/config/nodeEnv.js`: `nodeEnv()` defaults to `"development"`,
  and the error handler then adds `errorStack` to every error response. The
  handler's comment says an unrecognised NODE_ENV must never leak stack
  traces; a missing one does.
- **Tests:** `tests/middleware/errorHandler.test.js` "[BUG-063]".

### BUG-064 — A deactivated permission still grants access (Medium)

- **Where:** `src/middleware/checkPermission.middleware.js` `actionsForModule`
  never reads `permission.isActive`; `rbac.effectiveActions` and `getMe` do.
  The platform's "deactivate permission" therefore hides the permission in
  the dashboard but every API route keeps honouring it.
- **Tests:** `tests/middleware/permissions.test.js` "[BUG-064]".

### BUG-065 — Prototype pollution through bracketed form-field names (Critical)

- **Where:** `src/utils/parseFormData.util.js` `expandBracketKeys` walks
  `"__proto__[x]"` / `"constructor[prototype][x]"` into `Object.prototype`
  and assigns there. It runs on the request body of product create/update,
  variant create/update and employee create/update.
- **Impact:** any staff member allowed to create a product, variant or
  employee can set properties on `Object.prototype` of the shared API
  process — every tenant's requests are affected until a restart (e.g. a
  polluted `isActive`, `roles` or `status` default changes authorization and
  validation outcomes anywhere an own property is missing).
- **Tests:** `tests/unit/utils.test.js` "[BUG-065]" (2 key shapes).

### BUG-066 — Cache namespace version can move backwards (Low)

- **Where:** `src/utils/cache.util.js` `bumpOne`: `INCR`, then a separate
  `SET key 2` when the INCR returned 1. Concurrent first bumps interleave:
  25 parallel bumps of a fresh namespace end at version 2, not 26, so cache
  entries written at versions 3…25 become reachable again once later bumps
  pass those numbers — stale lists are served.
- **Tests:** `tests/unit/cacheAndCost.test.js` "[BUG-066]".

### BUG-067 — A new sale may carry "return" lines that add stock (High)

- **Where:** `src/validation/sales.validation.js` allows `salesStatus: "return"`
  on create; `createSales` then `$inc`s stock by +qty for such a line.
- **Problem:** a cashier can put stock back (and lower `posSold`) on any
  product without a sales return, refund or audit trail behind it.
- **Tests:** `tests/integration/salesIntegrity.test.js` "[BUG-067]".

### BUG-068 — Editing a sale after a return moves stock by twice the quantity (High)

- **Where:** `updateSales` `effectQty` reads the stored line (flipped to
  "return" by the sales return) as +qty and the resubmitted line ("sale") as
  −qty; the difference is applied to stock.
- **Steps:** sale of 2 (stock 8), return 1 (stock 9), edit the sale's remark
  re-sending the line.
- **Expected:** stock 9. **Actual:** 5.
- **Tests:** `tests/integration/salesIntegrity.test.js` "[BUG-068]".

### BUG-069 — Sale edits are mass-assigned (`$set: req.body`) (High)

- **Where:** `updateSales`; `updateSalesSchema` uses `allowUnknown: true` and
  lists `return`, `presentDue`, `invoiceNumber`, `total`… as editable.
- **Problem:** an edit can set the refund total (`return`, which profit
  subtracts), the due, the invoice number, or any unknown field.
- **Tests:** `tests/integration/salesIntegrity.test.js` "[BUG-069]".

### BUG-070 — Changing the advance used on a sale is never applied, but deleting credits it back (High)

- **Where:** `updateSales` ignores a change of `customerAdvancePaymentAdjust`;
  `deleteSales` `$inc`s the stored value back into the advance.
- **Steps:** advance 1000; sale using 0; edit to 800; delete the sale.
- **Expected:** advance 1000. **Actual:** 1800 — 800 of advance created from nothing.
- **Tests:** `tests/integration/salesIntegrity.test.js` "[BUG-070]".

### BUG-071 — A signed-in shopper sees cost prices on the catalogue (High)

- **Where:** `optionalAuth` sets `req.user` for any valid token (shopper
  included) and `forAudience()` only checks `req.user`, so the storefront
  shows `purchasePrice` to every logged-in customer (see also BUG-035 for
  anonymous visitors on the other endpoints).
- **Tests:** `tests/integration/salesIntegrity.test.js` "[BUG-071]".

### BUG-072 — Supplier payments: not transactional, and delete keeps the due cut (High)

- **Where:** `src/controller/supplier.controller.js` `createSupplierDuePayment`
  saves the reduced due and the payment, then fails on an unknown account
  (404) leaving both; `deleteSupplierDuePayment` refunds the account but never
  restores `supplier.openingDues`.
- **Tests:** `tests/integration/salesIntegrity.test.js` "[BUG-072]" (2 cases).

### BUG-073 — Every Steadfast booking fails after Steadfast accepts it (High)

- **Where:** `src/service/couriers/steadFast/SteadFastCourier.js` `createOrder`
  sets `order.orderStatus = "COURIER_" + consignment.status`, a value outside
  the order schema's enum, so `order.save()` fails after the consignment was
  created at Steadfast.
- **Effect:** the API answers 500, the tracking code is never stored, and a
  retry books a second consignment for the same order.
- **Tests:** `tests/integration/courier.test.js` "[BUG-073]" (Steadfast mocked with nock).

### BUG-074 — The IPN success answer swaps message and data (Low)

- **Where:** `payment.controller.js` `ipnPayment`:
  `apiResponse.sendSuccess(res, 200, updatedOrder, "Payment validated and order confirmed")`
  — the order object goes into `message`, the text into `data`.
- **Tests:** `tests/integration/commerce.routes.test.js` "[BUG-074]".

### BUG-075 — Internal errors answer in a different envelope (Low)

- **Where:** `GlobalErrorHandeler.js` `productionError` answers a
  non-operational error with `{ status: "error", message }` — no
  `statusCode`, unlike every other error (`{ statusCode, message, code? }`)
  and unlike `apiResponse.sendError` (`{ status, statusCode, message, data }`).
  Three error shapes in one API; clients must special-case each.
- **Tests:** `tests/contract/envelope.test.js` (routes that reach a 500 are
  listed in `knownFailures.js` `ENVELOPE_DEVIATIONS`).
