import { io } from "socket.io-client";

// CRA environment variables are embedded at build time. Configure this to the
// public Central API origin on Render; local development falls back to :3000.
const API_ORIGIN =
    process.env.REACT_APP_API_ORIGIN ||
    process.env.REACT_APP_API_URL ||
    process.env.REACT_APP_BACKEND_URL ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

const socket = io(API_ORIGIN, {
    transports: ["websocket", "polling"],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 20000,
    withCredentials: true,
});

socket.on("connect", () => {
    console.info("[Index Market] Connected to Central API:", socket.id);
    socket.emit("get_snapshot");
});

socket.on("disconnect", (reason) => {
    console.warn("[Index Market] Socket disconnected:", reason);
});

socket.on("connect_error", (error) => {
    console.error("[Index Market] Socket connection error:", error.message);
});

export default socket;
