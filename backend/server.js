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
const INTERNAL_HOST =
    process.env.INTERNAL_HOST || "127.0.0.1";

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

const frontendOrigins = String(
    process.env.FRONTEND_ORIGINS ||
        "http://localhost:3002,http://localhost:3000,http://localhost:3001,http://localhost:5173"
)
    .split(",")
    .map((value) =>
        value.trim().replace(/\/+$/, "")
    )
    .filter(Boolean);

app.set("trust proxy", 1);

app.use(
    helmet({
        crossOriginResourcePolicy: false,
    })
);

app.use(compression());

app.use(
    cors({
        origin(origin, callback) {
            if (!origin) {
                return callback(null, true);
            }

            const normalizedOrigin = String(origin)
                .trim()
                .replace(/\/+$/, "");

            if (
                frontendOrigins.includes(
                    normalizedOrigin
                )
            ) {
                return callback(null, true);
            }

            console.error(
                `[Central API] CORS rejected origin: ${origin}`
            );

            return callback(
                new Error("CORS origin not allowed")
            );
        },
        credentials: true,
    })
);

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
            pathname === route.prefix ||
            pathname.startsWith(
                `${route.prefix}/`
            )
    );
}

function rewritePath(originalUrl, route) {
    const queryIndex =
        originalUrl.indexOf("?");

    const pathname =
        queryIndex >= 0
            ? originalUrl.slice(0, queryIndex)
            : originalUrl;

    const query =
        queryIndex >= 0
            ? originalUrl.slice(queryIndex)
            : "";

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

        if (
            pathname.startsWith(
                "/api/orders/order/"
            )
        ) {
            const orderId = pathname.slice(
                "/api/orders/order/".length
            );

            return `/order/${orderId}${query}`;
        }

        if (
            pathname.startsWith(
                "/api/orders/orders/"
            )
        ) {
            const orderId = pathname.slice(
                "/api/orders/orders/".length
            );

            return `/order/${orderId}${query}`;
        }
    }

    if (route.prefix === "/api/holdings") {
        if (pathname === "/api/holdings") {
            return `/holdings${query}`;
        }

        if (
            pathname ===
            "/api/holdings/holdings"
        ) {
            return `/holdings${query}`;
        }
    }

    if (route.prefix === "/api/watchlist") {
        if (pathname === "/api/watchlist") {
            return `/watchlist${query}`;
        }

        if (
            pathname ===
            "/api/watchlist/watchlist"
        ) {
            return `/watchlist${query}`;
        }

        const remainder = pathname.slice(
            "/api/watchlist".length
        );

        return `${
            remainder || "/watchlist"
        }${query}`;
    }

    if (route.prefix === "/api/detail-stock") {
        const profilePrefix =
            "/api/detail-stock/profile/";

        if (pathname.startsWith(profilePrefix)) {
            const isin = pathname.slice(
                profilePrefix.length
            );

            return `/api/detail-stock/about/${isin}${query}`;
        }

        const mutualFundsPrefix =
            "/api/detail-stock/mutual-funds/";

        if (
            pathname.startsWith(
                mutualFundsPrefix
            )
        ) {
            const isin = pathname.slice(
                mutualFundsPrefix.length
            );

            return `/api/detail-stock/fundamentals/${isin}${query}`;
        }

        const financialsPrefix =
            "/api/detail-stock/financials/";

        if (
            pathname.startsWith(
                financialsPrefix
            )
        ) {
            const identifier = pathname.slice(
                financialsPrefix.length
            );

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

    const remainder =
        pathname.slice(route.strip.length) ||
        "";

    const normalizedRemainder =
        remainder.startsWith("/")
            ? remainder
            : `/${remainder}`;

    const root =
        route.rootPath === "/"
            ? ""
            : route.rootPath.replace(/\/$/, "");

    return (
        `${root}${normalizedRemainder}${query}`
    );
}

function proxyRequest(req, res, route) {
    const targetPath = rewritePath(
        req.url,
        route
    );

    console.log(
        `[Central API] ${req.method} ${req.url} -> ` +
            `${INTERNAL_HOST}:${route.target}${targetPath}`
    );

    const headers = {
        ...req.headers,
        host:
            `${INTERNAL_HOST}:${route.target}`,
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
            res.statusCode =
                proxyRes.statusCode || 502;

            for (
                const [key, value] of Object.entries(
                    proxyRes.headers
                )
            ) {
                if (value !== undefined) {
                    res.setHeader(key, value);
                }
            }

            proxyRes.pipe(res);
        }
    );

    proxyReq.setTimeout(30000, () => {
        proxyReq.destroy(
            new Error(
                "Internal service timeout"
            )
        );
    });

    proxyReq.on("error", (error) => {
        console.error(
            "[Central API] Proxy error:",
            error.message
        );

        if (res.headersSent) {
            return res.destroy(error);
        }

        return res.status(502).json({
            success: false,
            message:
                "Backend service unavailable",
        });
    });

    req.pipe(proxyReq);
}

app.use((req, res, next) => {
    if (
        req.path === "/health" ||
        req.path === "/ready"
    ) {
        return next();
    }

    const route = matchingRoute(req.path);

    if (!route) {
        return res.status(404).json({
            success: false,
            message: "Route not found",
            path: req.path,
        });
    }

    return proxyRequest(
        req,
        res,
        route
    );
});

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: frontendOrigins,
        credentials: true,
    },
    transports: [
        "websocket",
        "polling",
    ],
});

function bridgeIndexSocket(client) {
    const port = Number(
        process.env.INDEX_MARKET_PORT || 3020
    );

    const upstream = createClient(
        `http://${INTERNAL_HOST}:${port}`,
        {
            transports: [
                "websocket",
                "polling",
            ],
            reconnection: true,
        }
    );

    upstream.on(
        "connect_error",
        (error) => {
            console.error(
                "[Central API] Index Market socket error:",
                error.message
            );
        }
    );

    upstream.on(
        "market_snapshot",
        (payload) =>
            client.emit(
                "market_snapshot",
                payload
            )
    );

    upstream.on(
        "market_update",
        (payload) =>
            client.emit(
                "market_update",
                payload
            )
    );

    client.on(
        "get_snapshot",
        () =>
            upstream.emit(
                "get_snapshot"
            )
    );

    client.on(
        "disconnect",
        () => upstream.close()
    );
}

function bridgeDetailSocket(client) {
    const port = Number(
        process.env.DETAIL_STOCK_PORT || 3021
    );

    const upstream = createClient(
        `http://${INTERNAL_HOST}:${port}`,
        {
            transports: [
                "websocket",
                "polling",
            ],
            reconnection: true,
        }
    );

    upstream.on(
        "connect_error",
        (error) => {
            console.error(
                "[Central API] Detail Stock socket error:",
                error.message
            );
        }
    );

    for (
        const event of [
            "detailStock:snapshot",
            "detailStock:tick",
            "detailStock:market-status",
        ]
    ) {
        upstream.on(
            event,
            (payload) =>
                client.emit(
                    event,
                    payload
                )
        );
    }

    client.on(
        "detailStock:subscribe",
        (payload, ack) => {
            upstream.emit(
                "detailStock:subscribe",
                payload,
                (response) => {
                    if (
                        typeof ack ===
                        "function"
                    ) {
                        ack(response);
                    }
                }
            );
        }
    );

    client.on(
        "detailStock:unsubscribe",
        (payload, ack) => {
            upstream.emit(
                "detailStock:unsubscribe",
                payload,
                (response) => {
                    if (
                        typeof ack ===
                        "function"
                    ) {
                        ack(response);
                    }
                }
            );
        }
    );

    client.on(
        "disconnect",
        () => upstream.close()
    );
}

io.on("connection", (client) => {
    console.log(
        `[Central API] WebSocket client connected: ${client.id}`
    );

    bridgeIndexSocket(client);
    bridgeDetailSocket(client);
});

server.listen(PORT, () => {
    console.log(
        `Central API running on http://localhost:${PORT}`
    );
    console.log("Public API: /api/*");
    console.log(
        "Public WebSockets: /socket.io"
    );

    console.log(
        `Allowed frontend origins: ${frontendOrigins.join(
            ", "
        )}`
    );

    routes.forEach((route) => {
        console.log(
            `${route.prefix} -> ` +
                `${INTERNAL_HOST}:${route.target}`
        );
    });
});

function shutdown(signal) {
    console.log(
        `Central API received ${signal}; shutting down...`
    );

    io.close();

    server.close(() => {
        process.exit(0);
    });

    setTimeout(
        () => process.exit(1),
        5000
    ).unref();
}

process.once("SIGINT", () =>
    shutdown("SIGINT")
);

process.once("SIGTERM", () =>
    shutdown("SIGTERM")
);

module.exports = {
    app,
    server,
    io,
};