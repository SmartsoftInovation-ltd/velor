const { spawn, execFileSync } = require("child_process");
const net = require("net");
const fs = require("fs");
const os = require("os");
const path = require("path");

/**
 * Starts a throwaway redis-server for the test run.
 *
 * Docker (and so Testcontainers) is not available on the development machine,
 * so the suite runs the real `redis-server` binary instead of a container:
 * same server, same commands, no mocks. CI can point at its own Redis by
 * exporting REDIS_TEST_URL before running Jest; then nothing is started here.
 */

const freePort = () =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });

const findBinary = () => {
  const candidates = [process.env.REDIS_SERVER_BIN, "redis-server", "/usr/bin/redis-server", "/usr/local/bin/redis-server"].filter(Boolean);
  for (const bin of candidates) {
    try {
      execFileSync(bin, ["--version"], { stdio: "ignore" });
      return bin;
    } catch {
      // try the next one
    }
  }
  return null;
};

const ping = (port) =>
  new Promise((resolve) => {
    const socket = net.connect(port, "127.0.0.1");
    socket.setTimeout(500);
    socket.on("connect", () => socket.write("PING\r\n"));
    socket.on("data", (data) => {
      socket.destroy();
      resolve(data.toString().includes("PONG"));
    });
    socket.on("error", () => resolve(false));
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });

const startTestRedis = async () => {
  if (process.env.REDIS_TEST_URL) {
    return { url: process.env.REDIS_TEST_URL.replace(/\/\d+$/, ""), stop: async () => {} };
  }

  const bin = findBinary();
  if (!bin) {
    throw new Error(
      "redis-server not found. Install it (apt install redis-server / brew install redis) " +
        "or export REDIS_TEST_URL=redis://host:port pointing at a disposable Redis.",
    );
  }

  const port = await freePort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "velor-test-redis-"));
  const child = spawn(
    bin,
    ["--port", String(port), "--bind", "127.0.0.1", "--save", "", "--appendonly", "no", "--dir", dir, "--databases", "32"],
    { stdio: "ignore" },
  );

  for (let i = 0; i < 100; i += 1) {
    if (await ping(port)) break;
    if (child.exitCode !== null) throw new Error(`redis-server exited with code ${child.exitCode}`);
    await new Promise((r) => setTimeout(r, 50));
  }
  if (!(await ping(port))) throw new Error("redis-server did not start");

  return {
    url: `redis://127.0.0.1:${port}`,
    stop: async () => {
      child.kill("SIGTERM");
      await new Promise((r) => (child.exitCode !== null ? r() : child.once("exit", r)));
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
};

module.exports = { startTestRedis };
