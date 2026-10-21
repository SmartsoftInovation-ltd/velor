// Sales, sales returns, purchases and customer/supplier payments all write into
// the transaction ledger, each tagging its row with the reference field that
// lets the originating record reverse it later. A manual entry (typed on
// /add-transaction) carries none of them. Used by the transaction list and its
// reports, and by the partial index that holds only manual rows.
const MANUAL_ENTRY_ONLY = {
  saleReference: { $eq: null },
  supplierPaymentReference: { $eq: null },
  customerPaymentReference: { $eq: null },
  customerAdvancePaymentReference: { $eq: null },
  purchaseReference: { $eq: null },
  salesReturnReference: { $eq: null },
  purchaseReturnReference: { $eq: null },
};

module.exports = { MANUAL_ENTRY_ONLY };
