import CreateWholeSalesForm from "./CreateWholeSalesForm";

// A wholesale sale order is the exact same flow as a wholesale sale — discount
// limits, mutual discount/less-taka locking, product-discount locking, pack
// expansion, all of it — but saved as a pending order. In pending status the
// backend skips the stock deduction, so an order can be placed even when stock
// is short; the stock is committed later when the order is marked complete.
const CreateWholeSaleOrderForm = () => {
    return <CreateWholeSalesForm orderMode />;
};

export default CreateWholeSaleOrderForm;
