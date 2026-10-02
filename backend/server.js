require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const { Server } = require("socket.io");
const { io: createClient } = require("socket.io-client");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const INTERNAL_HOST = process.env.INTERNAL_HOST || "127.0.0.1";

const routes = [
  { prefix: "/api/auth", target: Number(process.env.AUTH_PORT || 3010), strip: "/api/auth" },
  { prefix: "/api/holdings", target: Number(process.env.HOLDINGS_PORT || 3006), strip: "/api/holdings" },
  { prefix: "/api/watchlist", target: Number(process.env.WATCHLIST_PORT || 3008), strip: "/api/watchlist" },
  { prefix: "/api/orders", target: Number(process.env.ORDERS_PORT || 3007), strip: "/api/orders" },
  { prefix: "/api/stocks", target: Number(process.env.STOCKS_PORT || 3001), strip: "/api/stocks" },
  { prefix: "/api/detail-stock", target: Number(process.env.DETAIL_STOCK_PORT || 3021), strip: "" },
  { prefix: "/api/mutual-funds", target: Number(process.env.MF_PORT || 5000), strip: "" },
  { prefix: "/api/company-reviews", target: Number(process.env.AUTH_PORT || 3010), strip: "" },
];

const frontendOrigins = String(
  process.env.FRONTEND_ORIGINS || "http://localhost:3002"
).split(",").map((v) => v.trim()).filter(Boolean);

app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());
app.use(cors({
  origin(origin, callback) {
    if (!origin || frontendOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("CORS origin not allowed"));
  },
  credentials: true,
}));

app.get("/health", (req, res) => {
  res.json({ success: true, service: "central-api", status: "ok", time: new Date().toISOString() });
});

app.get("/ready", (req, res) => {
  res.json({ success: true, service: "central-api", status: "ready" });
});

function matchingRoute(pathname) {
  return routes.find((route) => pathname === route.prefix || pathname.startsWith(`${route.prefix}/`));
}

function rewritePath(originalUrl, route) {
  if (!route.strip) return originalUrl;
  const rewritten = originalUrl.slice(route.strip.length) || "/";
  return rewritten.startsWith("/") ? rewritten : `/${rewritten}`;
}

function proxyRequest(req, res, route) {
  const targetPath = rewritePath(req.url, route);
  const headers = { ...req.headers, host: `${INTERNAL_HOST}:${route.target}` };
  delete headers["content-length"];

  const proxyReq = http.request({
    hostname: INTERNAL_HOST,
    port: route.target,
    method: req.method,
    path: targetPath,
    headers,
  }, (proxyRes) => {
    res.statusCode = proxyRes.statusCode || 502;
    for (const [key, value] of Object.entries(proxyRes.headers)) {
      if (value !== undefined) res.setHeader(key, value);
    }
    proxyRes.pipe(res);
  });

  proxyReq.setTimeout(30000, () => {
    proxyReq.destroy(new Error("Internal service timeout"));
  });

  proxyReq.on("error", (error) => {
    if (res.headersSent) return res.destroy(error);
    res.status(502).json({ success: false, message: "Backend service unavailable" });
  });

  req.pipe(proxyReq);
}

app.use((req, res, next) => {
  if (req.path === "/health" || req.path === "/ready") return next();
  const route = matchingRoute(req.path);
  if (!route) {
    return res.status(404).json({ success: false, message: "Route not found" });
  }
  return proxyRequest(req, res, route);
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: frontendOrigins, credentials: true },
  transports: ["websocket", "polling"],
});

function bridgeIndexSocket(client) {
  const upstream = createClient(`http://${INTERNAL_HOST}:${Number(process.env.INDEX_MARKET_PORT || 3020)}`, {
    transports: ["websocket", "polling"],
    reconnection: true,
  });

  upstream.on("market_snapshot", (payload) => client.emit("market_snapshot", payload));
  upstream.on("market_update", (payload) => client.emit("market_update", payload));
  client.on("get_snapshot", () => upstream.emit("get_snapshot"));
  client.on("disconnect", () => upstream.close());
}

function bridgeDetailSocket(client) {
  const upstream = createClient(`http://${INTERNAL_HOST}:${Number(process.env.DETAIL_STOCK_PORT || 3021)}`, {
    transports: ["websocket", "polling"],
    reconnection: true,
  });

  for (const event of ["detailStock:snapshot", "detailStock:tick", "detailStock:market-status"]) {
    upstream.on(event, (payload) => client.emit(event, payload));
  }

  client.on("detailStock:subscribe", (payload, ack) => {
    upstream.emit("detailStock:subscribe", payload, (response) => {
      if (typeof ack === "function") ack(response);
    });
  });

  client.on("detailStock:unsubscribe", (payload, ack) => {
    upstream.emit("detailStock:unsubscribe", payload, (response) => {
      if (typeof ack === "function") ack(response);
    });
  });

  client.on("disconnect", () => upstream.close());
}

io.on("connection", (client) => {
  bridgeIndexSocket(client);
  bridgeDetailSocket(client);
});

server.listen(PORT, () => {
  console.log(`Central API running on http://localhost:${PORT}`);
  console.log("Public API: /api/*");
  console.log("Public WebSockets: /socket.io");
});

function shutdown(signal) {
  console.log(`Central API received ${signal}; shutting down...`);
  io.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

module.exports = { app, server, io };
