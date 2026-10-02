import { io } from "socket.io-client";

const DETAIL_API = window.location.origin;

const detailStockSocket = io(DETAIL_API, {
  transports: ["websocket", "polling"],
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

export default detailStockSocket;