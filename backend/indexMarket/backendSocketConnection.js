import { io } from "socket.io-client";

// Set REACT_APP_API_URL (or REACT_APP_BACKEND_URL) to the deployed Central
// API origin in the frontend build environment. Localhost is only a fallback
// for local development; browsers visiting Render cannot reach your PC's
// localhost.
const socketOrigin =
    (typeof process !== "undefined" &&
        (process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL)) ||
    "http://localhost:3000";

const socket = io(socketOrigin, {
    transports: ["websocket"],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
});

socket.on("connect", () => {
    console.log("🟢 Socket Connected:", socket.id);
});

socket.on("disconnect", (reason) => {
    console.log("🔴 Socket Disconnected:", reason);
});

socket.on("connect_error", (err) => {
    console.error("❌ Socket Error:", err.message);
});

export default socket;