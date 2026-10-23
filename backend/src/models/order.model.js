const mongoose = require("mongoose");
const { tenantPlugin } = require("../tenancy/tenantPlugin");
const Product = require("./product.model");
const { required } = require("joi");

const orderSchema = new mongoose.Schema(
  {
    // USER INFO (Registered or Guest)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    guestId: {
      type: String, // For guest users tracking
      default: null,
    },

    // ORDER ITEMS SNAPSHOT
    items: [
      // {
      //   productId: {
      //     type: mongoose.Schema.Types.ObjectId,
      //     ref: "Product",
      //     required: true,
      //   },
      //   name: String,
      //   quantity: Number,
      //   totalPrice: Number,
      //   retailPrice: Number,
      //   size: String,
      //   color: String,
      // },
    ],

    // SHIPPING INFO
    shippingInfo: {
      fullName: { type: String, required: false },
      phone: { type: String },
      address: { type: String, required: false },
      email: { type: String },
      city: { type: String },
      postalCode: { type: String },
      // A delivery instruction from the shopper ("leave at reception")
      note: { type: String },
      // city: {
      //   city_id: { type: Number },
      //   city_name: { type: String },
      // },
      // zone: {
      //   zone_id: { type: Number },
      //   zone_name: { type: String },
      // },
      // area: {
      //   area_id: { type: Number },
      //   area_name: { type: String },
      // },

      country: {
        type: String,
        default: "Bangladesh",
      },
      deliveryZone: {
        type: String,
        enum: ["inside_dhaka", "outside_dhaka", "sub_area"],
      },
    },

    productWeight: { type: Number, default: 0 }, // in grams
    // DELIVERY CHARGE
    deliveryCharge: {
      type: mongoose.Types.ObjectId,
      ref: "Delivery",
    },

    // COUPON / DISCOUNT
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      default: null,
    },

    totalAmount: {
      type: Number, // subtotal + deliveryCharge - discount
      required: true,
    },

    discountAmount: {
      type: Number,
      default: 0,
    },

    // FINAL AMOUNTS
    finalAmount: {
      type: Number, // total of items before delivery or discount
      required: true,
    },
    // PAYMENT INFO
    paymentMethod: {
      type: String,
      enum: ["cod", "sslcommerz"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "success", "failed", "cancelled"],
      default: "Pending",
    },

    // SSLCommerz Payment Gateway Specific
    transactionId: {
      type: String, // sslcommerz transaction_id
      default: null,
    },
    valId: {
      type: String, // sslcommerz val_id used to verify
      default: null,
    },
    // sslcommerz session key, for asking the gateway what became of a payment
    sessionKey: {
      type: String,
      default: null,
    },
    // When a validated payment was recorded
    paidAt: {
      type: Date,
      default: null,
    },
    currency: {
      type: String,
      default: "BDT",
    },
    paymentGatewayData: {
      type: mongoose.Schema.Types.Mixed, // store full SSLCommerz response if needed
      default: {},
    },

    // ORDER STATUS
    orderStatus: {
      type: String,
      enum: [
        "Pending",
        "Hold",
        "Confirmed",
        "Packaging",
        "CourierPending",
        "Courier",
        "Shipped",
        "Delivered",
        "Cancelled",
      ],
      default: "Pending",
    },

    // INVOICE ID (Optional)
    invoiceId: {
      type: String,
      default: null,
    },
    // COURIER
    courier: {
      name: {
        type: String,
        default: null,
      },
      trackingId: { type: String, default: null },
      rawResponse: { type: mongoose.Schema.Types.Mixed, default: null },
      status: {
        type: String,
        default: "pending",
      },
    },
    orderType: {
      type: String,
      default: "complete", // complete or partialit
    },

    /**
     * Where the order was taken.
     *
     * Both the storefront and the dashboard write into this one collection, so
     * every report, invoice, courier booking and SMS keeps working on a single
     * query. This field is what lets a report still say "web vs counter" when
     * that split is wanted, without splitting the data to get it.
     *
     * `web`  — a shopper checking out on the store's own site
     * `pos`  — a staff member entering an order (phone, walk-in)
     *
     * Defaults to `pos` because that is what existed before the storefront: old
     * rows were all entered by staff, so the default describes them correctly.
     */
    channel: {
      type: String,
      enum: ["web", "pos"],
      default: "pos",
      index: true,
    },
    /**
     * Which conversation the customer came through — Website, Messenger,
     * WhatsApp, over the phone. The shop manages the list itself (OrderSource),
     * but the chosen name is copied onto the order rather than referenced, so
     * renaming or removing a source later never rewrites order history.
     *
     * A storefront checkout is always "Website"; a staff member picks the rest
     * while entering the order.
     */
    orderFrom: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    // The staff member who entered a counter order; null for a web order
    placedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    followUp: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    isAutoPlaced: {
      type: Boolean,
      default: false,
    },
    totalQuantity: { type: Number, default: 0 },
  },
  { timestamps: true },
);

orderSchema.plugin(tenantPlugin);
module.exports = mongoose.models.Order || mongoose.model("Order", orderSchema);
