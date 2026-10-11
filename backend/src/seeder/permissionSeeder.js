const Permission = require("../models/permisson.model");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

//  Client Required Permissions (Final)
const permissionList = [
  // Product
  { permissionName: "Product" },
  { permissionName: "Category" },
  { permissionName: "Sub Category" },
  { permissionName: "Brand" },
  { permissionName: "Barcode Print" },
  // Variant & Size
  { permissionName: "Size Chart" },
  { permissionName: "Variant" },
  // Purchase
  { permissionName: "Purchase" },
  { permissionName: "Purchase Return" },
  { permissionName: "Delivery Charge" },
  // Discount
  { permissionName: "Discount" },
  { permissionName: "Discount Banner" },
  { permissionName: "Coupon" },
  // Order
  { permissionName: "Order" },
  // Storefront live chat: the shop's inbox of visitor conversations
  { permissionName: "Chat" },
  { permissionName: "Incomplete Order" },
  // Courier
  { permissionName: "Courier Merchant" },
  { permissionName: "Courier Delivery" },
  { permissionName: "Courier Return" },
  // Stock
  { permissionName: "View All Stock" },
  { permissionName: "Stock Adjustment" },
  { permissionName: "Category Stock Details" },
  { permissionName: "Size & Color Wise Stock" },
  { permissionName: "Size Wise Stock" },
  { permissionName: "Low Stock" },
  // Accounts
  { permissionName: "Add Transaction" },
  { permissionName: "Transaction Category" },
  { permissionName: "Add Account" },
  { permissionName: "Money Transfer" },
  { permissionName: "Money Handover" },
  // SMS
  { permissionName: "Send SMS" },
  { permissionName: "Send Bulk SMS" },
  { permissionName: "SMS Info" },
  // Employee
  { permissionName: "Employee" },
  { permissionName: "Designation" },
  { permissionName: "Department" },
  { permissionName: "Section" },
  // Supplier
  { permissionName: "Supplier" },
  { permissionName: "Supplier Payment" },
  // Customer
  { permissionName: "Customer Type" },
  { permissionName: "Customer" },
  { permissionName: "Customer Payment" },
  { permissionName: "Advance Payment" },
  // Sales
  { permissionName: "Retail Sales" },
  { permissionName: "Wholesale Sales" },
  { permissionName: "Sales History" },
  { permissionName: "Retail Sale Order" },
  { permissionName: "Whole Sale Order" },
  // Reports
  { permissionName: "Purchase Invoice" },
  { permissionName: "Purchase Product Report" },
  { permissionName: "Purchase Summary" },
  { permissionName: "Purchase Return Report" },
  { permissionName: "Purchase Return Summary" },
  { permissionName: "Order Invoice" },
  { permissionName: "Order Status Report" },
  { permissionName: "Sales Invoice Report" },
  { permissionName: "Sales Product Report" },
  { permissionName: "Sales Summary Report" },
  { permissionName: "Customer Sales Invoice Report" },
  { permissionName: "Customer Sales Product Report" },
  { permissionName: "Customer Sales Summary Report" },
  { permissionName: "Customer Payment Report" },
  { permissionName: "Customer Balance Summary Report" },
  { permissionName: "Customer Ledger Report" },
  { permissionName: "Customer Due List Report" },
  { permissionName: "Customer Invoice Profit Report" },
  { permissionName: "Invoice Profit Report" },
  { permissionName: "Product Profit Report" },
  { permissionName: "Top Sales Product Report" },
  { permissionName: "Push Sales Product Report" },
  { permissionName: "Top Customer Report" },
  { permissionName: "Supplier Purchase Invoice Report" },
  { permissionName: "Supplier Payment Report" },
  { permissionName: "Supplier Ledger Report" },
  { permissionName: "Supplier Balance Summary Report" },
  { permissionName: "Supplier Dues Report" },
  { permissionName: "Stock Report" },
  { permissionName: "Stock Details Report" },
  { permissionName: "Product Ledger Report" },
  { permissionName: "Size Color Stock Report" },
  { permissionName: "Size Wise Stock Report" },
  { permissionName: "Stock Adjustment Report" },
  { permissionName: "Low Stock Report" },
  { permissionName: "Transaction Report" },
  { permissionName: "Transaction Summary" },
  { permissionName: "All Transaction Summary" },
  { permissionName: "Accounts Ledger" },
  { permissionName: "Account Day Transaction" },
  { permissionName: "Cash Ledger" },
  { permissionName: "Transaction Account Wise" },
  { permissionName: "Account Transaction Summary" },
  { permissionName: "Account Balance" },
  { permissionName: "Fund Handover" },
  { permissionName: "Employee List Report" },
  { permissionName: "Employee Payment Report" },
  // Settings
  { permissionName: "Create Banner" },
  { permissionName: "Site Information" },
  { permissionName: "Outlet Information" },
  // User Management
  { permissionName: "Create User" },
  { permissionName: "Create Role" },
  { permissionName: "Create Permission" },
  // Audit
  { permissionName: "Audit Log" },
  // Dashboard widgets — each box on the dashboard is independently grantable,
  // so an admin can expose the whole dashboard or only selected boxes.
  { permissionName: "Dashboard" },
  { permissionName: "Dashboard Total Invoices" },
  { permissionName: "Dashboard Total Sale" },
  { permissionName: "Dashboard Total Transaction" },
  { permissionName: "Dashboard Accounts Balance" },
  { permissionName: "Dashboard Inventory Items" },
  { permissionName: "Dashboard Customer" },
  { permissionName: "Dashboard Supplier" },
  { permissionName: "Dashboard Employee" },
  { permissionName: "Dashboard Purchase Items" },
  { permissionName: "Dashboard Sold Items" },
  { permissionName: "Dashboard Inventory Value" },
  { permissionName: "Dashboard Stock Cost Value" },
  { permissionName: "Dashboard Total Products" },
  { permissionName: "Dashboard Supplier Payment" },
  { permissionName: "Dashboard Customer Due Payment" },
  { permissionName: "Dashboard Revenue Trend" },
  { permissionName: "Dashboard Sales By Type" },
  { permissionName: "Dashboard Accounts Balance List" },
  { permissionName: "Dashboard Recent Sales" },
  { permissionName: "Dashboard Top Selling Products" },
  { permissionName: "Dashboard Inflow Transactions" },
  { permissionName: "Dashboard Outflow Transactions" },
  { permissionName: "Dashboard Day Cash Summary" },
  { permissionName: "Dashboard Payment Status" },
  { permissionName: "Dashboard Low Stock Alert" },
  // Store settings (multi-tenant)
  { permissionName: "Store Settings" },
];

async function seedPermission() {
  try {
    console.log("🌱 Seeding permissions (upsert — skips existing)...");

    let inserted = 0;
    let skipped = 0;

    for (const item of permissionList) {
      const existing = await Permission.findOne({
        permissionName: item.permissionName,
      });
      if (existing) {
        console.log(`⏭  Skipped (already exists): ${item.permissionName}`);
        skipped++;
      } else {
        await Permission.create(item);
        console.log(`✔  Inserted: ${item.permissionName}`);
        inserted++;
      }
    }

    console.log(`\n🎉 Done! Inserted: ${inserted}, Skipped: ${skipped}`);
  } catch (error) {
    console.error("❌ Error while seeding permissions:", error);
  }
}

mongoose
  .connect(process.env.DATABASE_URL)
  .then(() => {
    console.log("✅ Connected to MongoDB");
    return seedPermission();
  })
  .then(() => {
    mongoose.disconnect();
    console.log("🔌 MongoDB disconnected.");
  })
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  });
