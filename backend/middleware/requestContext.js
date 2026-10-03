const crypto = require("crypto");

const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requestContext(req, res, next) {
    const incoming = String(req.get("X-Request-Id") || "").trim();
    const requestId = REQUEST_ID_PATTERN.test(incoming)
        ? incoming
        : crypto.randomUUID();

    req.requestId = requestId;
    res.setHeader("X-Request-Id", requestId);

    return next();
}

module.exports = requestContext;