import { io } from "socket.io-client";

const socket = io(window.location.origin, {
    transports: ["websocket"],

    // Auto reconnect
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
});

export default socket;