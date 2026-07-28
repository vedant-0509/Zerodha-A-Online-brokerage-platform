import { io } from "socket.io-client";

const socket = io("http://localhost:3000", {
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