import { io } from "socket.io-client";

// Detail Stock WebSocket must connect through the public central API gateway.
// In local development this is port 3000; in production set REACT_APP_API_ORIGIN.
const API_ORIGIN =
  process.env.REACT_APP_API_ORIGIN || "http://localhost:3000";

const detailStockSocket = io(API_ORIGIN, {
  transports: ["websocket", "polling"],
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  withCredentials: true,
});

export default detailStockSocket;
