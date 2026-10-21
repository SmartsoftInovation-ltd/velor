const nock = require("nock");
const { useIntegrationApp } = require("../setup/integration");
const { api } = require("../helpers/api");
const { createUserIn, tokenFor } = require("../helpers/auth");
const { tenantFactory, forTenant } = require("../factories");
const { routeInventory, concretePath } = require("../helpers/routeInventory");
const { ENVELOPE_DEVIATIONS } = require("./knownFailures");

/**
 * One success format and one error format across the whole API
 * (docs/openapi.yaml: components.schemas.SuccessEnvelope / ErrorEnvelope).
 *
 *   success: { status: "OK", statusCode: <2xx>, message: string, data?: any }
 *   error:   { statusCode: <4xx|5xx>, message: string, code?: string }
 *
 * Every route is called as the store owner (empty body, unknown ids) against
 * a store with a little data, and the answer is checked against the shape for
 * its status. Routes that answer in another shape are listed in
 * knownFailures.js (ENVELOPE_DEVIATIONS) with the bug that explains them.
 */
const isSuccess = (b, status) =>
  b && b.status === "OK" && b.statusCode === status && typeof b.message === "string";
const isError = (b, status) =>
  b && typeof b.message === "string" && b.statusCode === status && (b.code === undefined || typeof b.code === "string") && !("errorStack" in b);

const routes = routeInventory().filter(
  (r) => !/\/platform\//.test(r.fullPath) && !r.platformManaged && r.auth !== "webhook",
);
const label = (r) => `${r.method} ${r.fullPath}`;

describe("response envelope consistency", () => {
  const ctx = useIntegrationApp({ clearAfterEach: false });
  let token;

  beforeAll(async () => {
    nock.disableNetConnect();
    nock.enableNetConnect(/127\.0\.0\.1|localhost/);
    const tenant = await tenantFactory.create({ slug: "envshop" });
    const owner = await createUserIn(tenant, { owner: true, raw: true });
    const f = forTenant(tenant);
    await f.product.create();
    await f.customer.create();
    await f.account.create();
    token = tokenFor(owner);
  });
  afterAll(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  for (const route of routes) {
    const key = label(route);
    const t = ENVELOPE_DEVIATIONS[key] ? test.failing : test;
    t(`${key}${ENVELOPE_DEVIATIONS[key] ? ` [${ENVELOPE_DEVIATIONS[key]}]` : ""}`, async () => {
      const res = await api(ctx.server, { token, tenant: "envshop", headers: { "x-guest-id": "env-guest" } })
        .request(route.method, concretePath(route, "0123456789abcdef01234567"))
        .send({});
      if (res.status >= 300 && res.status < 400) return; // redirects (payment return URLs)
      if (/attachment/.test(res.headers["content-disposition"] || "")) return; // file downloads (CSV/XLS reports)
      const ok = res.status < 300 ? isSuccess(res.body, res.status) : isError(res.body, res.status);
      if (!ok) throw new Error(`${res.status} ${JSON.stringify(res.body).slice(0, 300)}`);
    });
  }
});
