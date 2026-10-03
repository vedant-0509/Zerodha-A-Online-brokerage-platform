const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const env = require("../config/env");

const {
    connectMongoDB,
    getMongoDB,
    closeMongoDB,
} = require("../config/mongodb");

const { signAccessToken } = require("../auth/jwt");

const authenticateToken = require("../middleware/authenticateToken");
const requestContext = require("../middleware/requestContext");
const createCorsOptions = require("../middleware/corsOptions");
const errorHandler = require("../middleware/errorHandler");
const { validateBodyObject } = require("../middleware/validateRequest");


/*
|--------------------------------------------------------------------------
| APP
|--------------------------------------------------------------------------
*/

const app = express();

app.disable("x-powered-by");


/*
|--------------------------------------------------------------------------
| TRUST PROXY
|--------------------------------------------------------------------------
*/

if (env.nodeEnv === "production") {
    app.set("trust proxy", 1);
}


/*
|--------------------------------------------------------------------------
| REQUEST CONTEXT
|--------------------------------------------------------------------------
*/

app.use(requestContext);


/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

app.use(cors(createCorsOptions({ credentials: false })));


/*
|--------------------------------------------------------------------------
| SECURITY HEADERS
|--------------------------------------------------------------------------
*/

app.use(helmet());


/*
|--------------------------------------------------------------------------
| BODY PARSING
|--------------------------------------------------------------------------
*/

app.use(
    express.json({
        limit: "16kb",
    }),
);

app.use(
    express.urlencoded({
        extended: false,
        limit: "16kb",
    }),
);


/*
|--------------------------------------------------------------------------
| MONGODB
|--------------------------------------------------------------------------
*/

function getUsersCollection() {
    const db = getMongoDB();

    return db.collection("users");
}


/*
|--------------------------------------------------------------------------
| RATE LIMITERS
|--------------------------------------------------------------------------
*/

const loginLimiter = rateLimit({
    windowMs: env.authRateLimits.loginWindowMs,
    limit: env.authRateLimits.loginLimit,
    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        success: false,
        error: {
            code: "RATE_LIMITED",
            message: "Too many login attempts. Please try again later.",
        },
    },
});


const signupLimiter = rateLimit({
    windowMs: env.authRateLimits.signupWindowMs,
    limit: env.authRateLimits.signupLimit,
    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        success: false,
        error: {
            code: "RATE_LIMITED",
            message: "Too many signup attempts. Please try again later.",
        },
    },
});


/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function normalizeEmail(email) {
    return String(email || "")
        .trim()
        .toLowerCase();
}


function normalizeName(name) {
    return String(name || "")
        .trim()
        .replace(/\s+/g, " ");
}


function normalizePhone(phone) {
    return String(phone || "")
        .trim()
        .replace(/[\s()-]/g, "");
}


function isValidEmail(email) {
    return (
        email.length <= 254 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    );
}


function isValidPhone(phone) {
    return /^\+?[0-9]{10,15}$/.test(phone);
}


function isValidPassword(password) {
    /*
     * BCrypt input should remain <= 72 bytes.
     */

    return (
        typeof password === "string" &&
        password.length >= 8 &&
        password.length <= 72
    );
}


function safeUser(user) {
    return {
        user_id: user.userId,
        full_name: user.fullName,
        email: user.email,
        phone: user.phone,
        account_status: user.accountStatus,
        role: String(user.role || "USER")
            .trim()
            .toUpperCase(),
    };
}


/*
|--------------------------------------------------------------------------
| HEALTH
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {
    return res.json({
        success: true,
        service: "signup-auth",
        message: "Authentication API running",
        port: env.authPort,
        database: "MongoDB",
    });
});


/*
|--------------------------------------------------------------------------
| SIGNUP
|--------------------------------------------------------------------------
*/

app.post(
    "/signup",

    signupLimiter,

    validateBodyObject({
        allowEmpty: false,

        allowedFields: [
            "full_name",
            "phone",
            "email",
            "password",
        ],

        requiredFields: [
            "full_name",
            "phone",
            "email",
            "password",
        ],

        fieldRules: {
            full_name: {
                type: "string",
                maxLength: 100,
            },

            phone: {
                type: "string",
                maxLength: 30,
            },

            email: {
                type: "string",
                maxLength: 254,
            },

            password: {
                type: "string",
                maxLength: 128,
            },
        },
    }),

    async (req, res) => {
        try {
            const fullName = normalizeName(req.body.full_name);
            const phone = normalizePhone(req.body.phone);
            const email = normalizeEmail(req.body.email);
            const password = String(req.body.password || "");


            /*
            |--------------------------------------------------------------------------
            | VALIDATION
            |--------------------------------------------------------------------------
            */

            if (!fullName || !phone || !email || !password) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: "VALIDATION_ERROR",
                        message: "Please fill all required fields.",
                    },
                });
            }


            if (fullName.length < 2 || fullName.length > 100) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: "VALIDATION_ERROR",
                        message: "Full name is invalid.",
                    },
                });
            }


            if (!isValidEmail(email)) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: "VALIDATION_ERROR",
                        message: "Please enter a valid email address.",
                    },
                });
            }


            if (!isValidPhone(phone)) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: "VALIDATION_ERROR",
                        message: "Please enter a valid phone number.",
                    },
                });
            }


            if (!isValidPassword(password)) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: "VALIDATION_ERROR",
                        message:
                            "Password must be between 8 and 72 characters.",
                    },
                });
            }


            /*
            |--------------------------------------------------------------------------
            | MONGODB COLLECTION
            |--------------------------------------------------------------------------
            */

            const users = getUsersCollection();


            /*
            |--------------------------------------------------------------------------
            | CHECK DUPLICATE EMAIL
            |--------------------------------------------------------------------------
            */

            const existing = await users.findOne(
                {
                    email,
                },
                {
                    projection: {
                        _id: 1,
                        userId: 1,
                    },
                },
            );


            if (existing) {
                return res.status(409).json({
                    success: false,
                    error: {
                        code: "EMAIL_ALREADY_EXISTS",
                        message:
                            "An account with this email already exists.",
                    },
                });
            }


            /*
            |--------------------------------------------------------------------------
            | HASH PASSWORD
            |--------------------------------------------------------------------------
            */

            const passwordHash = await bcrypt.hash(password, 12);

            const userId = crypto.randomUUID();

            const now = new Date();


            /*
            |--------------------------------------------------------------------------
            | INSERT USER
            |--------------------------------------------------------------------------
            */

            await users.insertOne({
                userId,

                fullName,

                email,

                phone,

                passwordHash,

                accountStatus: "Active",

                role: "USER",

                createdAt: now,

                updatedAt: now,

                migratedAt: null,
            });


            return res.status(201).json({
                success: true,

                message: "Account created successfully.",

                data: {
                    user_id: userId,
                },
            });

        } catch (error) {

            console.error("[AUTH] Signup error:", error);


            /*
            |--------------------------------------------------------------------------
            | MongoDB duplicate-key race condition
            |--------------------------------------------------------------------------
            */

            if (error && error.code === 11000) {
                return res.status(409).json({
                    success: false,
                    error: {
                        code: "EMAIL_ALREADY_EXISTS",
                        message:
                            "An account with this email already exists.",
                    },
                });
            }


            return res.status(500).json({
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "Unable to create account.",
                },
            });
        }
    },
);


/*
|--------------------------------------------------------------------------
| LOGIN
|--------------------------------------------------------------------------
*/

app.post(
    "/login",

    loginLimiter,

    validateBodyObject({
        allowEmpty: false,

        allowedFields: [
            "email",
            "password",
        ],

        requiredFields: [
            "email",
            "password",
        ],

        fieldRules: {
            email: {
                type: "string",
                maxLength: 254,
            },

            password: {
                type: "string",
                maxLength: 128,
            },
        },
    }),

    async (req, res) => {
        try {
            const email = normalizeEmail(req.body.email);

            const password = String(req.body.password || "");


            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: "VALIDATION_ERROR",
                        message:
                            "Email and password are required.",
                    },
                });
            }


            const users = getUsersCollection();


            /*
            |--------------------------------------------------------------------------
            | FIND USER
            |--------------------------------------------------------------------------
            */

            const user = await users.findOne({
                email,
            });


            /*
            |--------------------------------------------------------------------------
            | GENERIC AUTHENTICATION ERROR
            |--------------------------------------------------------------------------
            |
            | Don't reveal whether the email exists.
            |--------------------------------------------------------------------------
            */

            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: {
                        code: "INVALID_CREDENTIALS",
                        message:
                            "Invalid email or password.",
                    },
                });
            }


            /*
            |--------------------------------------------------------------------------
            | PASSWORD
            |--------------------------------------------------------------------------
            */

            const matched = await bcrypt.compare(
                password,
                user.passwordHash,
            );


            if (!matched) {
                return res.status(401).json({
                    success: false,
                    error: {
                        code: "INVALID_CREDENTIALS",
                        message:
                            "Invalid email or password.",
                    },
                });
            }


            /*
            |--------------------------------------------------------------------------
            | ACCOUNT STATUS
            |--------------------------------------------------------------------------
            */

            if (
                String(user.accountStatus).toLowerCase() !==
                "active"
            ) {
                return res.status(403).json({
                    success: false,
                    error: {
                        code: "ACCOUNT_NOT_ACTIVE",
                        message:
                            "Your account is not active.",
                    },
                });
            }


            /*
            |--------------------------------------------------------------------------
            | CREATE JWT
            |--------------------------------------------------------------------------
            */

            const token = signAccessToken({
                userId: user.userId,
                role: user.role || "USER",
            });


            return res.json({
                success: true,

                token,

                user: safeUser(user),
            });

        } catch (error) {

            console.error("[AUTH] Login error:", error);


            return res.status(500).json({
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message:
                        "Unable to complete login.",
                },
            });
        }
    },
);


/*
|--------------------------------------------------------------------------
| CURRENT USER
|--------------------------------------------------------------------------
|
| GET /me
|
| The JWT supplies userId.
| We then read the current account from MongoDB.
|--------------------------------------------------------------------------
*/

app.get(
    "/me",

    authenticateToken,

    async (req, res) => {

        try {

            const users = getUsersCollection();


            const user = await users.findOne({
                userId: req.userId,
            });


            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: {
                        code: "USER_NOT_FOUND",
                        message:
                            "Authentication session is no longer valid.",
                    },
                });
            }


            if (
                String(user.accountStatus).toLowerCase() !==
                "active"
            ) {
                return res.status(403).json({
                    success: false,
                    error: {
                        code: "ACCOUNT_NOT_ACTIVE",
                        message:
                            "Your account is not active.",
                    },
                });
            }


            return res.json({
                success: true,

                user: safeUser(user),
            });

        } catch (error) {

            console.error("[AUTH] /me error:", error);


            return res.status(500).json({
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message:
                        "Unable to validate session.",
                },
            });
        }
    },
);


/*
|--------------------------------------------------------------------------
| LOGOUT
|--------------------------------------------------------------------------
|
| JWT is stateless in Phase 1.
| The frontend clears the token immediately.
|--------------------------------------------------------------------------
*/

app.post(
    "/logout",

    authenticateToken,

    (req, res) => {

        return res.json({
            success: true,

            message:
                "Logout acknowledged. Clear the local session token.",
        });
    },
);


/*
|--------------------------------------------------------------------------
| 404
|--------------------------------------------------------------------------
*/

app.use((req, res) => {

    return res.status(404).json({
        success: false,

        error: {
            code: "ROUTE_NOT_FOUND",
            message: "Route not found.",
        },
    });
});


/*
|--------------------------------------------------------------------------
| GLOBAL ERROR HANDLER
|--------------------------------------------------------------------------
*/

app.use(errorHandler);


/*
|--------------------------------------------------------------------------
| SERVER
|--------------------------------------------------------------------------
*/

let server = null;


async function startServer() {

    try {

        /*
        |--------------------------------------------------------------------------
        | CONNECT MONGODB FIRST
        |--------------------------------------------------------------------------
        */

        await connectMongoDB();


        /*
        |--------------------------------------------------------------------------
        | START HTTP SERVER
        |--------------------------------------------------------------------------
        */

        server = app.listen(
            env.authPort,
            "127.0.0.1",
            () => {

                console.log(
                    `Authentication server running on http://localhost:${env.authPort}`,
                );

                console.log(
                    `Environment: ${env.nodeEnv}`,
                );

                console.log(
                    "Database: MongoDB",
                );
            },
        );


        /*
        |--------------------------------------------------------------------------
        | SERVER ERROR HANDLER
        |--------------------------------------------------------------------------
        |
        | IMPORTANT:
        | server.on() must be called only after app.listen()
        | has returned the server instance.
        |--------------------------------------------------------------------------
        */

        server.on(
            "error",
            (error) => {

                console.error(
                    "[AUTH] HTTP server error:",
                    error,
                );
            },
        );


    } catch (error) {

        console.error(
            "[AUTH] MongoDB startup failed:",
            error.message,
        );


        /*
        |--------------------------------------------------------------------------
        | Try to close MongoDB if startup partially succeeded
        |--------------------------------------------------------------------------
        */

        try {

            await closeMongoDB();

        } catch (closeError) {

            console.error(
                "[AUTH] MongoDB cleanup error:",
                closeError.message,
            );
        }


        process.exit(1);
    }
}


startServer();


/*
|--------------------------------------------------------------------------
| GRACEFUL SHUTDOWN
|--------------------------------------------------------------------------
*/

async function shutdown(signal) {

    console.log(
        `[AUTH] Received ${signal}. Shutting down...`,
    );


    /*
    |--------------------------------------------------------------------------
    | SERVER NOT STARTED
    |--------------------------------------------------------------------------
    */

    if (!server) {

        try {

            await closeMongoDB();

        } catch (error) {

            console.error(
                "[AUTH] MongoDB shutdown error:",
                error.message,
            );
        }

        process.exit(0);
    }


    /*
    |--------------------------------------------------------------------------
    | CLOSE HTTP SERVER
    |--------------------------------------------------------------------------
    */

    server.close(async () => {

        console.log(
            "[AUTH] Authentication server closed",
        );


        try {

            await closeMongoDB();

            console.log(
                "[AUTH] MongoDB connection closed",
            );

        } catch (error) {

            console.error(
                "[AUTH] MongoDB shutdown error:",
                error.message,
            );
        }


        process.exit(0);
    });


    /*
    |--------------------------------------------------------------------------
    | FORCE EXIT AFTER 10 SECONDS
    |--------------------------------------------------------------------------
    */

    setTimeout(() => {

        console.error(
            "[AUTH] Forced shutdown after timeout.",
        );

        process.exit(1);

    }, 10000).unref();
}


/*
|--------------------------------------------------------------------------
| PROCESS SIGNALS
|--------------------------------------------------------------------------
*/

process.once(
    "SIGINT",
    () => shutdown("SIGINT"),
);

process.once(
    "SIGTERM",
    () => shutdown("SIGTERM"),
);


/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {
    app,
    getServer: () => server,
};