const jwt = require("jsonwebtoken");
const env = require("../config/env");

const JWT_ISSUER = "zerodha-auth";
const JWT_AUDIENCE = "zerodha-web";
const ALLOWED_ROLES = ["USER", "ADMIN"];

function normalizeRole(role) {
    const normalized = String(role || "USER")
        .trim()
        .toUpperCase();

    if (!ALLOWED_ROLES.includes(normalized)) {
        throw new Error("Invalid user role");
    }

    return normalized;
}

function signAccessToken({ userId, role = "USER" }) {
    if (!userId) {
        throw new Error("userId is required to create JWT");
    }

    const normalizedRole = normalizeRole(role);

    return jwt.sign(
        {
            userId: String(userId),
            role: normalizedRole,
        },
        env.jwtSecret,
        {
            expiresIn: env.jwtExpiresIn,
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
            algorithm: "HS256",
        }
    );
}

function verifyAccessToken(token) {
    return jwt.verify(token, env.jwtSecret, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        algorithms: ["HS256"],
    });
}

function extractBearerToken(authorizationHeader) {
    if (typeof authorizationHeader !== "string") {
        return null;
    }

    const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);

    if (!match) {
        return null;
    }

    const token = match[1].trim();

    return token || null;
}

module.exports = {
    JWT_ISSUER,
    JWT_AUDIENCE,
    ALLOWED_ROLES,
    normalizeRole,
    signAccessToken,
    verifyAccessToken,
    extractBearerToken,
};