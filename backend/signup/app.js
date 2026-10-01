// require("dotenv").config();

// const express = require("express");
// const cors = require("cors");
// const mysql = require("mysql2/promise");
// const bcrypt = require("bcrypt");
// const jwt = require("jsonwebtoken");
// const crypto = require("crypto");

// const app = express();

// const PORT = 3010;
// const JWT_SECRET = "zerodha_secret_key";

// app.use(cors());

// app.use(express.json());

// app.use(express.urlencoded({ extended: true }));

// const db = mysql.createPool({
//     host: "localhost",
//     user: "root",
//     password: "root",
//     database: "zerodha",
//     waitForConnections: true,
//     connectionLimit: 10,
// });

// app.get("/", (req, res) => {
//     res.send("Signup Backend Running...");
// });


// // SIGNUP
// app.post("/signup", async (req, res) => {
//     console.log("Signup Body:", req.body);

//     try {
//         const { full_name, phone, email, password } = req.body;

//         if (!full_name || !phone || !email || !password) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Please fill all fields",
//             });
//         }

//         const [existing] = await db.execute("SELECT * FROM users WHERE email=?", [
//             email,
//         ]);

//         if (existing.length > 0) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Email already exists",
//             });
//         }

//         const passwordHash = await bcrypt.hash(password, 10);

//         const userId = crypto.randomUUID();

//         await db.execute(
//             `
//             INSERT INTO users
//             (
//                 user_id,
//                 full_name,
//                 email,
//                 phone,
//                 password_hash,
//                 account_status
//             )
//             VALUES
//             (?,?,?,?,?,?)
//             `,
//             [userId, full_name, email, phone, passwordHash, "Active"],
//         );

//         res.json({
//             success: true,
//             message: "Account Created Successfully",
//         });
//     } catch (err) {
//         console.log(err);

//         res.status(500).json({
//             success: false,
//             message: "Server Error",
//         });
//     }
// });


// // LOGIN
// app.post("/login", async (req, res) => {
//     try {
//         const { email, password } = req.body;

//         const [rows] = await db.execute("SELECT * FROM users WHERE email=?", [
//             email,
//         ]);

//         if (rows.length === 0) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Invalid Email",
//             });
//         }

//         const user = rows[0];

//         const matched = await bcrypt.compare(password, user.password_hash);

//         if (!matched) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Wrong Password",
//             });
//         }

//         const token = jwt.sign(
//             {
//                 userId: user.user_id,
//             },
//             JWT_SECRET,
//             {
//                 expiresIn: "7d",
//             },
//         );

//         res.json({
//             success: true,

//             token,

//             user: {
//                 user_id: user.user_id,
//                 full_name: user.full_name,
//                 email: user.email,
//                 phone: user.phone,
//             },
//         });
//     } catch (err) {
//         console.log(err);

//         res.status(500).json({
//             success: false,
//             message: "Server Error",
//         });
//     }
// });


// // VERIFY USER
// app.get("/me", async (req, res) => {
//     try {
//         const auth = req.headers.authorization;

//         if (!auth) {
//             return res.status(401).json({
//                 success: false,
//                 message: "Unauthorized",
//             });
//         }

//         const token = auth.split(" ")[1];

//         const decoded = jwt.verify(token, JWT_SECRET);

//         const [rows] = await db.execute(
//             `
//             SELECT
//                 user_id,
//                 full_name,
//                 email,
//                 phone,
//                 account_status
//             FROM users
//             WHERE user_id=?
//             `,
//             [decoded.userId],
//         );

//         if (rows.length === 0) {
//             return res.status(404).json({
//                 success: false,
//                 message: "User Not Found",
//             });
//         }

//         res.json({
//             success: true,
//             user: rows[0],
//         });
//     } catch (err) {
//         console.log(err);

//         res.status(401).json({
//             success: false,
//             message: "Invalid Token",
//         });
//     }
// });


// // 404
// app.use((req, res) => {
//     res.status(404).json({
//         success: false,
//         message: "Route Not Found",
//     });
// });


// // START SERVER
// const server = app.listen(PORT, () => {
//     console.log(`Server Running on http://localhost:${PORT}`);
//     console.log("--------------------------------");
// });

// server.on("error", (err) => {
//     console.log(err);
// });






















const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit =
    require("express-rate-limit");
const mysql =
    require("mysql2/promise");
const bcrypt =
    require("bcrypt");
const crypto =
    require("crypto");

const env =
    require("../config/env");

const {
    signAccessToken,
} = require("../auth/jwt");

const authenticateToken =
    require("../middleware/authenticateToken");


/*
|--------------------------------------------------------------------------
| APP
|--------------------------------------------------------------------------
*/

const app =
    express();

app.disable(
    "x-powered-by"
);


/*
|--------------------------------------------------------------------------
| TRUST PROXY
|--------------------------------------------------------------------------
|
| Required when deployed behind Render/Nginx/etc.
|--------------------------------------------------------------------------
*/

if (
    env.nodeEnv ===
    "production"
) {
    app.set(
        "trust proxy",
        1
    );
}


/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

app.use(
    cors({
        origin(origin, callback) {

            /*
            No Origin:
            Postman, curl, server-to-server
            */

            if (!origin) {
                return callback(
                    null,
                    true
                );
            }


            if (
                env.frontendOrigins.includes(
                    origin
                )
            ) {
                return callback(
                    null,
                    true
                );
            }


            return callback(
                new Error(
                    "CORS origin not allowed"
                )
            );
        },

        credentials:
            false,

        methods: [
            "GET",
            "POST",
            "OPTIONS",
        ],

        allowedHeaders: [
            "Content-Type",
            "Authorization",
        ],
    })
);


/*
|--------------------------------------------------------------------------
| SECURITY HEADERS
|--------------------------------------------------------------------------
*/

app.use(
    helmet()
);


/*
|--------------------------------------------------------------------------
| BODY PARSING
|--------------------------------------------------------------------------
*/

app.use(
    express.json({
        limit:
            "16kb",
    })
);

app.use(
    express.urlencoded({
        extended: false,
        limit:
            "16kb",
    })
);


/*
|--------------------------------------------------------------------------
| MYSQL
|--------------------------------------------------------------------------
*/

const db =
    mysql.createPool({
        host:
            env.mysql.host,

        port:
            env.mysql.port,

        user:
            env.mysql.user,

        password:
            env.mysql.password,

        database:
            env.mysql.database,

        waitForConnections:
            true,

        connectionLimit:
            env.mysql.connectionLimit,

        queueLimit:
            env.mysql.queueLimit,

        charset:
            "utf8mb4",
    });


/*
|--------------------------------------------------------------------------
| RATE LIMITERS
|--------------------------------------------------------------------------
*/

const loginLimiter =
    rateLimit({
        windowMs:
            env.authRateLimits
                .loginWindowMs,

        limit:
            env.authRateLimits
                .loginLimit,

        standardHeaders:
            "draft-8",

        legacyHeaders:
            false,

        message: {
            success: false,

            error: {
                code:
                    "RATE_LIMITED",

                message:
                    "Too many login attempts. Please try again later.",
            },
        },
    });


const signupLimiter =
    rateLimit({
        windowMs:
            env.authRateLimits
                .signupWindowMs,

        limit:
            env.authRateLimits
                .signupLimit,

        standardHeaders:
            "draft-8",

        legacyHeaders:
            false,

        message: {
            success: false,

            error: {
                code:
                    "RATE_LIMITED",

                message:
                    "Too many signup attempts. Please try again later.",
            },
        },
    });


/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function normalizeEmail(email) {
    return String(
        email || ""
    )
        .trim()
        .toLowerCase();
}


function normalizeName(name) {
    return String(
        name || ""
    )
        .trim()
        .replace(/\s+/g, " ");
}


function normalizePhone(phone) {
    return String(
        phone || ""
    )
        .trim()
        .replace(/[\s()-]/g, "");
}


function isValidEmail(email) {
    return (
        email.length <= 254 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
            email
        )
    );
}


function isValidPhone(phone) {
    return /^\+?[0-9]{10,15}$/.test(
        phone
    );
}


function isValidPassword(password) {
    /*
    BCrypt input should remain <= 72 bytes.
    */

    return (
        typeof password ===
            "string" &&
        password.length >= 8 &&
        password.length <= 72
    );
}


function safeUser(user) {
    return {
        user_id:
            user.user_id,

        full_name:
            user.full_name,

        email:
            user.email,

        phone:
            user.phone,

        account_status:
            user.account_status,
    };
}


/*
|--------------------------------------------------------------------------
| HEALTH
|--------------------------------------------------------------------------
*/

app.get(
    "/",
    (req, res) => {
        return res.json({
            success: true,

            service:
                "signup-auth",

            message:
                "Authentication API running",

            port:
                env.authPort,
        });
    }
);


/*
|--------------------------------------------------------------------------
| SIGNUP
|--------------------------------------------------------------------------
*/

app.post(
    "/signup",
    signupLimiter,
    async (req, res) => {

        try {

            const fullName =
                normalizeName(
                    req.body.full_name
                );

            const phone =
                normalizePhone(
                    req.body.phone
                );

            const email =
                normalizeEmail(
                    req.body.email
                );

            const password =
                String(
                    req.body.password ||
                    ""
                );


            /*
            ------------------------------------------------------------------
            | VALIDATION
            ------------------------------------------------------------------
            */

            if (
                !fullName ||
                !phone ||
                !email ||
                !password
            ) {
                return res.status(400).json({
                    success: false,

                    error: {
                        code:
                            "VALIDATION_ERROR",

                        message:
                            "Please fill all required fields.",
                    },
                });
            }


            if (
                fullName.length < 2 ||
                fullName.length > 100
            ) {
                return res.status(400).json({
                    success: false,

                    error: {
                        code:
                            "VALIDATION_ERROR",

                        message:
                            "Full name is invalid.",
                    },
                });
            }


            if (
                !isValidEmail(email)
            ) {
                return res.status(400).json({
                    success: false,

                    error: {
                        code:
                            "VALIDATION_ERROR",

                        message:
                            "Please enter a valid email address.",
                    },
                });
            }


            if (
                !isValidPhone(phone)
            ) {
                return res.status(400).json({
                    success: false,

                    error: {
                        code:
                            "VALIDATION_ERROR",

                        message:
                            "Please enter a valid phone number.",
                    },
                });
            }


            if (
                !isValidPassword(
                    password
                )
            ) {
                return res.status(400).json({
                    success: false,

                    error: {
                        code:
                            "VALIDATION_ERROR",

                        message:
                            "Password must be between 8 and 72 characters.",
                    },
                });
            }


            /*
            ------------------------------------------------------------------
            | CHECK DUPLICATE EMAIL
            ------------------------------------------------------------------
            */

            const [
                existing,
            ] =
                await db.execute(
                    `
                    SELECT user_id
                    FROM users
                    WHERE email = ?
                    LIMIT 1
                    `,
                    [email]
                );


            if (
                existing.length >
                0
            ) {
                return res.status(409).json({
                    success: false,

                    error: {
                        code:
                            "EMAIL_ALREADY_EXISTS",

                        message:
                            "An account with this email already exists.",
                    },
                });
            }


            /*
            ------------------------------------------------------------------
            | HASH PASSWORD
            ------------------------------------------------------------------
            */

            const passwordHash =
                await bcrypt.hash(
                    password,
                    12
                );


            const userId =
                crypto.randomUUID();


            /*
            ------------------------------------------------------------------
            | INSERT
            ------------------------------------------------------------------
            */

            await db.execute(
                `
                INSERT INTO users
                (
                    user_id,
                    full_name,
                    email,
                    phone,
                    password_hash,
                    account_status
                )
                VALUES
                (?, ?, ?, ?, ?, ?)
                `,
                [
                    userId,
                    fullName,
                    email,
                    phone,
                    passwordHash,
                    "Active",
                ]
            );


            return res.status(201).json({
                success: true,

                message:
                    "Account created successfully.",

                data: {
                    user_id:
                        userId,
                },
            });

        } catch (error) {

            console.error(
                "[AUTH] Signup error:",
                error
            );


            /*
            ------------------------------------------------------------------
            | Duplicate race condition
            ------------------------------------------------------------------
            */

            if (
                error.code ===
                "ER_DUP_ENTRY"
            ) {
                return res.status(409).json({
                    success: false,

                    error: {
                        code:
                            "EMAIL_ALREADY_EXISTS",

                        message:
                            "An account with this email already exists.",
                    },
                });
            }


            return res.status(500).json({
                success: false,

                error: {
                    code:
                        "INTERNAL_ERROR",

                    message:
                        "Unable to create account.",
                },
            });
        }
    }
);


/*
|--------------------------------------------------------------------------
| LOGIN
|--------------------------------------------------------------------------
*/

app.post(
    "/login",
    loginLimiter,
    async (req, res) => {

        try {

            const email =
                normalizeEmail(
                    req.body.email
                );

            const password =
                String(
                    req.body.password ||
                    ""
                );


            if (
                !email ||
                !password
            ) {
                return res.status(400).json({
                    success: false,

                    error: {
                        code:
                            "VALIDATION_ERROR",

                        message:
                            "Email and password are required.",
                    },
                });
            }


            const [
                rows,
            ] =
                await db.execute(
                    `
                    SELECT
                        user_id,
                        full_name,
                        email,
                        phone,
                        password_hash,
                        account_status
                    FROM users
                    WHERE email = ?
                    LIMIT 1
                    `,
                    [email]
                );


            /*
            ------------------------------------------------------------------
            | Generic authentication error
            |
            | Don't reveal whether the email exists.
            ------------------------------------------------------------------
            */

            if (
                rows.length ===
                0
            ) {
                return res.status(401).json({
                    success: false,

                    error: {
                        code:
                            "INVALID_CREDENTIALS",

                        message:
                            "Invalid email or password.",
                    },
                });
            }


            const user =
                rows[0];


            /*
            ------------------------------------------------------------------
            | PASSWORD
            ------------------------------------------------------------------
            */

            const matched =
                await bcrypt.compare(
                    password,
                    user.password_hash
                );


            if (!matched) {
                return res.status(401).json({
                    success: false,

                    error: {
                        code:
                            "INVALID_CREDENTIALS",

                        message:
                            "Invalid email or password.",
                    },
                });
            }


            /*
            ------------------------------------------------------------------
            | ACCOUNT STATUS
            ------------------------------------------------------------------
            */

            if (
                String(
                    user.account_status
                ).toLowerCase() !==
                "active"
            ) {
                return res.status(403).json({
                    success: false,

                    error: {
                        code:
                            "ACCOUNT_NOT_ACTIVE",

                        message:
                            "Your account is not active.",
                    },
                });
            }


            /*
            ------------------------------------------------------------------
            | CREATE JWT
            ------------------------------------------------------------------
            */

            const token =
                signAccessToken({
                    userId:
                        user.user_id,
                });


            return res.json({
                success: true,

                token,

                user:
                    safeUser(user),
            });

        } catch (error) {

            console.error(
                "[AUTH] Login error:",
                error
            );


            return res.status(500).json({
                success: false,

                error: {
                    code:
                        "INTERNAL_ERROR",

                    message:
                        "Unable to complete login.",
                },
            });
        }
    }
);


/*
|--------------------------------------------------------------------------
| CURRENT USER
|--------------------------------------------------------------------------
|
| GET /me
|
| The JWT supplies user_id.
| We then read the current account from MySQL.
|
|--------------------------------------------------------------------------
*/

app.get(
    "/me",
    authenticateToken,
    async (req, res) => {

        try {

            const [
                rows,
            ] =
                await db.execute(
                    `
                    SELECT
                        user_id,
                        full_name,
                        email,
                        phone,
                        account_status
                    FROM users
                    WHERE user_id = ?
                    LIMIT 1
                    `,
                    [
                        req.userId,
                    ]
                );


            if (
                rows.length ===
                0
            ) {
                return res.status(401).json({
                    success: false,

                    error: {
                        code:
                            "USER_NOT_FOUND",

                        message:
                            "Authentication session is no longer valid.",
                    },
                });
            }


            const user =
                rows[0];


            if (
                String(
                    user.account_status
                ).toLowerCase() !==
                "active"
            ) {
                return res.status(403).json({
                    success: false,

                    error: {
                        code:
                            "ACCOUNT_NOT_ACTIVE",

                        message:
                            "Your account is not active.",
                    },
                });
            }


            return res.json({
                success: true,

                user:
                    safeUser(user),
            });

        } catch (error) {

            console.error(
                "[AUTH] /me error:",
                error
            );


            return res.status(500).json({
                success: false,

                error: {
                    code:
                        "INTERNAL_ERROR",

                    message:
                        "Unable to validate session.",
                },
            });
        }
    }
);


/*
|--------------------------------------------------------------------------
| LOGOUT
|--------------------------------------------------------------------------
|
| JWT is stateless in Phase 1.
| The frontend clears the token immediately.
|
| Server-side token revocation/refresh-token rotation
| is a later session-hardening phase.
|
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
    }
);


/*
|--------------------------------------------------------------------------
| 404
|--------------------------------------------------------------------------
*/

app.use(
    (req, res) => {
        return res.status(404).json({
            success: false,

            error: {
                code:
                    "ROUTE_NOT_FOUND",

                message:
                    "Route not found.",
            },
        });
    }
);


/*
|--------------------------------------------------------------------------
| ERROR HANDLER
|--------------------------------------------------------------------------
*/

app.use(
    (error, req, res, next) => {

        console.error(
            "[AUTH] Unhandled error:",
            error
        );


        if (
            error.message ===
            "CORS origin not allowed"
        ) {
            return res.status(403).json({
                success: false,

                error: {
                    code:
                        "CORS_FORBIDDEN",

                    message:
                        "Origin is not allowed.",
                },
            });
        }


        return res.status(500).json({
            success: false,

            error: {
                code:
                    "INTERNAL_ERROR",

                message:
                    "Internal server error.",
            },
        });
    }
);


/*
|--------------------------------------------------------------------------
| SERVER
|--------------------------------------------------------------------------
*/

const server =
    app.listen(
        env.authPort,
        () => {

            console.log(
                `Authentication server running on http://localhost:${env.authPort}`
            );

            console.log(
                `Environment: ${env.nodeEnv}`
            );
        }
    );


/*
|--------------------------------------------------------------------------
| SERVER ERROR
|--------------------------------------------------------------------------
*/

server.on(
    "error",
    (error) => {
        console.error(
            "[AUTH] HTTP server error:",
            error
        );
    }
);


/*
|--------------------------------------------------------------------------
| GRACEFUL SHUTDOWN
|--------------------------------------------------------------------------
*/

async function shutdown(
    signal
) {
    console.log(
        `[AUTH] Received ${signal}. Shutting down...`
    );


    server.close(
        async () => {

            try {

                await db.end();

                console.log(
                    "[AUTH] MySQL pool closed"
                );

            } catch (error) {

                console.error(
                    "[AUTH] MySQL shutdown error:",
                    error.message
                );
            }


            process.exit(0);
        }
    );


    setTimeout(
        () => {
            process.exit(1);
        },
        10000
    ).unref();
}


process.once(
    "SIGINT",
    () =>
        shutdown("SIGINT")
);

process.once(
    "SIGTERM",
    () =>
        shutdown("SIGTERM")
);


module.exports = {
    app,
    server,
    db,
};