/**
 * The two kinds of account a store holds, in one `User` collection.
 *
 * Staff sign in to the dashboard, shoppers sign in on the storefront, and
 * neither set of credentials works on the other side. `accountType` is set
 * when the account is created and says which one it is. Accounts saved before
 * the field existed fall back to the old rule (a role means staff) until
 * migration 019 stamps them.
 *
 * A role still matters for staff: a staff account with no role can do nothing
 * in the dashboard, so it is not signed in at all.
 */
const STAFF = "staff";
const SHOPPER = "shopper";

const accountTypeOf = (user) => user?.accountType || (user?.roles?.length ? STAFF : SHOPPER);

// May sign in on the storefront
const isShopper = (user) => Boolean(user) && accountTypeOf(user) === SHOPPER && !user.roles?.length;

// May sign in to the dashboard
const isStaff = (user) => Boolean(user) && accountTypeOf(user) === STAFF && user.roles?.length > 0;

// Dashboard-side accounts, for queries: everything that is not a storefront shopper
const STAFF_ACCOUNT_FILTER = {
  $or: [{ accountType: STAFF }, { accountType: { $exists: false }, "roles.0": { $exists: true } }],
};

module.exports = { STAFF, SHOPPER, accountTypeOf, isShopper, isStaff, STAFF_ACCOUNT_FILTER };
