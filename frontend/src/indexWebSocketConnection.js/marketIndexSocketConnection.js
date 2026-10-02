import { io } from "socket.io-client";

const API_ORIGIN =    process.env.REACT_APP_API_ORIGIN ||    "http://localhost:3000";

const socket = io(API_ORIGIN, {
    transports: ["websocket", "polling"],

    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,

    withCredentials: true,
});

export default socket;