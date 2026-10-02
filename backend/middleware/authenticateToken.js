const {
    extractBearerToken,
    verifyAccessToken,
} = require("../auth/jwt");

function authenticateToken(req, res, next) {
    const token = extractBearerToken(
        req.headers.authorization
    );

    if (!token) {
        return res.status(401).json({
            success: false,
            error: {
                code: "AUTHENTICATION_REQUIRED",
                message: "Authentication required",
            },
        });
    }

    try {
        const decoded = verifyAccessToken(token);

        if (
            !decoded ||
            typeof decoded.userId !== "string" ||
            !decoded.userId.trim()
        ) {
            return res.status(401).json({
                success: false,
                error: {
                    code: "INVALID_TOKEN",
                    message: "Invalid authentication token",
                },
            });
        }

        const role = String(
            decoded.role || "USER"
        )
            .trim()
            .toUpperCase();

        if (!["USER", "ADMIN"].includes(role)) {
            return res.status(401).json({
                success: false,
                error: {
                    code: "INVALID_TOKEN",
                    message: "Invalid authentication token",
                },
            });
        }

        req.userId = decoded.userId.trim();
        req.user = {
            ...decoded,
            userId: req.userId,
            role,
        };
        req.userRole = role;

        return next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            error: {
                code: "INVALID_TOKEN",
                message: "Invalid or expired authentication token",
            },
        });
    }
}

module.exports = authenticateToken;