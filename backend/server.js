require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

const env = require("./config/env");
const requestContext = require("./middleware/requestContext");
const createCorsOptions = require("./middleware/corsOptions");
const errorHandler = require("./middleware/errorHandler");
const { Server } = require("socket.io");
const { io: createClient } = require("socket.io-client");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const INTERNAL_HOST = process.env.INTERNAL_HOST || "127.0.0.1";

const routes = [
  {
    prefix: "/api/auth",
    target: Number(process.env.AUTH_PORT || 3010),
    strip: "/api/auth",
    rootPath: "/",
  },
  {
    prefix: "/api/holdings",
    target: Number(process.env.HOLDINGS_PORT || 3006),
    strip: "/api/holdings",
    rootPath: "/holdings",
  },
  {
    prefix: "/api/watchlist",
    target: Number(process.env.WATCHLIST_PORT || 3008),
    strip: "/api/watchlist",
    rootPath: "/watchlist",
  },
  {
    prefix: "/api/orders",
    target: Number(process.env.ORDERS_PORT || 3007),
    strip: "/api/orders",
    rootPath: "/orders",
  },
  {
    prefix: "/api/stocks",
    target: Number(process.env.STOCKS_PORT || 3001),
    strip: "/api/stocks",
    rootPath: "/",
  },
  {
    prefix: "/api/detail-stock",
    target: Number(process.env.DETAIL_STOCK_PORT || 3021),
    strip: "",
    rootPath: "/",
  },
  {
    prefix: "/api/mutual-funds",
    target: Number(process.env.MF_PORT || 5000),
    strip: "",
    rootPath: "/",
  },
];

const frontendOrigins = env.frontendOrigins;

app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);

app.use(compression());

app.use(requestContext);
app.use(cors(createCorsOptions({ credentials: true })));

const apiLimiter = rateLimit({
  windowMs: env.apiRateLimits.windowMs,
  limit: env.apiRateLimits.limit,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: (req) => req.path === "/health" || req.path === "/ready",
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please try again later.",
      },
      requestId: req.requestId,
    });
  },
});

app.use("/api", apiLimiter);

app.get("/health", (req, res) => {
  res.json({
    success: true,
    service: "central-api",
    status: "ok",
    time: new Date().toISOString(),
  });
});

app.get("/ready", (req, res) => {
  res.json({
    success: true,
    service: "central-api",
    status: "ready",
  });
});

function matchingRoute(pathname) {
  return routes.find(
    (route) =>
      pathname === route.prefix || pathname.startsWith(`${route.prefix}/`),
  );
}

function rewritePath(originalUrl, route) {
  const queryIndex = originalUrl.indexOf("?");

  const pathname =
    queryIndex >= 0 ? originalUrl.slice(0, queryIndex) : originalUrl;

  const query = queryIndex >= 0 ? originalUrl.slice(queryIndex) : "";

  if (route.prefix === "/api/orders") {
    if (pathname === "/api/orders") {
      return `/orders${query}`;
    }

    if (pathname === "/api/orders/orders") {
      return `/orders${query}`;
    }

    if (pathname === "/api/orders/counts") {
      return `/orders/counts${query}`;
    }

    if (pathname.startsWith("/api/orders/order/")) {
      const orderId = pathname.slice("/api/orders/order/".length);

      return `/order/${orderId}${query}`;
    }

    if (pathname.startsWith("/api/orders/orders/")) {
      const orderId = pathname.slice("/api/orders/orders/".length);

      return `/order/${orderId}${query}`;
    }
  }

  if (route.prefix === "/api/holdings") {
    if (pathname === "/api/holdings") {
      return `/holdings${query}`;
    }

    if (pathname === "/api/holdings/holdings") {
      return `/holdings${query}`;
    }
  }

  if (route.prefix === "/api/watchlist") {
    if (pathname === "/api/watchlist") {
      return `/watchlist${query}`;
    }

    if (pathname === "/api/watchlist/watchlist") {
      return `/watchlist${query}`;
    }

    // Search
    if (pathname.startsWith("/api/watchlist/search")) {
      const remainder = pathname.slice("/api/watchlist/search".length);

      return `/search${remainder}${query}`;
    }

    // Watchlist item
    // /api/watchlist/:instrumentKey
    // ->
    // /watchlist/:instrumentKey
    const remainder = pathname.slice("/api/watchlist".length);

    return `/watchlist${remainder}${query}`;
  }

  if (route.prefix === "/api/detail-stock") {
    const profilePrefix = "/api/detail-stock/profile/";

    if (pathname.startsWith(profilePrefix)) {
      const isin = pathname.slice(profilePrefix.length);

      return `/api/detail-stock/about/${isin}${query}`;
    }

    const mutualFundsPrefix = "/api/detail-stock/mutual-funds/";

    if (pathname.startsWith(mutualFundsPrefix)) {
      const isin = pathname.slice(mutualFundsPrefix.length);

      return `/api/detail-stock/fundamentals/${isin}${query}`;
    }

    const financialsPrefix = "/api/detail-stock/financials/";

    if (pathname.startsWith(financialsPrefix)) {
      const identifier = pathname.slice(financialsPrefix.length);

      return `/api/detail-stock/financial-performance/${identifier}${query}`;
    }

    return originalUrl;
  }

  if (route.prefix === "/api/mutual-funds") {
    return originalUrl;
  }

  if (pathname === route.prefix) {
    return `${route.rootPath}${query}`;
  }

  const remainder = pathname.slice(route.strip.length) || "";

  const normalizedRemainder = remainder.startsWith("/")
    ? remainder
    : `/${remainder}`;

  const root = route.rootPath === "/" ? "" : route.rootPath.replace(/\/$/, "");

  return `${root}${normalizedRemainder}${query}`;
}

function proxyRequest(req, res, route) {
  const targetPath = rewritePath(req.url, route);

  console.log(
    `[Central API] ${req.method} ${req.url} -> ` +
    `${INTERNAL_HOST}:${route.target}${targetPath}`,
  );

  const headers = {
    ...req.headers,
    "x-request-id": req.requestId,
    host: `${INTERNAL_HOST}:${route.target}`,
  };

  delete headers["x-forwarded-for"];
  delete headers["x-forwarded-host"];
  delete headers["x-forwarded-proto"];
  delete headers["x-forwarded-port"];
  delete headers["content-length"];

  const proxyReq = http.request(
    {
      hostname: INTERNAL_HOST,
      port: route.target,
      method: req.method,
      path: targetPath,
      headers,
    },
    (proxyRes) => {
      const statusCode = proxyRes.statusCode || 502;

      if (statusCode >= 500) {
        const chunks = [];

        proxyRes.on("data", (chunk) => chunks.push(chunk));
        proxyRes.on("end", () => {
          res.statusCode = statusCode;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("X-Request-Id", req.requestId);
          res.end(
            JSON.stringify({
              success: false,
              error: {
                code: "UPSTREAM_ERROR",
                message: "Backend service temporarily unavailable.",
              },
              requestId: req.requestId,
            }),
          );
        });
        return;
      }

      res.statusCode = statusCode;

      for (const [key, value] of Object.entries(proxyRes.headers)) {
        if (value !== undefined && key.toLowerCase() !== "content-length") {
          res.setHeader(key, value);
        }
      }

      res.setHeader("X-Request-Id", req.requestId);
      proxyRes.pipe(res);
    },
  );

  proxyReq.setTimeout(30000, () => {
    proxyReq.destroy(new Error("Internal service timeout"));
  });

  proxyReq.on("error", (error) => {
    console.error("[Central API] Proxy error:", error.message);

    if (res.headersSent) {
      return res.destroy(error);
    }

    return res.status(502).json({
      success: false,
      error: {
        code: "UPSTREAM_UNAVAILABLE",
        message: "Backend service unavailable.",
      },
      requestId: req.requestId,
    });
  });

  req.pipe(proxyReq);
}

app.use((req, res, next) => {
  if (req.path === "/health" || req.path === "/ready") {
    return next();
  }

  const route = matchingRoute(req.path);

  if (!route) {
    return res.status(404).json({
      success: false,
      error: {
        code: "ROUTE_NOT_FOUND",
        message: "Route not found.",
      },
      requestId: req.requestId,
    });
  }

  return proxyRequest(req, res, route);
});

app.use(errorHandler);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: frontendOrigins,
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

function bridgeIndexSocket(client) {
  const port = Number(process.env.INDEX_MARKET_PORT || 3020);
  const upstream = createClient(`http://${INTERNAL_HOST}:${port}`, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  let lastConnectionState = "disconnected";
  let closingForFrontendDisconnect = false;

  upstream.on("connect", () => {
    lastConnectionState = "connected";
    console.log(
      `[Central API] Index Market bridge connected (${client.id} -> ${upstream.id})`,
    );
    upstream.emit("get_snapshot");
  });

  upstream.on("disconnect", (reason) => {
    lastConnectionState = "disconnected";

    if (closingForFrontendDisconnect && reason === "io client disconnect") {
      console.log(
        "[Central API] Index Market bridge closed because its frontend client disconnected.",
      );
      return;
    }

    console.warn(
      `[Central API] Index Market bridge disconnected (${reason}). Socket.IO will retry if this was unexpected.`,
    );
  });

  upstream.on("connect_error", (error) => {
    // During a clean startup the internal service can take a few seconds to bind.
    // Socket.IO will keep retrying, so avoid flooding the console with stack traces.
    if (lastConnectionState !== "connecting") {
      console.warn(
        `[Central API] Index Market bridge waiting for service: ${error.message}`,
      );
    }
    lastConnectionState = "connecting";
  });

  upstream.on("market_snapshot", (payload) => {
    client.emit("market_snapshot", payload);
  });

  upstream.on("market_update", (payload) => {
    client.emit("market_update", payload);
  });

  client.on("get_snapshot", () => {
    if (upstream.connected) {
      upstream.emit("get_snapshot");
    }
  });

  client.on("disconnect", () => {
    closingForFrontendDisconnect = true;
    upstream.close();
  });
}

function bridgeDetailSocket(client) {
  const port = Number(process.env.DETAIL_STOCK_PORT || 3021);
  const upstream = createClient(`http://${INTERNAL_HOST}:${port}`, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  let lastConnectionState = "disconnected";
  let closingForFrontendDisconnect = false;

  upstream.on("connect", () => {
    lastConnectionState = "connected";
    console.log(
      `[Central API] Detail Stock bridge connected (${client.id} -> ${upstream.id})`,
    );
  });

  upstream.on("disconnect", (reason) => {
    lastConnectionState = "disconnected";

    if (closingForFrontendDisconnect && reason === "io client disconnect") {
      console.log(
        "[Central API] Detail Stock bridge closed because its frontend client disconnected.",
      );
      return;
    }

    console.warn(
      `[Central API] Detail Stock bridge disconnected (${reason}). Socket.IO will retry if this was unexpected.`,
    );
  });

  upstream.on("connect_error", (error) => {
    if (lastConnectionState !== "connecting") {
      console.warn(
        `[Central API] Detail Stock bridge waiting for service: ${error.message}`,
      );
    }
    lastConnectionState = "connecting";
  });

  for (const event of [
    "detailStock:snapshot",
    "detailStock:tick",
    "detailStock:market-status",
  ]) {
    upstream.on(event, (payload) => client.emit(event, payload));
  }

  client.on("detailStock:subscribe", (payload, ack) => {
    const send = () => {
      upstream.emit("detailStock:subscribe", payload, (response) => {
        if (typeof ack === "function") ack(response);
      });
    };

    if (upstream.connected) {
      send();
    } else if (typeof ack === "function") {
      ack({
        success: false,
        message: "Detail Stock service is starting. Please retry.",
      });
    }
  });

  client.on("detailStock:unsubscribe", (payload, ack) => {
    if (upstream.connected) {
      upstream.emit("detailStock:unsubscribe", payload, (response) => {
        if (typeof ack === "function") ack(response);
      });
    } else if (typeof ack === "function") {
      ack({ success: false, message: "Detail Stock service is unavailable." });
    }
  });

  client.on("disconnect", () => {
    closingForFrontendDisconnect = true;
    upstream.close();
  });
}

io.on("connection", (client) => {
  console.log(`[Central API] WebSocket client connected: ${client.id}`);

  bridgeIndexSocket(client);
  bridgeDetailSocket(client);
});

server.listen(PORT, () => {
  console.log(`Central API running on http://localhost:${PORT}`);
  console.log("Public API: /api/*");
  console.log("Public WebSockets: /socket.io");

  console.log(`Allowed frontend origins: ${frontendOrigins.join(", ")}`);

  routes.forEach((route) => {
    console.log(`${route.prefix} -> ` + `${INTERNAL_HOST}:${route.target}`);
  });
});

function shutdown(signal) {
  console.log(`Central API received ${signal}; shutting down...`);

  io.close();

  server.close(() => {
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 5000).unref();
}

process.once("SIGINT", () => shutdown("SIGINT"));

process.once("SIGTERM", () => shutdown("SIGTERM"));

module.exports = {
  app,
  server,
  io,
};
