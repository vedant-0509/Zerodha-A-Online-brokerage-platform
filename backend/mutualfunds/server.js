// // require('dotenv').config();
// // const express = require('express');
// // const cors = require('cors');
// // const mutualFundRoutes = require('./mutualFundRoutes');
// // const metadataRoutes = require('./mfMetadataRoutes');
// // const { startMFScheduler, stopMFScheduler, runStartupSync } = require('./mfSyncScheduler');
// // const pool = require('./db');

// // const app = express();
// // const PORT = Number(process.env.PORT || 5000);

// // app.use(cors({ origin: true, credentials: true }));
// // app.use(express.json({ limit: '2mb' }));
// // app.use(express.urlencoded({ extended: true }));

// // app.get('/health', async (req, res) => {
// //   res.json({ success: true, service: 'mutual-funds', port: PORT, time: new Date().toISOString() });
// // });

// // app.use('/api/mutual-funds/metadata', metadataRoutes);
// // app.use('/api/mutual-funds', mutualFundRoutes);

// // app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
// // app.use((error, req, res, next) => {
// //   console.error('[MF SERVER]', error);
// //   res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
// // });

// // const server = app.listen(PORT, () => {
// //   console.log(`🚀 Mutual Fund API running on http://localhost:${PORT}`);

// //   // Start serving API requests immediately - do not block on sync.
// //   // The scheduler owns the production cron schedule; runStartupSync()
// //   // covers the dev-restart case AND acts as the first-ever prod sync
// //   // if the process happens to start before the scheduled cron time.
// //   // Both paths call the SAME checked sync function (see mfSyncScheduler.js),
// //   // so on a day where sync already succeeded, this is a fast no-op.
// //   startMFScheduler();
// //   runStartupSync();
// // });

// // /*
// // |--------------------------------------------------------------------------
// // | Graceful shutdown
// // |--------------------------------------------------------------------------
// // */
// // let shuttingDown = false;

// // async function shutdown(signal) {
// //   if (shuttingDown) return;
// //   shuttingDown = true;
// //   console.log(`[MF SERVER] Received ${signal}, shutting down gracefully...`);

// //   stopMFScheduler();

// //   server.close(async () => {
// //     console.log('[MF SERVER] HTTP server closed');
// //     try {
// //       await pool.end();
// //       console.log('[MF SERVER] MySQL pool closed');
// //     } catch (err) {
// //       console.error('[MF SERVER] Error closing MySQL pool:', err.message);
// //     }
// //     process.exit(0);
// //   });

// //   // Force-exit if something hangs (e.g. an in-flight sync holding a connection).
// //   setTimeout(() => {
// //     console.warn('[MF SERVER] Forcing shutdown after timeout');
// //     process.exit(1);
// //   }, 10000).unref();
// // }

// // process.on('SIGINT', () => shutdown('SIGINT'));
// // process.on('SIGTERM', () => shutdown('SIGTERM'));

// // module.exports = server;






















// require('dotenv').config();
// const express = require('express');
// const cors = require('cors');
// const mutualFundRoutes = require('./mutualFundRoutes');
// const metadataRoutes = require('./mfMetadataRoutes');
// const { startMFScheduler, stopMFScheduler, runStartupSync } = require('./mfSyncScheduler');
// const pool = require('./db');

// const app = express();
// const PORT = Number(process.env.PORT || 5000);

// app.use(cors({ origin: true, credentials: true }));
// app.use(express.json({ limit: '2mb' }));
// app.use(express.urlencoded({ extended: true }));

// app.get('/health', async (req, res) => {
//   res.json({ success: true, service: 'mutual-funds', port: PORT, time: new Date().toISOString() });
// });

// app.use('/api/mutual-funds/metadata', metadataRoutes);
// app.use('/api/mutual-funds', mutualFundRoutes);

// app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
// app.use((error, req, res, next) => {
//   console.error('[MF SERVER]', error);
//   res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
// });

// const server = app.listen(PORT, "127.0.0.1", () => {
//   console.log(`🚀 Mutual Fund API running on http://localhost:${PORT}`);

//   // Start serving API requests immediately - do not block on sync.
//   // The scheduler owns the production cron schedule; runStartupSync()
//   // covers the dev-restart case AND acts as the first-ever prod sync
//   // if the process happens to start before the scheduled cron time.
//   // Both paths call the SAME checked sync function (see mfSyncScheduler.js),
//   // so on a day where sync already succeeded, this is a fast no-op.
//   startMFScheduler();
//   runStartupSync();
// });

// /*
// |--------------------------------------------------------------------------
// | Graceful shutdown
// |--------------------------------------------------------------------------
// */
// let shuttingDown = false;

// async function shutdown(signal) {
//   if (shuttingDown) return;
//   shuttingDown = true;
//   console.log(`[MF SERVER] Received ${signal}, shutting down gracefully...`);

//   stopMFScheduler();

//   server.close(async () => {
//     console.log('[MF SERVER] HTTP server closed');
//     try {
//       await pool.end();
//       console.log('[MF SERVER] MySQL pool closed');
//     } catch (err) {
//       console.error('[MF SERVER] Error closing MySQL pool:', err.message);
//     }
//     process.exit(0);
//   });

//   // Force-exit if something hangs (e.g. an in-flight sync holding a connection).
//   setTimeout(() => {
//     console.warn('[MF SERVER] Forcing shutdown after timeout');
//     process.exit(1);
//   }, 10000).unref();
// }

// process.on('SIGINT', () => shutdown('SIGINT'));
// process.on('SIGTERM', () => shutdown('SIGTERM'));

// module.exports = server;















require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const requestContext = require('../middleware/requestContext');
const createCorsOptions = require('../middleware/corsOptions');
const errorHandler = require('../middleware/errorHandler');
const mutualFundRoutes = require('./mutualFundRoutes');
const metadataRoutes = require('./mfMetadataRoutes');
const { startMFScheduler, stopMFScheduler, runStartupSync } = require('./mfSyncScheduler');
const pool = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.use(requestContext);
app.use(helmet());
app.use(cors(createCorsOptions({ credentials: true })));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

app.get('/health', async (req, res) => {
  res.json({ success: true, service: 'mutual-funds', port: PORT, time: new Date().toISOString() });
});

app.use('/api/mutual-funds/metadata', metadataRoutes);
app.use('/api/mutual-funds', mutualFundRoutes);

app.use((req, res) => res.status(404).json({
  success: false,
  error: { code: 'ROUTE_NOT_FOUND', message: 'Route not found.' },
  requestId: req.requestId,
}));
app.use(errorHandler);

const server = app.listen(PORT, "127.0.0.1", () => {
  console.log(`🚀 Mutual Fund API running on http://localhost:${PORT}`);

  // Start serving API requests immediately - do not block on sync.
  // The scheduler owns the production cron schedule; runStartupSync()
  // covers the dev-restart case AND acts as the first-ever prod sync
  // if the process happens to start before the scheduled cron time.
  // Both paths call the SAME checked sync function (see mfSyncScheduler.js),
  // so on a day where sync already succeeded, this is a fast no-op.
  startMFScheduler();
  runStartupSync();
});

/*
|--------------------------------------------------------------------------
| Graceful shutdown
|--------------------------------------------------------------------------
*/
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[MF SERVER] Received ${signal}, shutting down gracefully...`);

  stopMFScheduler();

  server.close(async () => {
    console.log('[MF SERVER] HTTP server closed');
    try {
      await pool.end();
      console.log('[MF SERVER] MySQL pool closed');
    } catch (err) {
      console.error('[MF SERVER] Error closing MySQL pool:', err.message);
    }
    process.exit(0);
  });

  // Force-exit if something hangs (e.g. an in-flight sync holding a connection).
  setTimeout(() => {
    console.warn('[MF SERVER] Forcing shutdown after timeout');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = server;