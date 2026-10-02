function requireRole(...allowedRoles) {
    const roles = allowedRoles
        .flat()
        .map((role) =>
            String(role)
                .trim()
                .toUpperCase()
        )
        .filter(Boolean);

    if (roles.length === 0) {
        throw new Error(
            "requireRole() requires at least one role"
        );
    }

    return function roleMiddleware(req, res, next) {
        if (!req.userId) {
            return res.status(401).json({
                success: false,
                error: {
                    code: "AUTHENTICATION_REQUIRED",
                    message: "Authentication required",
                },
            });
        }

        const userRole = String(
            req.userRole ||
                req.user?.role ||
                "USER"
        )
            .trim()
            .toUpperCase();

        if (!roles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                error: {
                    code: "FORBIDDEN",
                    message:
                        "You do not have permission to perform this action.",
                },
            });
        }

        return next();
    };
}

module.exports = requireRole;