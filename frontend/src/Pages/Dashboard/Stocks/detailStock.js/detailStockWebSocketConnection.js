// import { io } from "socket.io-client";

// const API_ORIGIN =
//     process.env.REACT_APP_API_ORIGIN ||
//     window.location.origin;

// const detailStockSocket = io(API_ORIGIN, {
//     transports: ["websocket", "polling"],
//     autoConnect: true,
//     reconnection: true,
//     reconnectionAttempts: Infinity,
//     reconnectionDelay: 1000,
//     reconnectionDelayMax: 5000,
//     withCredentials: true,
// });

// export default detailStockSocket;











import { io } from "socket.io-client";

/*
 * WebSocket should connect directly to the backend.
 *
 * We intentionally do NOT use window.location.origin here because
 * the frontend is served by Nginx and Nginx was previously failing
 * while proxying /socket.io to the backend Render service.
 *
 * Local:
 *   http://localhost:3000
 *
 * Production:
 *   https://zerodha-backend-mm0p.onrender.com
 */
const SOCKET_ORIGIN =
    process.env.REACT_APP_WS_ORIGIN ||
    process.env.REACT_APP_API_ORIGIN ||
    "http://localhost:3000";

const detailStockSocket = io(
    SOCKET_ORIGIN,
    {
        path: "/socket.io",

        /*
         * Try WebSocket first.
         * Socket.IO will fall back to polling when necessary.
         */
        transports: [
            "websocket",
            "polling",
        ],

        autoConnect: true,

        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,

        withCredentials: true,
    }
);

/*
 * Debug connection state.
 * These logs make it very easy to verify the
 * live market connection in browser DevTools.
 */
detailStockSocket.on(
    "connect",
    () => {
        console.log(
            "🟢 Detail Stock WebSocket connected:",
            detailStockSocket.id,
            "transport:",
            detailStockSocket.io.engine.transport.name
        );
    }
);

detailStockSocket.on(
    "connect_error",
    (error) => {
        console.error(
            "🔴 Detail Stock WebSocket connection error:",
            error?.message || error
        );
    }
);

detailStockSocket.on(
    "disconnect",
    (reason) => {
        console.warn(
            "🟡 Detail Stock WebSocket disconnected:",
            reason
        );
    }
);

export default detailStockSocket;