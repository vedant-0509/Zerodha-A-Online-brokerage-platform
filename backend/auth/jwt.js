const jwt = require("jsonwebtoken");

const env = require("../config/env");


const JWT_ISSUER =
    "zerodha-auth";

const JWT_AUDIENCE =
    "zerodha-web";


/*
|--------------------------------------------------------------------------
| CREATE JWT
|--------------------------------------------------------------------------
*/

function signAccessToken({ userId, role = "USER" }) {
    if (!userId) {
        throw new Error(
            "userId is required to create JWT"
        );
    }

    const normalizedRole = String(role || "USER").trim().toUpperCase();

    if (!["USER", "ADMIN"].includes(normalizedRole)) {
        throw new Error("Invalid user role");
    }

    return jwt.sign(
        {
            userId: String(userId),
            role: normalizedRole,
        },

        env.jwtSecret,

        {
            expiresIn:
                env.jwtExpiresIn,

            issuer:
                JWT_ISSUER,

            audience:
                JWT_AUDIENCE,

            algorithm:
                "HS256",
        }
    );
}


/*
|--------------------------------------------------------------------------
| VERIFY JWT
|--------------------------------------------------------------------------
*/

function verifyAccessToken(token) {
    return jwt.verify(
        token,
        env.jwtSecret,
        {
            issuer:
                JWT_ISSUER,

            audience:
                JWT_AUDIENCE,

            algorithms:
                ["HS256"],
        }
    );
}


/*
|--------------------------------------------------------------------------
| EXTRACT BEARER TOKEN
|--------------------------------------------------------------------------
*/

function extractBearerToken(
    authorizationHeader
) {
    if (
        typeof authorizationHeader !==
        "string"
    ) {
        return null;
    }

    const match =
        authorizationHeader.match(
            /^Bearer\s+(.+)$/i
        );

    if (!match) {
        return null;
    }

    const token =
        match[1].trim();

    return token || null;
}


module.exports = {
    JWT_ISSUER,
    JWT_AUDIENCE,
    signAccessToken,
    verifyAccessToken,
    extractBearerToken,
};