const { initSocket } = require("./socket/socket");
const express = require("express");
const { globalErrorHandeler } = require("./lib/GlobalErrorHandeler");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const cookieparser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const http = require("http");
const mongoose = require("mongoose");
const { corsOrigin } = require("./config/cors.config");
const { isDevelopment } = require("./config/nodeEnv");
const { cache: redis } = require("./config/redis.config");

const app = express();
const server = http.createServer(app);

// ====== Security Middlewares ======
app.set("trust proxy", 1);
app.set("etag", false);
app.use(helmet());
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
);

app.use(cookieparser());

// 4. Morgan -> Request logging
if (isDevelopment()) {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Health probe for Docker and the reverse proxy. Registered before the rate
// limiter so probes never use up the proxy IP's request budget.
// Redis counts as much as Mongo: without it the cache, BullMQ jobs and settings
// invalidation all stop.
const REDIS_PING_TIMEOUT_MS = 2000;

const redisUp = async () => {
  // A disconnected ioredis client queues commands instead of failing, so a
  // ping alone would hang until the probe times out
  if (redis.status !== "ready") return false;
  try {
    const reply = await Promise.race([
      redis.ping(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("timeout")),
          REDIS_PING_TIMEOUT_MS,
        ).unref(),
      ),
    ]);
    return reply === "PONG";
  } catch {
    return false;
  }
};

app.get("/healthz", async (req, res) => {
  const database = mongoose.connection.readyState === 1;
  const cacheUp = await redisUp();
  const ok = database && cacheUp;
  res.status(ok ? 200 : 503).json({
    status: ok ? "ok" : "degraded",
    database: database ? "up" : "down",
    redis: cacheUp ? "up" : "down",
  });
});

// 5. Rate Limiter -> Prevent brute-force / abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_MAX) || 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// routes
app.use(process.env.BASE_URL || "/api/v1", require("../src/routes/index"));

// initialize socket
const io = initSocket(server);

// global error handler
app.use(globalErrorHandeler);

// export both app & server for usage
module.exports = { server, io };
