require("dotenv").config();
const mongoose=require("mongoose");
(async()=>{
  await mongoose.connect(process.env.DATABASE_URL);
  const db=mongoose.connection.db;
  const sales=await db.collection("sales")
    .find({changes:{$gt:0}}).project({paid:1,changes:1,netPaid:1,invoiceNumber:1}).toArray();

  const perAccount={};
  const plan=[];
  for(const s of sales){
    const txs=await db.collection("cratetransactions")
      .find({saleReference:s._id,transactionType:"cash recived"}).sort({_id:1}).toArray();
    const sum=txs.reduce((a,t)=>a+t.amount,0);
    // same rule as runtime: change off the last entries first
    let remaining=s.changes;
    const edits=[];
    for(let i=txs.length-1;i>=0&&remaining>0;i--){
      const take=Math.min(txs[i].amount,remaining);
      edits.push({tx:txs[i]._id,account:txs[i].account,from:txs[i].amount,to:txs[i].amount-take,delta:-take});
      remaining-=take;
    }
    edits.forEach(e=>{const k=String(e.account);perAccount[k]=(perAccount[k]||0)+e.delta;});
    plan.push({inv:s.invoiceNumber,paid:s.paid,chg:s.changes,net:s.netPaid,txSum:sum,edits});
  }
  console.log("=== PER SALE ===");
  plan.forEach(p=>{
    console.log(`inv ${p.inv}: paid ${p.paid} chg ${p.chg} net ${p.net} | txSum ${p.txSum}`);
    p.edits.forEach(e=>console.log(`   tx ${e.tx} ${e.from} -> ${e.to}`));
    if(p.txSum!==p.paid) console.log("   !! txSum != paid, skipping would be safer");
  });
  console.log("\n=== PER ACCOUNT DELTA ===");
  for(const [acc,d] of Object.entries(perAccount)){
    const a=await db.collection("accounts").findOne({_id:new mongoose.Types.ObjectId(acc)});
    console.log(`  ${a?a.accountName||a.name:acc}: balance ${a&&a.balance} delta ${d} -> ${a&&a.balance+d}`);
  }
  console.log("\ntotal delta:",Object.values(perAccount).reduce((a,b)=>a+b,0));
  await mongoose.disconnect();
})().catch(e=>{console.error(e.message);process.exit(1);});
