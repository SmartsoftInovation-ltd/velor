import CreateRetailSalesForm from "./CreateRetailSalesForm";

// A retail sale order is the exact same flow as a retail sale — discount
// limits, mutual discount/less-taka locking, product-discount locking, all of
// it — but saved as a pending order. In pending status the backend skips the
// stock deduction, so an order can be placed even when stock is short; the
// stock is committed later when the order is marked complete.
const CreateRetailSaleOrderForm = () => {
  return <CreateRetailSalesForm orderMode />;
};

export default CreateRetailSaleOrderForm;
