const http = require("http");
const { io: connect } = require("socket.io-client");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { STAFF_ENV, createTenantWithStaff } = require("../helpers/tenantApp");
const { invalidateTenantCache } = require("../../src/tenancy/tenantResolver");
const socketModule = require("../../src/socket/socket");
const { waitFor } = require("../helpers/waitFor");

describe("tenant socket rooms", () => {
  let server;
  let url;
  let pizza;
  let burger;
  const clients = [];
  const envBackup = { ...process.env };

  beforeAll(async () => {
    Object.assign(process.env, STAFF_ENV);
    await connectTestDb();
    server = http.createServer();
    socketModule.initSocket(server);
    await new Promise((resolve) => server.listen(0, resolve));
    url = `http://127.0.0.1:${server.address().port}`;
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  beforeEach(async () => {
    invalidateTenantCache();
    pizza = await createTenantWithStaff({ slug: "pizzashop" });
    burger = await createTenantWithStaff({ slug: "burgerhub" });
  });

  afterEach(async () => {
    clients.splice(0).forEach((c) => c.close());
    process.env = { ...envBackup, ...STAFF_ENV };
    await clearTestDb();
  });

  afterAll(async () => {
    socketModule.getIO().close();
    await new Promise((resolve) => server.close(resolve));
    process.env = { ...envBackup };
    jest.restoreAllMocks();
    await disconnectTestDb();
  });

  const open = (auth) =>
    new Promise((resolve, reject) => {
      const client = connect(url, { transports: ["websocket"], auth, reconnection: false, forceNew: true });
      clients.push(client);
      client.on("connect", () => resolve(client));
      client.on("connect_error", reject);
    });

  const tokenFor = (user) => user.generateJwtAccessToken();
  const received = (client, event) => {
    const events = [];
    client.on(event, (payload) => events.push(payload));
    return events;
  };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 100));

  it("delivers tenant events only to that tenant's staff", async () => {
    const pizzaClient = await open({ token: await tokenFor(pizza.user) });
    const burgerClient = await open({ token: await tokenFor(burger.user) });
    const pizzaEvents = received(pizzaClient, "orderPlaced");
    const burgerEvents = received(burgerClient, "orderPlaced");

    socketModule.emitToTenant(pizza.tenant._id, "orderPlaced", { id: 1 });
    await waitFor(() => expect(pizzaEvents).toEqual([{ id: 1 }]));
    await settle();
    expect(burgerEvents).toEqual([]);
  });

  it("delivers user events only to that user", async () => {
    const client = await open({ token: await tokenFor(pizza.user) });
    const events = received(client, "addwishlist");

    socketModule.emitToUserOrGuest(pizza.tenant._id, { userId: pizza.user._id }, "addwishlist", { ok: true });
    socketModule.emitToUserOrGuest(burger.tenant._id, { userId: pizza.user._id }, "addwishlist", { wrong: true });
    await waitFor(() => expect(events).toEqual([{ ok: true }]));
    await settle();
    expect(events).toEqual([{ ok: true }]);
  });

  it("guests join their own room inside a store", async () => {
    const client = await open({ tenant: "pizzashop", guestId: "guest-1" });
    const events = received(client, "getwishlist");

    socketModule.emitToUserOrGuest(pizza.tenant._id, { guestId: "guest-1" }, "getwishlist", { n: 1 });
    socketModule.emitToUserOrGuest(burger.tenant._id, { guestId: "guest-1" }, "getwishlist", { n: 2 });
    await waitFor(() => expect(events).toEqual([{ n: 1 }]));
    await settle();
    expect(events).toEqual([{ n: 1 }]);
  });

  it("rejects an invalid token", async () => {
    await expect(open({ token: "not-a-token" })).rejects.toThrow(/unauthorized/i);
  });

  it("rejects anonymous connections in strict mode", async () => {
    process.env.TENANCY_MODE = "strict";
    await expect(open({})).rejects.toThrow(/unauthorized/i);
  });
});
