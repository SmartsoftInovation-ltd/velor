const http = require("http");
const { io: connect } = require("socket.io-client");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { STAFF_ENV, createTenantWithStaff } = require("../helpers/tenantApp");
const { invalidateTenantCache } = require("../../src/tenancy/tenantResolver");
const { runForTenant } = require("../../src/tenancy/context");
const socketModule = require("../../src/socket/socket");
const ChatConversation = require("../../src/models/chatConversation.model");
const ChatMessage = require("../../src/models/chatMessage.model");

/**
 * A visitor chatting on one shop's storefront must reach that shop's staff and
 * nobody else's. The rooms carry the tenant id, so these tests check the thing
 * that would actually break isolation: a payload claiming to be from somewhere
 * else, and a second shop listening for messages that are not theirs.
 */

describe("live chat stays inside one store", () => {
  let server;
  let url;
  let velor;
  let pizza;
  const clients = [];
  const envBackup = { ...process.env };

  beforeAll(async () => {
    Object.assign(process.env, STAFF_ENV);
    process.env.TENANCY_MODE = "strict";
    await connectTestDb();
    server = http.createServer();
    socketModule.initSocket(server);
    await new Promise((resolve) => server.listen(0, resolve));
    url = `http://127.0.0.1:${server.address().port}`;
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  beforeEach(async () => {
    invalidateTenantCache();
    velor = await createTenantWithStaff({ slug: "velor", email: "staff@velor.test" });
    pizza = await createTenantWithStaff({ slug: "pizzashop", email: "staff@pizza.test" });
  });

  afterEach(async () => {
    clients.splice(0).forEach((c) => c.close());
    process.env = { ...envBackup, ...STAFF_ENV, TENANCY_MODE: "strict" };
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

  const asVisitor = (slug, guestId = "guest-1") => open({ tenant: slug, guestId });
  const asStaff = (store) => open({ token: store.user.generateJwtAccessToken() });

  // Resolves with the first matching event, or null if none arrives in time.
  // A null result is what proves a message did *not* leak.
  // 2 s (was 700 ms): under coverage + 4 parallel workers a delivered message
  // could take longer than 700 ms and the test failed at random
  const nextEvent = (client, event, ms = 2000) =>
    new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), ms);
      client.once(event, (payload) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });

  const send = (client, payload) =>
    new Promise((resolve) => client.emit("chat:send", payload, resolve));

  describe("a visitor's message reaches their own shop", () => {
    it("delivers it to that store's staff", async () => {
      const staff = await asStaff(velor);
      const visitor = await asVisitor("velor");

      const incoming = nextEvent(staff, "chat:message");
      const ack = await send(visitor, { body: "Do you deliver to Dhanmondi?" });

      expect(ack).toMatchObject({ ok: true });
      await expect(incoming).resolves.toMatchObject({
        body: "Do you deliver to Dhanmondi?",
        senderType: "guest",
      });
    });

    it("stores the message against the right store", async () => {
      const visitor = await asVisitor("velor");
      await send(visitor, { body: "Hello" });

      const inVelor = await runForTenant(velor.tenant._id, () => ChatMessage.countDocuments({}));
      const inPizza = await runForTenant(pizza.tenant._id, () => ChatMessage.countDocuments({}));

      expect(inVelor).toBe(1);
      expect(inPizza).toBe(0);
    });
  });

  describe("it does not reach anybody else", () => {
    // The central guarantee of the whole feature
    it("never delivers to another store's staff", async () => {
      const velorStaff = await asStaff(velor);
      const pizzaStaff = await asStaff(pizza);
      const visitor = await asVisitor("velor");

      const velorHeard = nextEvent(velorStaff, "chat:message");
      const pizzaHeard = nextEvent(pizzaStaff, "chat:message");

      await send(visitor, { body: "Private question" });

      await expect(velorHeard).resolves.toMatchObject({ body: "Private question" });
      await expect(pizzaHeard).resolves.toBeNull();
    });

    /**
     * The payload is attacker-controlled. Naming another tenant in it must
     * change nothing: the store comes from the handshake, which was verified.
     */
    it("ignores a tenant id supplied in the message", async () => {
      const pizzaStaff = await asStaff(pizza);
      const visitor = await asVisitor("velor");

      const pizzaHeard = nextEvent(pizzaStaff, "chat:message");
      await send(visitor, { body: "Sneaky", tenantId: String(pizza.tenant._id), tenant: "pizzashop" });

      await expect(pizzaHeard).resolves.toBeNull();
      const inPizza = await runForTenant(pizza.tenant._id, () => ChatMessage.countDocuments({}));
      expect(inPizza).toBe(0);
    });

    // Otherwise a visitor could write messages that look like the shop talking
    it("records a visitor's message as from a guest, whatever they claim", async () => {
      const visitor = await asVisitor("velor");
      await send(visitor, { body: "I am staff", senderType: "staff" });

      const message = await runForTenant(velor.tenant._id, () => ChatMessage.findOne({}).lean());
      expect(message.senderType).toBe("guest");
    });
  });

  describe("staff replies", () => {
    it("goes back to the one visitor who asked", async () => {
      const staff = await asStaff(velor);
      const visitor = await asVisitor("velor", "guest-a");
      const otherVisitor = await asVisitor("velor", "guest-b");

      const ack = await send(visitor, { body: "Question" });
      const conversationId = ack.conversationId;

      const mine = nextEvent(visitor, "chat:message");
      const theirs = nextEvent(otherVisitor, "chat:message");

      await send(staff, { conversationId, body: "Yes, we do" });

      await expect(mine).resolves.toMatchObject({ body: "Yes, we do", senderType: "staff" });
      await expect(theirs).resolves.toBeNull();
    });

    // The id is from another store, so the scoped lookup finds nothing
    it("cannot reply into another store's conversation", async () => {
      const visitor = await asVisitor("velor");
      const ack = await send(visitor, { body: "Question" });

      const pizzaStaff = await asStaff(pizza);
      const reply = await send(pizzaStaff, { conversationId: ack.conversationId, body: "Intercepted" });

      expect(reply).toMatchObject({ ok: false });
      const messages = await runForTenant(velor.tenant._id, () => ChatMessage.countDocuments({}));
      expect(messages).toBe(1); // only the visitor's own
    });
  });

  describe("connections that should not open", () => {
    it("refuses a visitor naming a store that does not exist", async () => {
      await expect(asVisitor("no-such-store")).rejects.toThrow();
    });

    it("refuses a visitor on a suspended store", async () => {
      await require("../../src/models/platform/tenant.model").updateOne(
        { _id: velor.tenant._id },
        { $set: { status: "suspended" } },
      );
      invalidateTenantCache();

      await expect(asVisitor("velor")).rejects.toThrow();
    });
  });

  describe("conversation bookkeeping", () => {
    it("keeps one open conversation per visitor", async () => {
      const visitor = await asVisitor("velor", "guest-a");
      await send(visitor, { body: "First" });
      await send(visitor, { body: "Second" });

      const conversations = await runForTenant(velor.tenant._id, () => ChatConversation.countDocuments({}));
      expect(conversations).toBe(1);

      const conversation = await runForTenant(velor.tenant._id, () => ChatConversation.findOne({}).lean());
      expect(conversation.unreadForStaff).toBe(2);
      expect(conversation.lastMessagePreview).toBe("Second");
    });
  });
});
