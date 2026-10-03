const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");

process.env.JWT_SECRET = process.env.JWT_SECRET || "phase6-unit-test-secret";
process.env.FRONTEND_ORIGINS = process.env.FRONTEND_ORIGINS || "http://localhost:5173";

const backendRoot = path.join(__dirname, "..");

function mockResponse() {
    const headers = new Map();
    return {
        statusCode: 200,
        body: null,
        setHeader(name, value) {
            headers.set(String(name).toLowerCase(), value);
        },
        getHeader(name) {
            return headers.get(String(name).toLowerCase());
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        },
        headers,
    };
}

function runMiddleware(middleware, req, res) {
    return new Promise((resolve, reject) => {
        try {
            middleware(req, res, (error) => {
                if (error) reject(error);
                else resolve();
            });
        } catch (error) {
            reject(error);
        }
    });
}

test("requestContext creates and returns a valid UUID request id", async () => {
    const requestContext = require("../middleware/requestContext");
    const req = { get: () => "" };
    const res = mockResponse();
    await runMiddleware(requestContext, req, res);
    assert.match(req.requestId, /^[0-9a-f-]{36}$/i);
    assert.equal(res.getHeader("x-request-id"), req.requestId);
});

test("requestContext preserves a valid incoming request id", async () => {
    const requestContext = require("../middleware/requestContext");
    const id = "11111111-1111-4111-8111-111111111111";
    const req = { get: (name) => name === "X-Request-Id" ? id : "" };
    const res = mockResponse();
    await runMiddleware(requestContext, req, res);
    assert.equal(req.requestId, id);
    assert.equal(res.getHeader("x-request-id"), id);
});

test("invalid incoming request ids are replaced", async () => {
    const requestContext = require("../middleware/requestContext");
    const req = { get: () => "not-a-request-id" };
    const res = mockResponse();
    await runMiddleware(requestContext, req, res);
    assert.notEqual(req.requestId, "not-a-request-id");
    assert.match(req.requestId, /^[0-9a-f-]{36}$/i);
});

test("request body validation rejects unknown fields", async () => {
    const { validateBodyObject } = require("../middleware/validateRequest");
    const middleware = validateBodyObject({
        allowEmpty: false,
        allowedFields: ["instrumentKey"],
        requiredFields: ["instrumentKey"],
    });
    const req = { body: { instrumentKey: "ABC", userId: "attacker" }, requestId: "req-1" };
    const res = mockResponse();
    let called = false;
    await middleware(req, res, () => { called = true; });
    assert.equal(called, false);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
});

test("request body validation accepts the intended order shape", async () => {
    const { validateBodyObject } = require("../middleware/validateRequest");
    const middleware = validateBodyObject({
        allowEmpty: false,
        allowedFields: ["instrumentKey", "transactionType", "quantity", "orderType", "product"],
        requiredFields: ["instrumentKey", "transactionType", "quantity", "orderType", "product"],
        fieldRules: { quantity: { type: "number" } },
    });
    const req = {
        body: {
            instrumentKey: "NSE_EQ|TEST",
            transactionType: "BUY",
            quantity: 1,
            orderType: "MARKET",
            product: "CNC",
        },
        requestId: "req-2",
    };
    const res = mockResponse();
    let called = false;
    await middleware(req, res, () => { called = true; });
    assert.equal(called, true);
    assert.equal(res.body, null);
});

test("error handler never exposes internal error messages", () => {
    const errorHandler = require("../middleware/errorHandler");
    const req = { requestId: "req-3", method: "GET", originalUrl: "/secret" };
    const res = mockResponse();
    errorHandler(new Error("SQL password=super-secret"), req, res, () => {});
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error.message, "Internal server error.");
    assert.equal(JSON.stringify(res.body).includes("super-secret"), false);
    assert.equal(res.body.requestId, "req-3");
});

test("error handler returns safe invalid JSON and CORS errors", () => {
    const errorHandler = require("../middleware/errorHandler");

    const jsonReq = { requestId: "req-json", method: "POST", originalUrl: "/api/test" };
    const jsonRes = mockResponse();
    const syntaxError = new SyntaxError("Unexpected token secret");
    syntaxError.body = true;
    errorHandler(syntaxError, jsonReq, jsonRes, () => {});
    assert.equal(jsonRes.statusCode, 400);
    assert.equal(jsonRes.body.error.code, "INVALID_JSON");
    assert.equal(JSON.stringify(jsonRes.body).includes("secret"), false);

    const corsReq = { requestId: "req-cors", method: "GET", originalUrl: "/health" };
    const corsRes = mockResponse();
    const corsError = new Error("CORS origin not allowed");
    corsError.code = "CORS_ORIGIN_NOT_ALLOWED";
    errorHandler(corsError, corsReq, corsRes, () => {});
    assert.equal(corsRes.statusCode, 403);
    assert.equal(corsRes.body.error.code, "CORS_ORIGIN_NOT_ALLOWED");
});

test("strict CORS only allows configured frontend origins", () => {
    const createCorsOptions = require("../middleware/corsOptions");
    const options = createCorsOptions({ origins: ["http://localhost:5173"] });

    options.origin("http://localhost:5173", (error) => assert.equal(error, null));

    let rejected = false;
    options.origin("http://evil.example", (error) => {
        rejected = Boolean(error);
        assert.equal(error.code, "CORS_ORIGIN_NOT_ALLOWED");
    });
    assert.equal(rejected, true);
});

test("active backend services contain Phase 6 security middleware", () => {
    const files = [
        "server.js",
        "signup/app.js",
        "watchlist/app.js",
        "holding/app.js",
        "orders/app.js",
        "mutualfunds/server.js",
        "stocks/server.js",
        "detailStock/server.js",
        "indexMarket/server.js",
    ];

    for (const relative of files) {
        const source = fs.readFileSync(path.join(backendRoot, relative), "utf8");
        assert.match(source, /requestContext/);
        assert.match(source, /helmet/);
        assert.match(source, /cors/);
    }

    assert.match(fs.readFileSync(path.join(backendRoot, "server.js"), "utf8"), /app\.use\("\/api", apiLimiter\)/);
    assert.match(fs.readFileSync(path.join(backendRoot, "server.js"), "utf8"), /app\.use\(errorHandler\)/);
    assert.match(fs.readFileSync(path.join(backendRoot, "detailStock/server.js"), "utf8"), /validateBodyObject/);
    assert.match(fs.readFileSync(path.join(backendRoot, "mutualfunds/mutualFundRoutes.js"), "utf8"), /validateBodyObject/);
});

test("central API runtime security checks", async (t) => {
    const port = 39000 + Math.floor(Math.random() * 500);
    const child = spawn(process.execPath, [path.join(backendRoot, "server.js")], {
        cwd: backendRoot,
        env: {
            ...process.env,
            PORT: String(port),
            JWT_SECRET: "phase6-test-secret",
            FRONTEND_ORIGINS: "http://localhost:5173",
            API_RATE_LIMIT: "2",
            API_RATE_LIMIT_WINDOW_MS: "60000",
        },
        stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });

    t.after(() => child.kill("SIGTERM"));

    let started = false;
    for (let i = 0; i < 40; i += 1) {
        try {
            const response = await fetch(`http://127.0.0.1:${port}/health`);
            if (response.status === 200) {
                started = true;
                break;
            }
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    assert.equal(started, true, `central API did not start. Output: ${output}`);

    const health = await fetch(`http://127.0.0.1:${port}/health`, {
        headers: { Origin: "http://localhost:5173" },
    });
    assert.equal(health.status, 200);
    assert.ok(health.headers.get("x-request-id"));
    assert.equal(health.headers.get("x-content-type-options"), "nosniff");

    const corsRejected = await fetch(`http://127.0.0.1:${port}/health`, {
        headers: { Origin: "http://evil.example" },
    });
    assert.equal(corsRejected.status, 403);
    const corsBody = await corsRejected.json();
    assert.equal(corsBody.error.code, "CORS_ORIGIN_NOT_ALLOWED");
    assert.ok(corsBody.requestId);

    const first = await fetch(`http://127.0.0.1:${port}/api/not-found`);
    assert.equal(first.status, 404);
    const firstBody = await first.json();
    assert.equal(firstBody.error.code, "ROUTE_NOT_FOUND");
    assert.ok(firstBody.requestId);

    const second = await fetch(`http://127.0.0.1:${port}/api/not-found`);
    assert.equal(second.status, 404);
    await second.json();

    const limited = await fetch(`http://127.0.0.1:${port}/api/not-found`);
    assert.equal(limited.status, 429);
    const limitedBody = await limited.json();
    assert.equal(limitedBody.error.code, "RATE_LIMITED");
    assert.ok(limitedBody.requestId);
});