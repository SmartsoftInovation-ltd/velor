// Polls an async assertion until it passes or the timeout elapses
const waitFor = async (assertion, { timeout = 3000, interval = 25 } = {}) => {
  const deadline = Date.now() + timeout;
  for (;;) {
    try {
      return await assertion();
    } catch (error) {
      if (Date.now() > deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }
};

module.exports = { waitFor };
