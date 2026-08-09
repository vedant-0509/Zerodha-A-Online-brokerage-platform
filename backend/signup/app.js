require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const app = express();

const PORT = 3010;
const JWT_SECRET = "zerodha_secret_key";

app.use(cors());

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "root",
    database: "zerodha",
    waitForConnections: true,
    connectionLimit: 10,
});

app.get("/", (req, res) => {
    res.send("Signup Backend Running...");
});


// SIGNUP
app.post("/signup", async (req, res) => {
    console.log("Signup Body:", req.body);

    try {
        const { full_name, phone, email, password } = req.body;

        if (!full_name || !phone || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Please fill all fields",
            });
        }

        const [existing] = await db.execute("SELECT * FROM users WHERE email=?", [
            email,
        ]);

        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Email already exists",
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const userId = crypto.randomUUID();

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
            (?,?,?,?,?,?)
            `,
            [userId, full_name, email, phone, passwordHash, "Active"],
        );

        res.json({
            success: true,
            message: "Account Created Successfully",
        });
    } catch (err) {
        console.log(err);

        res.status(500).json({
            success: false,
            message: "Server Error",
        });
    }
});


// LOGIN
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const [rows] = await db.execute("SELECT * FROM users WHERE email=?", [
            email,
        ]);

        if (rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid Email",
            });
        }

        const user = rows[0];

        const matched = await bcrypt.compare(password, user.password_hash);

        if (!matched) {
            return res.status(400).json({
                success: false,
                message: "Wrong Password",
            });
        }

        const token = jwt.sign(
            {
                userId: user.user_id,
            },
            JWT_SECRET,
            {
                expiresIn: "7d",
            },
        );

        res.json({
            success: true,

            token,

            user: {
                user_id: user.user_id,
                full_name: user.full_name,
                email: user.email,
                phone: user.phone,
            },
        });
    } catch (err) {
        console.log(err);

        res.status(500).json({
            success: false,
            message: "Server Error",
        });
    }
});


// VERIFY USER
app.get("/me", async (req, res) => {
    try {
        const auth = req.headers.authorization;

        if (!auth) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }

        const token = auth.split(" ")[1];

        const decoded = jwt.verify(token, JWT_SECRET);

        const [rows] = await db.execute(
            `
            SELECT
                user_id,
                full_name,
                email,
                phone,
                account_status
            FROM users
            WHERE user_id=?
            `,
            [decoded.userId],
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User Not Found",
            });
        }

        res.json({
            success: true,
            user: rows[0],
        });
    } catch (err) {
        console.log(err);

        res.status(401).json({
            success: false,
            message: "Invalid Token",
        });
    }
});


// 404
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route Not Found",
    });
});


// START SERVER
const server = app.listen(PORT, () => {
    console.log(`Server Running on http://localhost:${PORT}`);
    console.log("--------------------------------");
});

server.on("error", (err) => {
    console.log(err);
});
