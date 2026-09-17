require('module-alias/register');
require('dotenv').config();
const mongoose = require('mongoose');
const { runAsPlatform } = require('./src/tenancy/context');
const { tenantModels } = require('./src/migrations/models');
(async () => {
  await mongoose.connect(process.env.DATABASE_URL, { autoIndex: false });
  await runAsPlatform(async () => {
    const models = tenantModels();
    console.log('tenant-scoped models:', models.length);

    console.log('\n--- documents missing tenantId (cutover blocks on these) ---');
    let blocked = false;
    for (const M of models) {
      const n = await M.collection.countDocuments({ tenantId: { $exists: false } });
      if (n) { console.log(' ', M.collection.collectionName, '=', n); blocked = true; }
    }
    if (!blocked) console.log('  none');

    console.log('\n--- global unique indexes that WOULD be dropped ---');
    for (const M of models) {
      let idx;
      try { idx = await M.collection.indexes(); } catch { continue; }
      for (const i of idx) {
        if (i.name !== '_id_' && i.unique && Object.keys(i.key)[0] !== 'tenantId') {
          console.log(' ', M.collection.collectionName + '.' + i.name, JSON.stringify(i.key));
        }
      }
    }
  });
  await mongoose.disconnect();
  process.exit(0);
})();
