function normalizeOrigin(origin) {
    return String(origin || "")
        .trim()
        .replace(/\/+$/, "");
}

function defaultOrigins() {
    return String(
        process.env.FRONTEND_ORIGINS ||
            "http://localhost:3002,http://localhost:3000,http://localhost:3001,http://localhost:5173"
    )
        .split(",")
        .map(normalizeOrigin)
        .filter(Boolean);
}

function createCorsOptions({ credentials = false, origins = defaultOrigins() } = {}) {
    return {
        origin(origin, callback) {
            if (!origin) {
                return callback(null, true);
            }

            const normalized = normalizeOrigin(origin);

            if (Array.isArray(origins) && origins.map(normalizeOrigin).includes(normalized)) {
                return callback(null, true);
            }

            const error = new Error("CORS origin not allowed");
            error.statusCode = 403;
            error.code = "CORS_ORIGIN_NOT_ALLOWED";
            return callback(error);
        },
        credentials,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "Idempotency-Key",
            "X-Request-Id",
        ],
        exposedHeaders: ["X-Request-Id", "Retry-After"],
        optionsSuccessStatus: 204,
    };
}

module.exports = createCorsOptions;