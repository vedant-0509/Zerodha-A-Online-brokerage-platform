function validateBodyObject(options = {}) {
    const {
        allowEmpty = true,
        allowedFields = null,
        requiredFields = [],
        fieldRules = {},
    } = options;

    return (req, res, next) => {
        const body = req.body;

        if (body == null) {
            if (allowEmpty) return next();
            return res.status(400).json({
                success: false,
                error: { code: "VALIDATION_ERROR", message: "Request body is required." },
                requestId: req.requestId,
            });
        }

        if (typeof body !== "object" || Array.isArray(body)) {
            return res.status(400).json({
                success: false,
                error: { code: "VALIDATION_ERROR", message: "Request body must be a JSON object." },
                requestId: req.requestId,
            });
        }

        if (Array.isArray(allowedFields)) {
            const unknown = Object.keys(body).filter((key) => !allowedFields.includes(key));
            if (unknown.length) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: "VALIDATION_ERROR",
                        message: `Unknown request field: ${unknown[0]}.`,
                    },
                    requestId: req.requestId,
                });
            }
        }

        for (const field of requiredFields) {
            const value = body[field];
            if (value === undefined || value === null || String(value).trim() === "") {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: "VALIDATION_ERROR",
                        message: `${field} is required.`,
                    },
                    requestId: req.requestId,
                });
            }
        }

        for (const [field, rule] of Object.entries(fieldRules)) {
            if (body[field] === undefined || body[field] === null) continue;
            const value = body[field];

            if (rule.type === "string" && typeof value !== "string") {
                return res.status(400).json({
                    success: false,
                    error: { code: "VALIDATION_ERROR", message: `${field} must be a string.` },
                    requestId: req.requestId,
                });
            }

            if (rule.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) {
                return res.status(400).json({
                    success: false,
                    error: { code: "VALIDATION_ERROR", message: `${field} must be a valid number.` },
                    requestId: req.requestId,
                });
            }

            if (rule.maxLength && String(value).length > rule.maxLength) {
                return res.status(400).json({
                    success: false,
                    error: { code: "VALIDATION_ERROR", message: `${field} exceeds the maximum length.` },
                    requestId: req.requestId,
                });
            }
        }

        return next();
    };
}

module.exports = { validateBodyObject };