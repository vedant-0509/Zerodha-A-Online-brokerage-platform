function errorHandler(error, req, res, next) {
    if (res.headersSent) {
        return next(error);
    }

    const status = Number(error && (error.statusCode || error.status));
    const requestId = req.requestId || res.getHeader("X-Request-Id") || null;

    if (error && error.type === "entity.too.large") {
        return res.status(413).json({
            success: false,
            error: {
                code: "PAYLOAD_TOO_LARGE",
                message: "Request payload is too large.",
            },
            requestId,
        });
    }

    if (error && error instanceof SyntaxError && "body" in error) {
        return res.status(400).json({
            success: false,
            error: {
                code: "INVALID_JSON",
                message: "Invalid JSON request body.",
            },
            requestId,
        });
    }

    if (error && error.code === "CORS_ORIGIN_NOT_ALLOWED") {
        return res.status(403).json({
            success: false,
            error: {
                code: "CORS_ORIGIN_NOT_ALLOWED",
                message: "Request origin is not allowed.",
            },
            requestId,
        });
    }

    if (error && (error.status === 429 || error.code === "ERR_ERL_RATELIMIT")) {
        const retryAfter = error.retryAfter;
        if (retryAfter) {
            res.setHeader("Retry-After", String(retryAfter));
        }
        return res.status(429).json({
            success: false,
            error: {
                code: "RATE_LIMITED",
                message: "Too many requests. Please try again later.",
            },
            requestId,
        });
    }

    const safeStatus = status >= 400 && status < 500 ? status : 500;
    const safeCode = safeStatus === 404 ? "ROUTE_NOT_FOUND" : "INTERNAL_ERROR";
    const safeMessage = safeStatus === 404
        ? "Route not found."
        : "Internal server error.";

    console.error("[API] Unhandled error", {
        requestId,
        method: req.method,
        path: req.originalUrl,
        error: error && error.stack ? error.stack : error,
    });

    return res.status(safeStatus).json({
        success: false,
        error: {
            code: error && error.code && safeStatus < 500
                ? String(error.code)
                : safeCode,
            message: safeMessage,
        },
        requestId,
    });
}

module.exports = errorHandler;