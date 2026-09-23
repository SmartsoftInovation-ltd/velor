require("dotenv").config();
const mongoose=require("mongoose");
const Tenant=require("./src/models/platform/tenant.model");
const {runForTenant}=require("./src/tenancy/context");
const DCS=require("./src/models/dailyCashSummary.model");
const salesModel=require("./src/models/sales.model");
const {customerPaymentRecived, customerAdvancePaymentModel}=require("./src/models/customer.model");
const crateTransactionModel=require("./src/models/crateTransaction.model");
const purchaseModel=require("./src/models/purchase.model");
const {SupplierDuePayment}=require("./src/models/supplier.model");
const purchaseReturnModel=require("./src/models/purchaseReturn.model");
const salesReturnModel=require("./src/models/salesReturn.model");

const round2=n=>Math.round((n+Number.EPSILON)*100)/100;
const APPLY=process.argv.includes("--apply");

// Mirrors getDayCashSummary exactly.
async function totalsFor(dayStart, dayEnd){
  const dateMatch={date:{$gte:dayStart,$lte:dayEnd}};
  const [salesPaid,cp,cap,cashRecv,purchasePaid,sp,cashPay,purRet,salRet]=await Promise.all([
    salesModel.aggregate([{$match:dateMatch},{$group:{_id:null,amount:{$sum:{$ifNull:["$netPaid",{$max:[0,{$subtract:[{$ifNull:["$paid",0]},{$ifNull:["$changes",0]}]}]}]}}}}]),
    customerPaymentRecived.aggregate([{$match:{...dateMatch,deletedAt:null}},{$group:{_id:null,paidAmount:{$sum:"$paidAmount"},lessAmount:{$sum:"$lessAmount"},cashBack:{$sum:"$cashBack"}}}]),
    customerAdvancePaymentModel.aggregate([{$match:{...dateMatch,deletedAt:null}},{$group:{_id:null,paidAmount:{$sum:"$paidAmount"},cashBack:{$sum:"$advanceCashBack"}}}]),
    crateTransactionModel.aggregate([{$match:{...dateMatch,transactionType:"cash recived",saleReference:null,customerPaymentReference:null,customerAdvancePaymentReference:null,purchaseReturnReference:null}},{$group:{_id:null,amount:{$sum:"$amount"}}}]),
    purchaseModel.aggregate([{$match:dateMatch},{$group:{_id:null,amount:{$sum:"$paid"}}}]),
    SupplierDuePayment.aggregate([{$match:{...dateMatch,deletedAt:null}},{$group:{_id:null,paidAmount:{$sum:"$paidAmount"},lessAmount:{$sum:"$lessAmount"}}}]),
    crateTransactionModel.aggregate([{$match:{...dateMatch,transactionType:"cash payment",purchaseReference:null,supplierPaymentReference:null,salesReturnReference:null}},{$group:{_id:null,amount:{$sum:"$amount"}}}]),
    purchaseReturnModel.aggregate([{$match:{returnDate:{$gte:dayStart,$lte:dayEnd}}},{$group:{_id:null,amount:{$sum:"$totalReturnAmount"}}}]),
    salesReturnModel.aggregate([{$match:{date:{$gte:dayStart,$lte:dayEnd}}},{$group:{_id:null,amount:{$sum:"$totalReturnAmount"}}}]),
  ]);
  const c=cp[0]||{}, a=cap[0]||{}, s=sp[0]||{};
  return {
    totalReceive: round2((salesPaid[0]?.amount||0)+((c.paidAmount||0)-(c.lessAmount||0)-(c.cashBack||0))+((a.paidAmount||0)-(a.cashBack||0))+(cashRecv[0]?.amount||0)+(purRet[0]?.amount||0)),
    totalPayment: round2((purchasePaid[0]?.amount||0)+((s.paidAmount||0)-(s.lessAmount||0))+(cashPay[0]?.amount||0)+(salRet[0]?.amount||0)),
  };
}

(async()=>{
  await mongoose.connect(process.env.DATABASE_URL);
  for (const t of await Tenant.find({}).lean()) {
    await runForTenant(t._id, async()=>{
      const rows=await DCS.find({}).sort({date:1});
      if(!rows.length){ console.log(`\n[${t.slug}] no rows`); return; }
      console.log(`\n[${t.slug}] ${rows.length} rows`);
      let running=0;                       // first day opens at 0
      for(const r of rows){
        const start=new Date(r.date);
        const end=new Date(start); end.setHours(23,59,59,999);
        const {totalReceive,totalPayment}=await totalsFor(start,end);
        const closing=round2(running+totalReceive-totalPayment);
        const changed = r.openingBalance!==running || r.totalReceive!==totalReceive
                     || r.totalPayment!==totalPayment || r.closingBalance!==closing;
        console.log(`  ${start.toISOString().slice(0,10)}  open ${r.openingBalance}→${running}   recv ${r.totalReceive}→${totalReceive}   paid ${r.totalPayment}→${totalPayment}   close ${r.closingBalance}→${closing}${changed?"":"   (no change)"}`);
        if(APPLY){
          r.openingBalance=running; r.totalReceive=totalReceive;
          r.totalPayment=totalPayment; r.closingBalance=closing;
          await r.save();
        }
        running=closing;
      }
      console.log(`  final closing: ${running}`);
    });
  }
  console.log(APPLY?"\n=== APPLIED ===":"\n=== DRY RUN (no writes) ===");
  await mongoose.disconnect();
})();
