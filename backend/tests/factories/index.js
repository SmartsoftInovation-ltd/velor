const { Factory } = require("fishery");
const { faker } = require("@faker-js/faker");
const mongoose = require("mongoose");
const { runForTenant } = require("../../src/tenancy/context");
const Tenant = require("../../src/models/platform/tenant.model");
const Category = require("../../src/models/category.model");
const Brand = require("../../src/models/brand.model");
const Product = require("../../src/models/product.model");
const Variant = require("../../src/models/variant.model");
const Account = require("../../src/models/account.model");
const Coupon = require("../../src/models/coupon.model");
const Discount = require("../../src/models/discount.model");
const Employee = require("../../src/models/employee.model");
const { SupplierModel: Supplier } = require("../../src/models/supplier.model");
const { customerModel: Customer, CustomerType } = require("../../src/models/customer.model");

// Deterministic data: the same seed gives the same names every run, so a
// failing test reproduces exactly.
faker.seed(20261016);

const uid = () => new mongoose.Types.ObjectId().toString().slice(-10);
const digits = (n) => String(Date.now() + Math.floor(Math.random() * 1e6)).slice(-n).padStart(n, "1");

/**
 * Builds a factory whose documents are created inside a tenant:
 *   productFactory.create({ stock: 5 }, { transient: { tenant } })
 * or bind once with forTenant(tenant).product.create({ stock: 5 }).
 * Documents go through Mongoose (validation + hooks + tenant plugin).
 */
const scoped = (Model, build, { beforeCreate } = {}) =>
  Factory.define(({ sequence, params, transientParams, onCreate }) => {
    onCreate(async (attrs) => {
      const tenant = transientParams.tenant;
      if (!tenant) throw new Error(`${Model.modelName} factory needs { transient: { tenant } }`);
      return runForTenant(tenant._id || tenant, async () => {
        const ready = beforeCreate ? await beforeCreate(attrs, transientParams) : attrs;
        return Model.create(ready);
      });
    });
    return build({ sequence, params, transientParams });
  });

class TenantFactory extends Factory {
  active() {
    return this.params({ status: "active" });
  }
  suspended() {
    return this.params({ status: "suspended" });
  }
}
const tenantFactory = TenantFactory.define(({ sequence, onCreate }) => {
  onCreate((attrs) => Tenant.create(attrs));
  return { name: faker.company.name(), slug: `shop-${sequence}-${uid()}`.toLowerCase(), status: "active" };
});

const categoryFactory = scoped(Category, ({ sequence }) => ({ name: `${faker.commerce.department()} ${sequence} ${uid()}` }));

const brandFactory = scoped(Brand, ({ sequence }) => ({ name: `${faker.company.name()} ${sequence} ${uid()}` }));

class ProductFactory extends Factory {
  outOfStock() {
    return this.params({ stock: 0 });
  }
  costing(purchasePrice) {
    return this.params({ purchasePrice });
  }
}
const productFactory = ProductFactory.define(({ sequence, transientParams, onCreate }) => {
  onCreate(async (attrs) => {
    const tenant = transientParams.tenant;
    if (!tenant) throw new Error("Product factory needs { transient: { tenant } }");
    return runForTenant(tenant._id || tenant, async () => {
      const category = attrs.category || (await Category.create({ name: `Cat ${uid()}` }))._id;
      return Product.create({ ...attrs, category });
    });
  });
  return {
    name: `${faker.commerce.productName()} ${sequence} ${uid()}`,
    variantType: "singleVariant",
    stock: 100,
    purchasePrice: 400,
    retailPrice: 600,
    wholesalePrice: 500,
    barCode: digits(12),
    sku: `SKU${digits(8)}`,
    isActive: true,
  };
});

const variantFactory = scoped(Variant, ({ sequence }) => ({
  variantName: `Variant ${sequence} ${uid()}`,
  stockVariant: 50,
  purchasePrice: 300,
  retailPrice: 450,
  wholesalePrice: 400,
  barCode: digits(12),
  sku: digits(9),
  size: faker.helpers.arrayElement(["S", "M", "L", "XL"]),
  color: faker.color.human(),
}));

const accountFactory = scoped(Account, ({ sequence }) => ({ name: `Cash ${sequence} ${uid()}`, balance: 0 }));

const employeeFactory = scoped(Employee, ({ sequence }) => ({
  fullName: faker.person.fullName(),
  gender: "male",
  mobile: `018${digits(8)}`,
  employeeId: `EMP-${sequence}-${uid()}`,
}));

const customerFactory = scoped(
  Customer,
  ({ sequence }) => ({
    fullName: faker.person.fullName(),
    mobileNumber: `019${String(sequence).padStart(2, "0")}${digits(6)}`,
    openingDues: 0,
  }),
  {
    beforeCreate: async (attrs) => {
      if (attrs.customerType) return attrs;
      const type = (await CustomerType.findOne({ slug: "regular" })) || (await CustomerType.create({ customerType: "Regular" }));
      return { ...attrs, customerType: type._id };
    },
  },
);

const supplierFactory = scoped(Supplier, () => ({
  supplierName: faker.company.name(),
  mobile: `017${digits(8)}`,
}));

class CouponFactory extends Factory {
  expired() {
    const past = new Date(Date.now() - 2 * 864e5);
    return this.params({ couponStartAt: new Date(Date.now() - 10 * 864e5), expireAt: past });
  }
  notStarted() {
    return this.params({ couponStartAt: new Date(Date.now() + 864e5), expireAt: new Date(Date.now() + 10 * 864e5) });
  }
  fixed(amount = 100) {
    return this.params({ discountType: "fixed", discountValue: amount });
  }
  limited(usageLimit, usedCount = 0) {
    return this.params({ usageLimit, usedCount });
  }
}
const couponFactory = CouponFactory.define(({ sequence, transientParams, onCreate }) => {
  onCreate((attrs) => runForTenant(transientParams.tenant._id || transientParams.tenant, () => Coupon.create(attrs)));
  return {
    code: `SAVE${sequence}${digits(4)}`,
    discountType: "percentage",
    discountValue: 10,
    couponStartAt: new Date(Date.now() - 864e5),
    expireAt: new Date(Date.now() + 30 * 864e5),
    isActive: true,
  };
});

const discountFactory = scoped(Discount, ({ sequence }) => ({
  discountName: `Discount ${sequence} ${uid()}`,
  discountValidFrom: new Date(Date.now() - 864e5),
  discountValidTo: new Date(Date.now() + 864e5),
  discountType: "percentance",
  discountValueByAmount: 0,
  discountValueByPercentance: 10,
  discountPlan: "flat",
  isActive: true,
}));

// Every factory pre-bound to one tenant
const forTenant = (tenant) => {
  const bind = (factory) => ({
    build: (params) => factory.build(params, { transient: { tenant } }),
    create: (params) => factory.create(params, { transient: { tenant } }),
    createList: (n, params) => factory.createList(n, params, { transient: { tenant } }),
    factory: factory.transient({ tenant }),
  });
  return {
    category: bind(categoryFactory),
    brand: bind(brandFactory),
    product: bind(productFactory),
    variant: bind(variantFactory),
    account: bind(accountFactory),
    employee: bind(employeeFactory),
    customer: bind(customerFactory),
    supplier: bind(supplierFactory),
    coupon: bind(couponFactory),
    discount: bind(discountFactory),
  };
};

module.exports = {
  faker,
  tenantFactory,
  categoryFactory,
  brandFactory,
  productFactory,
  variantFactory,
  accountFactory,
  employeeFactory,
  customerFactory,
  supplierFactory,
  couponFactory,
  discountFactory,
  forTenant,
};
