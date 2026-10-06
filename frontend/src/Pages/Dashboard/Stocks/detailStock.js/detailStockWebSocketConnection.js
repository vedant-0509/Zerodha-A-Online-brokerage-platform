import { io } from "socket.io-client";

const API_ORIGIN =
  process.env.REACT_APP_API_ORIGIN ||
  window.location.origin;

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