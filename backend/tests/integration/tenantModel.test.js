const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const Tenant = require("../../src/models/platform/tenant.model");

describe("Tenant model", () => {
  beforeAll(async () => {
    await connectTestDb();
    await Tenant.init();
  });
  afterEach(clearTestDb);
  afterAll(disconnectTestDb);

  const build = (overrides = {}) => new Tenant({ name: "Pizza Shop", slug: "pizzashop", ...overrides });

  it("requires name and slug", async () => {
    const error = new Tenant({}).validateSync();
    expect(error.errors.name).toBeDefined();
    expect(error.errors.slug).toBeDefined();
  });

  it("normalizes the slug", async () => {
    const tenant = await build({ slug: "  PizzaShop " }).save();
    expect(tenant.slug).toBe("pizzashop");
  });

  it.each([
    ["too short", "ab"],
    ["too long", "a".repeat(31)],
    ["leading hyphen", "-pizza"],
    ["trailing hyphen", "pizza-"],
    ["invalid characters", "pizza_shop"],
    ["spaces inside", "pizza shop"],
  ])("rejects a slug that is %s", (_, slug) => {
    expect(build({ slug }).validateSync()?.errors.slug).toBeDefined();
  });

  it("accepts letters, digits and inner hyphens", () => {
    expect(build({ slug: "pizza-shop-2" }).validateSync()).toBeUndefined();
  });

  it.each(["www", "app", "api", "platform", "admin"])("rejects the reserved slug %s", (slug) => {
    expect(build({ slug }).validateSync()?.errors.slug.message).toMatch(/reserved/i);
  });

  it("enforces a unique slug", async () => {
    await build().save();
    await expect(build({ name: "Other" }).save()).rejects.toThrow(/duplicate key/);
  });

  it("defaults status to provisioning and rejects unknown statuses", () => {
    expect(build().status).toBe("provisioning");
    expect(build({ status: "deleted" }).validateSync()?.errors.status).toBeDefined();
  });

  it("generates a distinct URL-safe webhook key that does not change on later saves", async () => {
    const a = await build().save();
    const b = await build({ slug: "burgerhub", name: "Burger Hub" }).save();

    expect(a.webhookKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.webhookKey).not.toBe(b.webhookKey);

    const original = a.webhookKey;
    a.name = "Pizza Shop BD";
    await a.save();
    expect(a.webhookKey).toBe(original);
  });
});
