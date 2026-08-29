import { lazy, Suspense } from "react";
import { Route, BrowserRouter as Router, Routes } from "react-router";
import { Toaster } from "react-hot-toast";
import { ScrollToTop } from "./components/common/ScrollToTop";
import ProtectedRoute from "./components/routes/ProtectedRoute";
import AppLayout from "./layout/AppLayout";
import Loader from "./components/common/Loader";
import PageErrorBoundary from "./components/common/PageErrorBoundary";

// Auth Pages dynamic imports
const SignIn = lazy(() => import("./pages/AuthPages/SignIn"));
const SignUp = lazy(() => import("./pages/AuthPages/SignUp"));

// Other Pages
const NotFound = lazy(() => import("./pages/OtherPage/NotFound"));
const Unauthorized = lazy(() => import("./pages/OtherPage/Unauthorized"));
const UserProfiles = lazy(() => import("./pages/UserProfiles"));
const Blank = lazy(() => import("./pages/Blank"));

// Dashboard
const Home = lazy(() => import("./pages/Dashboard/Home"));

// Components - Brand
const BrandList = lazy(() => import("./pages/Brand/BrandList"));
const BrandUpdate = lazy(() => import("./components/brand/BrandUpdate"));
const CreateBrand = lazy(() => import("./pages/Brand/CreateBrand"));
const BrandView = lazy(() => import("./pages/Brand/BrandView"));

// Components - Category
const CategoryUpdate = lazy(
  () => import("./components/category/CategoryUpdate"),
);
const SubCategoryUpdate = lazy(
  () => import("./components/category/SubCategoryUpdate"),
);
const CategoryList = lazy(() => import("./pages/Category/CategoryList"));
const CategoryView = lazy(() => import("./pages/Category/CategoryView"));
const CreateCategory = lazy(() => import("./pages/Category/CreateCategory"));
const CreateSubCategory = lazy(
  () => import("./pages/Category/CreateSubCategory"),
);
const SubCategoryList = lazy(() => import("./pages/Category/SubCategoryList"));
const SubCategoryView = lazy(() => import("./pages/Category/SubCategoryView"));

// Components - Courier
const CourierMerchantList = lazy(
  () => import("./components/courier/CourierMerchantList"),
);
const CourierUpdate = lazy(() => import("./components/courier/CourierUpdate"));
const CourierReturnList = lazy(
  () => import("./components/courier/CourierReturnList.tsx"),
);
const Courier = lazy(() => import("./pages/Courier/Courier"));
const CreateCourierDelivery = lazy(
  () => import("./pages/Courier/CreateCourierDelivery"),
);

// Components - Discount/Coupon
const CouponList = lazy(() => import("./components/discount/CouponList"));
const DiscountList = lazy(() => import("./components/discount/DiscountList"));
const DiscountUpdate = lazy(
  () => import("./components/discount/DiscountUpdate"),
);
const DiscountView = lazy(() => import("./pages/Discount/DiscountView"));
const CouponUpdate = lazy(() => import("./components/discount/CouponUpdate"));
const CouponView = lazy(() => import("./pages/Discount/CouponView"));
const CreateCoupon = lazy(() => import("./pages/Discount/CreateCoupon"));
const CreateDiscount = lazy(() => import("./pages/Discount/CreateDiscount"));

// Components - Product
const ProductList = lazy(() => import("./components/product/ProductList"));
const UpdateProduct = lazy(() => import("./components/product/ProductUpdate"));
const CreateProduct = lazy(() => import("./pages/Product/CreateProduct"));
const ProductView = lazy(() => import("./pages/Product/ProductView"));
const BarcodePrint = lazy(() => import("./pages/Product/BarcodePrint"));

// Components - Purchase
const PurchaseView = lazy(() => import("./components/purchase/PurchaseView"));
const PurchaseInvoicePrint = lazy(
  () => import("./components/purchase/PurchaseInvoicePrint"),
);
const PurchaseList = lazy(() => import("./components/purchase/PurchaseList"));
const PurchaseReturnList = lazy(
  () => import("./components/purchase/PurchaseReturnList"),
);
const PurchaseReturnUpdate = lazy(
  () => import("./components/purchase/PurchaseReturnUpdate"),
);
const PurchaseReturnInvoicePrint = lazy(
  () => import("./components/purchase/PurchaseReturnInvoicePrint"),
);
const UpdatePurchase = lazy(
  () => import("./components/purchase/PurchaseUpdate"),
);
const CreatePurchase = lazy(() => import("./pages/Purchase/CreatePurchase"));
const PurchaseReturn = lazy(() => import("./pages/Purchase/PurchaseReturn"));
const CreateDeliveryCharge = lazy(
  () => import("./pages/Purchase/CreateDeliveryCharge.tsx"),
);
const DeliveryChargeList = lazy(
  () => import("./components/purchase/DeliveryChargeList.tsx"),
);
const DeliveryChargeUpdate = lazy(
  () => import("./components/purchase/DeliveryChargeUpdate.tsx"),
);

// Components - Role & Permission
const RoleUpdate = lazy(() => import("./components/rolepermission/RoleUpdate"));
const CreateRole = lazy(() => import("./pages/RolePermission/CreateRole"));
const CreateUserPermission = lazy(
  () => import("./pages/RolePermission/CreateUserPermission"),
);
const AssignRolePermission = lazy(
  () => import("./pages/RolePermission/AssignRolePermission"),
);
const UserList = lazy(() => import("./pages/UserList/UserList"));
const AddUser = lazy(() => import("./pages/UserList/AddUser"));
const UserView = lazy(() => import("./pages/UserList/UserView"));
const UserEdit = lazy(() => import("./pages/UserList/UserEdit"));

// Components - Audit Log
const AuditLogList = lazy(() => import("./pages/AuditLog/AuditLogList"));

// Components - Stock
const CategoryStockDetails = lazy(
  () => import("./components/stock/CategoryStockDetails"),
);
const LowStock = lazy(() => import("./components/stock/LowStock"));
const SizeColorWiseStock = lazy(
  () => import("./components/stock/SizeColorWiseStock"),
);
const SizeWiseStock = lazy(() => import("./components/stock/SizeWiseStock"));
const StockList = lazy(() => import("./components/stock/StockList"));
const ViewAllStock = lazy(() => import("./components/stock/ViewAllStock"));
const CreateStock = lazy(() => import("./pages/Stock/CreateStock"));
const StockAdjustView = lazy(
  () => import("./components/stock/StockAdjustView"),
);
const StockAdjustEdit = lazy(
  () => import("./components/stock/StockAdjustEdit"),
);

// Components - Order & Tables
const SigleOrderDetails = lazy(
  () => import("./components/tables/OrderTable/SigleOrderDetails"),
);
const OrderList = lazy(() => import("./pages/Order/OrderList"));
const IncompleteOrderList = lazy(
  () => import("./pages/Order/IncompleteOrderList"),
);
const InvoicePreview = lazy(
  () => import("./components/tables/OrderTable/InvoicePreview"),
);
const StickerPreview = lazy(
  () => import("./components/tables/OrderTable/StickerPreview"),
);

// Components - Variant
const UpdateVariant = lazy(() => import("./components/variant/UpdateVariant"));
const VariantList = lazy(() => import("./components/variant/VariantList"));
const CreateVariant = lazy(() => import("./pages/Variant/CreateVariant"));
const VariantView = lazy(() => import("./pages/Variant/VariantView"));

// Components - Accounts
const AccountList = lazy(() => import("./pages/Accounts/AccountList"));
const AccountTransactionHistory = lazy(
  () => import("./pages/Accounts/AccountTransactionHistory"),
);
const AddTransaction = lazy(() => import("./pages/Accounts/AddTransaction"));
const TransactionCategoryList = lazy(
  () => import("./pages/Accounts/TransactionCategoryList"),
);
const TransactionList = lazy(() => import("./pages/Accounts/TransactionList"));
const MoneyHandoverList = lazy(
  () => import("./components/account/MoneyHandoverList"),
);
const MoneyHandoverUpdate = lazy(
  () => import("./components/account/MoneyHandoverUpdate"),
);
const MoneyTransferList = lazy(
  () => import("./components/account/MoneyTransferList"),
);
const MoneyHandover = lazy(() => import("./pages/Accounts/MoneyHandover"));
const MoneyTransfer = lazy(() => import("./pages/Accounts/MoneyTransfer"));

// Components - SMS
const SendBlukSms = lazy(() => import("./pages/SmsNotification/SendBulkSms"));
const SendSms = lazy(() => import("./pages/SmsNotification/SendSms"));
const SmsInfo = lazy(() => import("./pages/SmsNotification/SmsInfo"));
const DueSms = lazy(() => import("./pages/SmsNotification/DueSms"));
const SmsHistory = lazy(() => import("./pages/SmsNotification/SmsHistory"));
const SmsStatus = lazy(() => import("./pages/SmsNotification/SmsStatus"));

// Components - Reports
const AccountBalance = lazy(
  () => import("./components/reports/Account/AccountBalance"),
);
const AccountTransactionSummary = lazy(
  () => import("./components/reports/Account/AccountTransactionSummary"),
);
const CashLedger = lazy(
  () => import("./components/reports/Account/CashLedger"),
);
const FundHandOver = lazy(
  () => import("./components/reports/Account/FundHandOver"),
);
const TransactionAccountWise = lazy(
  () => import("./components/reports/Account/TransactionAccountWise"),
);
const TransactionReport = lazy(
  () => import("./components/reports/Account/TransactionReport"),
);
const TransactionSummary = lazy(
  () => import("./components/reports/Account/TransactionSummary"),
);
const OrderInvoice = lazy(
  () => import("./components/reports/Order/OrderInvoice"),
);
const OrderStatusReport = lazy(
  () => import("./components/reports/Order/OrderStatusReport"),
);
const PurchaseInvoice = lazy(
  () => import("./components/reports/Purchase/PurchaseInvoice"),
);
const PurchaseReturnInvoice = lazy(
  () => import("./components/reports/Purchase/PurchaseReturnInvoice"),
);
const PurchaseSummary = lazy(
  () => import("./components/reports/Purchase/PurchaseSummary"),
);
const SalesInvoiceReport = lazy(
  () => import("./components/reports/Sales/SalesInvoiceReport"),
);
const SalesProductReport = lazy(
  () => import("./components/reports/Sales/SalesProductReport"),
);
const SalesSummaryReport = lazy(
  () => import("./components/reports/Sales/SalesSummaryReport"),
);
const CreateReports = lazy(() => import("./pages/Reports/CreateReports"));
const AccountBalanceView = lazy(
  () => import("./components/tables/ReportTable/Account/AccountBalanceView"),
);
const AccountTransactionSummaryView = lazy(
  () =>
    import("./components/tables/ReportTable/Account/AccountTransactionSummaryView"),
);
const CashLedgerView = lazy(
  () => import("./components/tables/ReportTable/Account/CashLedgerView"),
);
const FundHandOverView = lazy(
  () => import("./components/tables/ReportTable/Account/FundHandOverView"),
);
const TransactionAccountWiseView = lazy(
  () =>
    import("./components/tables/ReportTable/Account/TransactionAccountWiseView"),
);
const TransactionReportView = lazy(
  () => import("./components/tables/ReportTable/Account/TransactionReportView"),
);
const TransactionSummaryView = lazy(
  () =>
    import("./components/tables/ReportTable/Account/TransactionSummaryView"),
);
const PurchaseInvoiceView = lazy(
  () => import("./components/tables/ReportTable/PurchaseInvoiceView"),
);
const PurchaseReturnInvoiceView = lazy(
  () =>
    import("./components/tables/ReportTable/Purchase/PurchaseReturnInvoiceView"),
);
const OrderInvoiceView = lazy(
  () => import("./components/tables/ReportTable/Order/OrderInvoiceView"),
);
const OrderStatusReportView = lazy(
  () => import("./components/tables/ReportTable/Order/OrderStatusReportView"),
);
// Components - Settings
const AddBanner = lazy(() => import("./pages/Settings/banner/AddBanner.tsx"));
const BannerList = lazy(() => import("./pages/Settings/banner/BannerList"));
const BannerUpdate = lazy(
  () => import("./pages/Settings/banner/UpdateBanner.tsx"),
);
const BannerView = lazy(() => import("./pages/Settings/banner/BannerView.tsx"));
const AddSiteInfo = lazy(
  () => import("./pages/Settings/siteinformation/AddSiteInfo.tsx"),
);
const SiteInfoList = lazy(
  () => import("./pages/Settings/siteinformation/SiteInfoList.tsx"),
);
const SiteInformationUpdate = lazy(
  () => import("./pages/Settings/siteinformation/UpdateSiteInfo.tsx"),
);
const AddOutletInfo = lazy(
  () => import("./pages/Settings/outletinformation/Addoutlet.tsx"),
);

// Store Information
const AddStoreInfo = lazy(
  () => import("./pages/Settings/storeinformation/AddStoreInfo.tsx"),
);
const StoreInfoList = lazy(
  () => import("./pages/Settings/storeinformation/StoreInfoList.tsx"),
);
const StoreInfoView = lazy(
  () => import("./pages/Settings/storeinformation/StoreInfoView.tsx"),
);
const UpdateStoreInfo = lazy(
  () => import("./pages/Settings/storeinformation/UpdateStoreInfo.tsx"),
);
const SiteInfoView = lazy(
  () => import("./pages/Settings/siteinformation/SiteInfoView.tsx"),
);
const OutletView = lazy(
  () => import("./pages/Settings/outletinformation/OutletView.tsx"),
);
const OutletInfoList = lazy(
  () => import("./pages/Settings/outletinformation/OutletList.tsx"),
);
const OutletInformationUpdate = lazy(
  () => import("./pages/Settings/outletinformation/UpdateOutlet.tsx"),
);
const AddDiscountBanner = lazy(
  () => import("./pages/Settings/discountbanner/AddDiscountBanner.tsx"),
);
const DiscountBannerList = lazy(
  () => import("./pages/Settings/discountbanner/DiscountBannerList.tsx"),
);
const DiscountBannerUpdate = lazy(
  () => import("./pages/Settings/discountbanner/UpdateDiscountBanner.tsx"),
);
const DiscountBannerView = lazy(
  () => import("./pages/Settings/discountbanner/DiscountBannerView.tsx"),
);

// Components - Employee Management
const CreateEmployee = lazy(
  () => import("./pages/EmployeeManagement/CreateEmployee.tsx"),
);
const EmployeeList = lazy(
  () => import("./components/employee/EmployeeList.tsx"),
);
const EmployeeAdvancePayment = lazy(
  () => import("./pages/EmployeeManagement/EmployeeAdvancePayment.tsx"),
);
const EmployeeAdvancePaymentList = lazy(
  () => import("./components/employee/EmployeeAdvancePaymentList.tsx"),
);
const CreateDesignation = lazy(
  () => import("./pages/EmployeeManagement/CreateDesignation.tsx"),
);
const DesignationList = lazy(
  () => import("./components/employee/DesignationList.tsx"),
);
const CreateDepartment = lazy(
  () => import("./pages/EmployeeManagement/CreateDepartment.tsx"),
);
const DepartmentList = lazy(
  () => import("./components/employee/DepartmentList.tsx"),
);
const CreateSection = lazy(
  () => import("./pages/EmployeeManagement/CreateSection.tsx"),
);
const SectionList = lazy(() => import("./components/employee/SectionList.tsx"));
const EmployeeView = lazy(
  () => import("./pages/EmployeeManagement/EmployeeView.tsx"),
);
const EmployeeInvoicePrint = lazy(
  () => import("./pages/EmployeeManagement/EmployeeInvoicePrint.tsx"),
);
const EmployeeEdit = lazy(
  () => import("./components/employee/EmployeeEdit.tsx"),
);

// Components - Supplier & Customer
const CreateSupplier = lazy(
  () => import("./pages/Supplier/CreateSupplier.tsx"),
);
const SupplierList = lazy(
  () => import("./components/supplier/SupplierList.tsx"),
);
const SupplierEdit = lazy(
  () => import("./components/supplier/SupplierEdit.tsx"),
);
const SupplierView = lazy(() => import("./pages/Supplier/SupplierView.tsx"));
const CreateSupplierPayment = lazy(
  () => import("./pages/Supplier/CreateSupplierPayment.tsx"),
);
const SupplierPaymentList = lazy(
  () => import("./components/supplier/SupplierPaymentList.tsx"),
);
const SupplierPaymentEdit = lazy(
  () => import("./components/supplier/SupplierPaymentEdit.tsx"),
);
const SupplierPaymentInvoicePrint = lazy(
  () => import("./components/supplier/SupplierPaymentInvoicePrint.tsx"),
);
const SupplierProfilePrint = lazy(
  () => import("./components/supplier/SupplierProfilePrint.tsx"),
);
const CreateCustomer = lazy(
  () => import("./pages/Customer/CreateCustomer.tsx"),
);
const CustomerList = lazy(
  () => import("./components/customer/CustomerList.tsx"),
);
const CreateCustomerPayementReceive = lazy(
  () => import("./pages/Customer/CreateCustomerPaymentReceive.tsx"),
);
const CustomerPaymentReceiveList = lazy(
  () => import("./components/customer/CustomerPaymentReceiveList.tsx"),
);
const CustomerPaymentReceiveInvoicePrint = lazy(
  () => import("./components/customer/CustomerPaymentReceiveInvoicePrint.tsx"),
);
const CreateCustomerAdvancePayment = lazy(
  () => import("./pages/Customer/CreateCustomerAdvancePayment.tsx"),
);
const CustomerAdvancePaymentList = lazy(
  () => import("./components/customer/CustomerAdvancePaymentList.tsx"),
);
const CustomerAdvancePaymentInvoicePrint = lazy(
  () => import("./components/customer/CustomerAdvancePaymentInvoicePrint.tsx"),
);
const CustomerPaymentReceiveEdit = lazy(
  () => import("./components/customer/CustomerPaymentReceiveEdit.tsx"),
);
const CustomerAdvancePaymentEdit = lazy(
  () => import("./components/customer/CustomerAdvancePaymentEdit.tsx"),
);
const CustomerTypeList = lazy(
  () => import("./components/customer/CustomerTypeList.tsx"),
);
const CustomerView = lazy(() => import("./pages/Customer/CustomerView.tsx"));
const CustomerEdit = lazy(
  () => import("./components/customer/CustomerEdit.tsx"),
);

// Components - Sales
const CreateRetailSales = lazy(
  () => import("./pages/Sales/CreateRetailSales.tsx"),
);
const CreateWholeSales = lazy(
  () => import("./pages/Sales/CreateWholeSales.tsx"),
);
const SalesHistoryList = lazy(
  () => import("./components/sales/SalesHistoryList.tsx"),
);
const CreateSalesReturn = lazy(
  () => import("./pages/Sales/CreateSalesReturn.tsx"),
);
const SalesReturnList = lazy(
  () => import("./pages/Sales/SalesReturnList.tsx"),
);
const SalesInvoicePrint = lazy(
  () => import("./components/sales/SalesInvoicePrint.tsx"),
);
const SalesChallanPrint = lazy(
  () => import("./components/sales/SalesChallanPrint.tsx"),
);
const SalesView = lazy(() => import("./components/sales/SalesView.tsx"));
const SalesEdit = lazy(() => import("./components/sales/SalesEdit.tsx"));
const SalesReceiptPrint = lazy(
  () => import("./components/sales/SalesReceiptPrint.tsx"),
);
const SalesReturnInvoicePrint = lazy(
  () => import("./components/sales/SalesReturnInvoicePrint.tsx"),
);
const RetailSaleOrderList = lazy(
  () => import("./components/sales/RetailSaleOrderList.tsx"),
);
const SaleOrderList = lazy(
  () => import("./components/sales/SaleOrderList.tsx"),
);
const DraftOrderList = lazy(
  () => import("./components/sales/DraftOrderList.tsx"),
);
const CreateRetailSaleOrder = lazy(
  () => import("./pages/Sales/CreateRetailSaleOrder.tsx"),
);
const WholeSaleOrderList = lazy(
  () => import("./components/sales/WholeSaleOrderList.tsx"),
);
const CreateWholeSaleOrder = lazy(
  () => import("./pages/Sales/CreateWholeSaleOrder.tsx"),
);

// Form Elements
const FormElements = lazy(() => import("./pages/Forms/FormElements"));

// Components - SizeChart
const SizeChartList = lazy(() => import("./pages/SizeChart/SizeChartList"));
const CreateSizeChart = lazy(() => import("./pages/SizeChart/CreateSizeChart"));
const SizeChartUpdate = lazy(
  () => import("./components/sizeChart/SizeChartUpdate"),
);
const SizeChartView = lazy(() => import("./pages/SizeChart/SizeChartView"));

export default function App() {
  return (
    <>
      <div className="fixed top-0 left-0 w-full z-9999999 pointer-events-none">
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              pointerEvents: "auto",
            },
          }}
        />
      </div>
      <Router>
        <ScrollToTop />
        <PageErrorBoundary>
          <Suspense fallback={<Loader />}>
            <Routes>
              {/* Dashboard Layout */}
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route index path="/" element={<Home />} />

                {/* Others Page */}
                <Route path="/profile" element={<UserProfiles />} />
                <Route path="/blank" element={<Blank />} />

                {/* Forms */}
                <Route path="/form-elements" element={<FormElements />} />

                {/* Size Guide */}
                {/* <Route path="/size-guide" element={<CreateSizeGuide />} /> */}

                {/* Categories */}
                <Route path="/create-category" element={<ProtectedRoute module="category" action="add"><CreateCategory /></ProtectedRoute>} />
                <Route path="/category-list" element={<ProtectedRoute module="category" action="view"><CategoryList /></ProtectedRoute>} />
                <Route
                  path="/update-category/:slug"
                  element={<CategoryUpdate />}
                />
                <Route path="/category-view/:slug" element={<ProtectedRoute module="category" action="view"><CategoryView /></ProtectedRoute>} />

                {/* Sub Categories */}
                <Route
                  path="/create-subcategory"
                  element={<CreateSubCategory />}
                />
                <Route path="/subcategory-list" element={<ProtectedRoute module="sub-category" action="view"><SubCategoryList /></ProtectedRoute>} />
                <Route
                  path="/subcategory-view/:slug"
                  element={<SubCategoryView />}
                />
                <Route
                  path="/update-subcategory/:slug"
                  element={<SubCategoryUpdate />}
                />

                {/* Brand */}
                <Route path="/create-brand" element={<ProtectedRoute module="brand" action="add"><CreateBrand /></ProtectedRoute>} />
                <Route path="/brand-list" element={<ProtectedRoute module="brand" action="view"><BrandList /></ProtectedRoute>} />
                <Route
                  path="/update-brand/:slug"
                  element={
                    <ProtectedRoute module="brand" action="edit">
                      <BrandUpdate />
                    </ProtectedRoute>
                  }
                />
                <Route path="/brand-view/:slug" element={<ProtectedRoute module="brand" action="view"><BrandView /></ProtectedRoute>} />

                {/* Discount */}
                <Route path="/create-discount" element={<ProtectedRoute module="discount" action="add"><CreateDiscount /></ProtectedRoute>} />
                <Route path="/discount-list" element={<ProtectedRoute module="discount" action="view"><DiscountList /></ProtectedRoute>} />
                <Route
                  path="/update-discount/:slug"
                  element={<DiscountUpdate />}
                />
                <Route path="/discount-view/:slug" element={<ProtectedRoute module="discount" action="view"><DiscountView /></ProtectedRoute>} />
                <Route path="/create-coupon" element={<ProtectedRoute module="coupon" action="add"><CreateCoupon /></ProtectedRoute>} />
                <Route path="/coupon-list" element={<ProtectedRoute module="coupon" action="view"><CouponList /></ProtectedRoute>} />
                <Route
                  path="/update-coupon/:slug"
                  element={
                    <ProtectedRoute module="coupon" action="edit">
                      <CouponUpdate />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/coupon-view/:slug"
                  element={
                    <ProtectedRoute module="coupon" action="view">
                      <CouponView />
                    </ProtectedRoute>
                  }
                />

                {/* Product */}
                <Route path="/create-product" element={<ProtectedRoute module="product" action="add"><CreateProduct /></ProtectedRoute>} />
                <Route path="/product-list" element={<ProtectedRoute module="product" action="view"><ProductList /></ProtectedRoute>} />
                <Route
                  path="/update-product/:slug"
                  element={<UpdateProduct />}
                />
                <Route path="/product-view/:slug" element={<ProtectedRoute module="product" action="view"><ProductView /></ProtectedRoute>} />
                <Route path="/barcode-print" element={<ProtectedRoute module="barcode-print" action="view"><BarcodePrint /></ProtectedRoute>} />

                {/* Purchase */}
                <Route path="/add-purchase" element={<ProtectedRoute module="purchase" action="add"><CreatePurchase /></ProtectedRoute>} />
                <Route path="/purchase-list" element={<ProtectedRoute module="purchase" action="view"><PurchaseList /></ProtectedRoute>} />
                <Route path="/purchase-view/:id" element={<ProtectedRoute module="purchase" action="view"><PurchaseView /></ProtectedRoute>} />
                <Route path="/purchase-invoice-print/:id" element={<ProtectedRoute module="purchase" action="view"><PurchaseInvoicePrint /></ProtectedRoute>} />
                <Route
                  path="/update-purchase/:id"
                  element={<UpdatePurchase />}
                />
                <Route
                  path="/purchase-return"
                  element={
                    <ProtectedRoute module="purchase-return" action="view">
                      <PurchaseReturn />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/purchase-return-list"
                  element={<PurchaseReturnList />}
                />
                <Route
                  path="/update-purchase-return/:slug"
                  element={<PurchaseReturnUpdate />}
                />
                <Route
                  path="/purchase-return-invoice-print/:id"
                  element={<ProtectedRoute module="purchase-return" action="view"><PurchaseReturnInvoicePrint /></ProtectedRoute>}
                />
                <Route
                  path="/create-delivery-charge"
                  element={<CreateDeliveryCharge />}
                />
                <Route
                  path="/delivery-charge-list"
                  element={<DeliveryChargeList />}
                />
                <Route
                  path="/update-delivery-charge/:id"
                  element={<DeliveryChargeUpdate />}
                />

                {/* Variant */}
                <Route path="/create-variant" element={<ProtectedRoute module="variant" action="add"><CreateVariant /></ProtectedRoute>} />
                <Route path="/variant-list" element={<ProtectedRoute module="variant" action="view"><VariantList /></ProtectedRoute>} />
                <Route
                  path="/update-variant/:slug"
                  element={<UpdateVariant />}
                />
                <Route path="/variant-view/:slug" element={<ProtectedRoute module="variant" action="view"><VariantView /></ProtectedRoute>} />

                {/* Order */}
                <Route path="/order-list" element={<ProtectedRoute module="order" action="view"><OrderList /></ProtectedRoute>} />
                <Route
                  path="/orderdetails/:id"
                  element={<SigleOrderDetails />}
                />
                <Route
                  path="/incomplete-order-list"
                  element={<IncompleteOrderList />}
                />
                <Route path="/invoice/:id" element={<InvoicePreview />} />
                <Route path="/sticker/:id" element={<StickerPreview />} />

                {/* Courier */}
                <Route
                  path="/courier"
                  element={
                    <ProtectedRoute module="courier-merchant" action="view">
                      <Courier />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/update-merchant/:id"
                  element={<CourierUpdate />}
                />
                <Route
                  path="/courier-merchant-list"
                  element={<CourierMerchantList />}
                />
                <Route
                  path="/create-courier-delivery"
                  element={<CreateCourierDelivery />}
                />
                <Route
                  path="/courier-return-list"
                  element={<CourierReturnList />}
                />

                {/* Stock */}
                <Route path="/view-all-stock" element={<ProtectedRoute module="view-all-stock" action="view"><ViewAllStock /></ProtectedRoute>} />
                <Route path="/stock-adjustment" element={<ProtectedRoute module="stock-adjustment" action="add"><CreateStock /></ProtectedRoute>} />
                <Route path="/stock-adjustment-list" element={<ProtectedRoute module="stock-adjustment" action="view"><StockList /></ProtectedRoute>} />
                <Route
                  path="/stock-adjustment-view/:id"
                  element={<StockAdjustView />}
                />
                <Route
                  path="/stock-adjustment-edit/:id"
                  element={<StockAdjustEdit />}
                />
                <Route
                  path="/category-stock-detail"
                  element={<CategoryStockDetails />}
                />
                <Route path="/size-wise-stock" element={<ProtectedRoute module="size-wise-stock" action="view"><SizeWiseStock /></ProtectedRoute>} />
                <Route
                  path="/size-color-wise-stock"
                  element={<SizeColorWiseStock />}
                />
                <Route path="/low-stock" element={<ProtectedRoute module="low-stock" action="view"><LowStock /></ProtectedRoute>} />

                {/* SMS Notification */}
                <Route
                  path="/sendsms"
                  element={
                    <ProtectedRoute module="send-sms" action="view">
                      <SendSms />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/sendbluksms"
                  element={
                    <ProtectedRoute module="send-bulk-sms" action="view">
                      <SendBlukSms />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/smsinfo"
                  element={
                    <ProtectedRoute module="sms-info" action="view">
                      <SmsInfo />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/due-sms"
                  element={
                    <ProtectedRoute module="send-sms" action="view">
                      <DueSms />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/sms-history"
                  element={
                    <ProtectedRoute module="sms-info" action="view">
                      <SmsHistory />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/sms-status"
                  element={
                    <ProtectedRoute module="sms-info" action="view">
                      <SmsStatus />
                    </ProtectedRoute>
                  }
                />

                {/* Role & Permission Layout */}
                <Route path="/create-role" element={<ProtectedRoute module="create-role" action="add"><CreateRole /></ProtectedRoute>} />
                <Route path="/update-role/:slug" element={<ProtectedRoute module="create-role" action="edit"><RoleUpdate /></ProtectedRoute>} />
                <Route path="/userlist" element={<ProtectedRoute module="create-user" action="view"><UserList /></ProtectedRoute>} />
                <Route path="/add-user" element={<ProtectedRoute module="create-user" action="add"><AddUser /></ProtectedRoute>} />
                <Route path="/user-view/:id" element={<ProtectedRoute module="create-user" action="view"><UserView /></ProtectedRoute>} />
                <Route path="/user-edit/:id" element={<ProtectedRoute module="create-user" action="edit"><UserEdit /></ProtectedRoute>} />
                <Route path="/create-user-permission" element={<ProtectedRoute module="create-permission" action="add"><CreateUserPermission /></ProtectedRoute>} />
                <Route path="/assign-role-permission" element={<ProtectedRoute module="create-permission" action="add"><AssignRolePermission /></ProtectedRoute>} />
                <Route path="/audit-log" element={<ProtectedRoute module="audit-log" action="view"><AuditLogList /></ProtectedRoute>} />

                {/* Accounts  */}
                <Route path="/account-list" element={<ProtectedRoute module="add-account" action="view"><AccountList /></ProtectedRoute>} />
                <Route path="/account-history/:accountId" element={<ProtectedRoute module="add-account" action="view"><AccountTransactionHistory /></ProtectedRoute>} />
                <Route path="/add-transaction" element={<ProtectedRoute module="add-transaction" action="add"><AddTransaction /></ProtectedRoute>} />
                <Route
                  path="/transaction-category-list"
                  element={<TransactionCategoryList />}
                />
                <Route path="/transaction-list" element={<ProtectedRoute module="add-transaction" action="view"><TransactionList /></ProtectedRoute>} />
                <Route path="/add-money-transfer" element={<ProtectedRoute module="money-transfer" action="add"><MoneyTransfer /></ProtectedRoute>} />
                <Route
                  path="/money-transfer-list"
                  element={<MoneyTransferList />}
                />
                <Route
                  path="/money-handover-description"
                  element={<MoneyHandover />}
                />
                <Route
                  path="/money-handover-list"
                  element={<MoneyHandoverList />}
                />
                <Route
                  path="/update-money-handover/:id"
                  element={<MoneyHandoverUpdate />}
                />

                {/* Side Information banner */}
                <Route path="/add-banner" element={<ProtectedRoute module="create-banner" action="add"><AddBanner /></ProtectedRoute>} />
                <Route path="/banner-list" element={<ProtectedRoute module="create-banner" action="view"><BannerList /></ProtectedRoute>} />
                <Route
                  path="/update-banner/:slug"
                  element={
                    <ProtectedRoute module="create-banner" action="edit">
                      <BannerUpdate />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/view-banner/:slug"
                  element={
                    <ProtectedRoute module="create-banner" action="view">
                      <BannerView />
                    </ProtectedRoute>
                  }
                />

                {/* Side Information site info */}
                <Route path="/add-site-info" element={<ProtectedRoute module="site-information" action="add"><AddSiteInfo /></ProtectedRoute>} />
                <Route path="/site-info-list" element={<ProtectedRoute module="site-information" action="view"><SiteInfoList /></ProtectedRoute>} />
                <Route
                  path="/update-site-info/:slug"
                  element={<SiteInformationUpdate />}
                />
                <Route
                  path="/view-site-info/:slug"
                  element={<SiteInfoView />}
                />

                {/* outlet information */}
                <Route path="/add-outlet" element={<ProtectedRoute module="outlet-information" action="add"><AddOutletInfo /></ProtectedRoute>} />
                <Route path="/outlet-list" element={<ProtectedRoute module="outlet-information" action="view"><OutletInfoList /></ProtectedRoute>} />
                <Route
                  path="/update-outlet-info/:slug"
                  element={<OutletInformationUpdate />}
                />
                <Route
                  path="/view-outlet-info/:slug"
                  element={<OutletView />}
                />

                {/* Store Information */}
                <Route
                  path="/add-store-info"
                  element={
                    <ProtectedRoute module="site-information" action="add">
                      <AddStoreInfo />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/store-info-list"
                  element={
                    <ProtectedRoute module="site-information" action="view">
                      <StoreInfoList />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/store-info-view/:slug"
                  element={
                    <ProtectedRoute module="site-information" action="view">
                      <StoreInfoView />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/update-store-info/:slug"
                  element={
                    <ProtectedRoute module="site-information" action="edit">
                      <UpdateStoreInfo />
                    </ProtectedRoute>
                  }
                />

                {/* Discount information */}
                <Route path="/add-discount" element={<ProtectedRoute module="discount-banner" action="add"><AddDiscountBanner /></ProtectedRoute>} />
                <Route
                  path="/discount-banner-list"
                  element={<DiscountBannerList />}
                />
                <Route
                  path="/update-discount-banner/:slug"
                  element={<DiscountBannerUpdate />}
                />
                <Route
                  path="/view-discount-banner/:slug"
                  element={<DiscountBannerView />}
                />

                {/* All Report */}
                <Route
                  path="/purchase-invoice"
                  element={
                    <ProtectedRoute module="purchase-invoice" action="view">
                      <PurchaseInvoice />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/purchase-invoice/view"
                  element={<PurchaseInvoiceView />}
                />
                <Route
                  path="/purchase-summary"
                  element={
                    <ProtectedRoute module="purchase-summary" action="view">
                      <PurchaseSummary />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/purchase-return-invoice"
                  element={<PurchaseReturnInvoice />}
                />
                <Route
                  path="/purchase-return-invoice/view"
                  element={<PurchaseReturnInvoiceView />}
                />

                <Route
                  path="/order-invoice"
                  element={
                    <ProtectedRoute module="order-invoice" action="view">
                      <OrderInvoice />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/order-invoice/view"
                  element={<OrderInvoiceView />}
                />
                <Route
                  path="/order-status-report"
                  element={<OrderStatusReport />}
                />
                <Route
                  path="/order-status-report/view"
                  element={<OrderStatusReportView />}
                />

                <Route path="/all-reports" element={<CreateReports />} />
                <Route
                  path="/sales-invoice"
                  element={
                    <ProtectedRoute module="sales-invoice-report" action="view">
                      <SalesInvoiceReport />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/sales-product"
                  element={
                    <ProtectedRoute module="sales-product-report" action="view">
                      <SalesProductReport />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/sales-summary"
                  element={
                    <ProtectedRoute module="sales-summary-report" action="view">
                      <SalesSummaryReport />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/transaction-report"
                  element={<TransactionReport />}
                />
                <Route
                  path="/transaction-report/view"
                  element={<TransactionReportView />}
                />
                <Route
                  path="/transaction-summary"
                  element={<TransactionSummary />}
                />
                <Route
                  path="/transaction-summary/view"
                  element={<TransactionSummaryView />}
                />
                <Route
                  path="/cash-ledger"
                  element={
                    <ProtectedRoute module="cash-ledger" action="view">
                      <CashLedger />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/cash-ledger/view"
                  element={
                    <ProtectedRoute module="cash-ledger" action="view">
                      <CashLedgerView />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/transaction-account-wise"
                  element={<TransactionAccountWise />}
                />
                <Route
                  path="/transaction-account-wise/view"
                  element={<TransactionAccountWiseView />}
                />
                <Route
                  path="/account-transaction-summary"
                  element={<AccountTransactionSummary />}
                />
                <Route
                  path="/account-transaction-summary/view"
                  element={<AccountTransactionSummaryView />}
                />
                <Route
                  path="/account-balance"
                  element={
                    <ProtectedRoute module="account-balance" action="view">
                      <AccountBalance />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/account-balance/view"
                  element={<AccountBalanceView />}
                />
                <Route
                  path="/fund-handover"
                  element={
                    <ProtectedRoute module="fund-handover" action="view">
                      <FundHandOver />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/fund-handover/view"
                  element={<FundHandOverView />}
                />

                <Route path="/create-employee" element={<ProtectedRoute module="employee" action="add"><CreateEmployee /></ProtectedRoute>} />
                <Route path="/employee-list" element={<ProtectedRoute module="employee" action="view"><EmployeeList /></ProtectedRoute>} />
                <Route
                  path="/employee-view/:id"
                  element={
                    <ProtectedRoute module="employee" action="view">
                      <EmployeeView />
                    </ProtectedRoute>
                  }
                />
                <Route path="/employee-invoice-print/:id" element={<ProtectedRoute module="employee" action="view"><EmployeeInvoicePrint /></ProtectedRoute>} />
                <Route
                  path="/employee-edit/:id"
                  element={
                    <ProtectedRoute module="employee" action="edit">
                      <EmployeeEdit />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/create-employee-advance-payment"
                  element={<EmployeeAdvancePayment />}
                />
                <Route
                  path="/employee-advance-payment-list"
                  element={<EmployeeAdvancePaymentList />}
                />
                <Route
                  path="/create-designation"
                  element={<CreateDesignation />}
                />
                <Route
                  path="/designation-list"
                  element={
                    <ProtectedRoute module="designation" action="view">
                      <DesignationList />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/create-department"
                  element={<CreateDepartment />}
                />
                <Route
                  path="/department-list"
                  element={
                    <ProtectedRoute module="department" action="view">
                      <DepartmentList />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/create-section"
                  element={
                    <ProtectedRoute module="section" action="add">
                      <CreateSection />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/section-list"
                  element={
                    <ProtectedRoute module="section" action="view">
                      <SectionList />
                    </ProtectedRoute>
                  }
                />

                <Route path="/create-supplier" element={<ProtectedRoute module="supplier" action="add"><CreateSupplier /></ProtectedRoute>} />
                <Route path="/supplier-list" element={<ProtectedRoute module="supplier" action="view"><SupplierList /></ProtectedRoute>} />
                <Route
                  path="/supplier-view/:supplierId"
                  element={<SupplierView />}
                />
                <Route
                  path="/supplier-edit/:supplierId"
                  element={<SupplierEdit />}
                />
                <Route
                  path="/create-supplier-payment"
                  element={<CreateSupplierPayment />}
                />
                <Route
                  path="/supplier-payment-list"
                  element={<SupplierPaymentList />}
                />
                <Route
                  path="/supplier-payment-edit/:id"
                  element={<SupplierPaymentEdit />}
                />
                <Route
                  path="/supplier-payment-invoice-print/:id"
                  element={<ProtectedRoute module="supplier-payment" action="view"><SupplierPaymentInvoicePrint /></ProtectedRoute>}
                />
                <Route
                  path="/supplier-profile-print/:supplierId"
                  element={<ProtectedRoute module="supplier" action="view"><SupplierProfilePrint /></ProtectedRoute>}
                />

                <Route
                  path="/customer-type-list"
                  element={<CustomerTypeList />}
                />
                <Route path="/create-customer" element={<ProtectedRoute module="customer" action="add"><CreateCustomer /></ProtectedRoute>} />
                <Route path="/customer-list" element={<ProtectedRoute module="customer" action="view"><CustomerList /></ProtectedRoute>} />
                <Route
                  path="/customer-view/:customerId"
                  element={<CustomerView />}
                />
                <Route
                  path="/customer-edit/:customerId"
                  element={<CustomerEdit />}
                />
                <Route
                  path="/customer-payment-receive"
                  element={<CreateCustomerPayementReceive />}
                />
                <Route
                  path="/customer-payment-receive-list"
                  element={<CustomerPaymentReceiveList />}
                />
                <Route
                  path="/customer-payment-receive-edit/:customerId"
                  element={<CustomerPaymentReceiveEdit />}
                />
                <Route
                  path="/customer-payment-receive-invoice-print/:id"
                  element={<CustomerPaymentReceiveInvoicePrint />}
                />
                <Route
                  path="/customer-advance-payment"
                  element={<CreateCustomerAdvancePayment />}
                />
                <Route
                  path="/advance-payment-list"
                  element={<CustomerAdvancePaymentList />}
                />
                <Route
                  path="/customer-advance-payment-edit/:customerId"
                  element={<CustomerAdvancePaymentEdit />}
                />
                <Route
                  path="/customer-advance-payment-invoice-print/:id"
                  element={<CustomerAdvancePaymentInvoicePrint />}
                />

                <Route
                  path="/create-retail-sales"
                  element={<ProtectedRoute module="retail-sales" action="add"><CreateRetailSales /></ProtectedRoute>}
                />
                <Route
                  path="/create-whole-sales"
                  element={<ProtectedRoute module="wholesale-sales" action="add"><CreateWholeSales /></ProtectedRoute>}
                />
                <Route path="/sales-history" element={<ProtectedRoute module="sales-history" action="view"><SalesHistoryList /></ProtectedRoute>} />
                <Route path="/sales-invoice-print/:invoiceNumber" element={<ProtectedRoute module="sales-history" action="view"><SalesInvoicePrint /></ProtectedRoute>} />
                <Route path="/sales-receipt-print/:invoiceNumber" element={<ProtectedRoute module="sales-history" action="view"><SalesReceiptPrint /></ProtectedRoute>} />
                <Route path="/sales-challan-print/:invoiceNumber" element={<ProtectedRoute module="sales-history" action="view"><SalesChallanPrint /></ProtectedRoute>} />
                <Route path="/sales-view/:invoiceNumber" element={<ProtectedRoute module="sales-history" action="view"><SalesView /></ProtectedRoute>} />
                <Route path="/sales-edit/:invoiceNumber" element={<ProtectedRoute module="sales-history" action="edit"><SalesEdit /></ProtectedRoute>} />
                <Route path="/sales-return" element={<ProtectedRoute module="retail-sales" action="add"><CreateSalesReturn /></ProtectedRoute>} />
                <Route path="/sales-return-list" element={<ProtectedRoute module="retail-sales" action="view"><SalesReturnList /></ProtectedRoute>} />
                <Route path="/sales-return-invoice-print/:id" element={<ProtectedRoute module="retail-sales" action="view"><SalesReturnInvoicePrint /></ProtectedRoute>} />
                <Route
                  path="/retail-sale-order"
                  element={<ProtectedRoute module="retail-sale-order" action="add"><CreateRetailSaleOrder /></ProtectedRoute>}
                />
                <Route
                  path="/retail-sale-order-list"
                  element={<ProtectedRoute module="retail-sale-order" action="view"><RetailSaleOrderList /></ProtectedRoute>}
                />
                <Route
                  path="/sale-order-list"
                  element={
                    <ProtectedRoute
                      anyOfModules={["retail-sale-order", "whole-sale-order"]}
                      action="view"
                    >
                      <SaleOrderList />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/whole-sale-order"
                  element={<ProtectedRoute module="whole-sale-order" action="add"><CreateWholeSaleOrder /></ProtectedRoute>}
                />
                <Route
                  path="/whole-sale-order-list"
                  element={<ProtectedRoute module="whole-sale-order" action="view"><WholeSaleOrderList /></ProtectedRoute>}
                />
                <Route
                  path="/draft-order-list"
                  element={<ProtectedRoute module="sales-history" action="view"><DraftOrderList /></ProtectedRoute>}
                />

                {/* SizeChart */}
                <Route path="/sizechart-list" element={<ProtectedRoute module="size-chart" action="view"><SizeChartList /></ProtectedRoute>} />
                <Route path="/create-sizechart" element={<ProtectedRoute module="size-chart" action="add"><CreateSizeChart /></ProtectedRoute>} />
                <Route
                  path="/update-sizechart/:slug"
                  element={<SizeChartUpdate />}
                />
                <Route
                  path="/sizechart-view/:slug"
                  element={<SizeChartView />}
                />
              </Route>

              {/* Auth Layout */}
              <Route path="/signin" element={<SignIn />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/unauthorized" element={<Unauthorized />} />

              {/* Fallback Route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </PageErrorBoundary>
      </Router>
    </>
  );
}
