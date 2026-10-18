module.exports = async () => {
  await globalThis.__TEST_REDIS__?.stop();
  await globalThis.__MONGO_REPLSET__?.stop();
};
