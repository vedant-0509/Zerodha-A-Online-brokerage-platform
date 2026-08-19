import { io } from 'socket.io-client';

const URL = process.env.REACT_APP_DETAIL_STOCK_SOCKET || 'http://localhost:3011';

const detailStockSocket = io(URL, {
  transports: ['websocket'],
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

export default detailStockSocket;
