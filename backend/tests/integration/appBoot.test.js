const request = require("supertest");
const { connectTestDb, disconnectTestDb } = require("../helpers/db");

describe("app boot with tenancy plugin in shadow mode", () => {
  let server;
  let io;

  beforeAll(async () => {
    process.env.REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
    await connectTestDb();
    ({ server, io } = require("../../src/app"));
  });

  afterAll(async () => {
    io.close();
    const { connection, cache } = require("../../src/config/redis.config");
    await Promise.allSettled([connection.quit(), cache.quit()]);
    await disconnectTestDb();
  });

  it("loads every route, controller and model", async () => {
    const res = await request(server).get("/api/v1/definitely-not-a-route");
    expect(res.status).toBe(404);
  });

  it("mounts the platform API behind the platform guard", async () => {
    await request(server).get("/api/v1/platform/tenants").expect(401);
    await request(server).post("/api/v1/platform/auth/refresh").expect(401);
  });

  it("serves an existing public endpoint without a tenant context", async () => {
    const res = await request(server).get("/api/v1/categories-active");
    expect(res.status).toBeLessThan(500);
  });
});
