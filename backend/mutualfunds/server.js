require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const requestContext = require('../middleware/requestContext');
const createCorsOptions = require('../middleware/corsOptions');
const errorHandler = require('../middleware/errorHandler');

const mutualFundRoutes = require('./mutualFundRoutes');
const metadataRoutes = require('./mfMetadataRoutes');

const {
  startMFScheduler,
  stopMFScheduler,
  runStartupSync,
} = require('./mfSyncScheduler');

const {
  initDb,
  closeDb,
} = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 5000);
const EXTERNAL_CRON_ONLY =
  String(process.env.MF_SYNC_EXTERNAL_CRON_ONLY || "false").toLowerCase() === "true";

app.use(requestContext);
app.use(helmet());
app.use(cors(createCorsOptions({ credentials: true })));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

app.get('/health', async (req, res) => {
  res.json({
    success: true,
    service: 'mutual-funds',
    port: PORT,
    time: new Date().toISOString(),
  });
});

app.use('/api/mutual-funds/metadata', metadataRoutes);
app.use('/api/mutual-funds', mutualFundRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: 'Route not found.',
    },
    requestId: req.requestId,
  });
});

app.use(errorHandler);

let server = null;
let shuttingDown = false;

async function startServer() {
  try {
    await initDb();

    server = app.listen(
      PORT,
      '127.0.0.1',
      () => {
        console.log(
          `Mutual Fund API running on http://localhost:${PORT}`,
        );

        console.log(
          'Database: MongoDB',
        );

        if (EXTERNAL_CRON_ONLY) {
          console.log(
            "[MF SERVER] In-process schedule disabled; external scheduler owns the 23:15 IST weekday run.",
          );
        } else {
          startMFScheduler();
        }

        // Startup recovery remains enabled even when the separate Render
        // Cron Job owns the regular daily schedule.
        runStartupSync();
      },
    );
  } catch (error) {
    console.error(
      '[MF SERVER] Failed to start:',
      error,
    );

    process.exit(1);
  }
}

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  console.log(
    `[MF SERVER] Received ${signal}, shutting down gracefully...`,
  );

  stopMFScheduler();

  if (!server) {
    try {
      await closeDb();
    } catch (error) {
      console.error(
        '[MF SERVER] MongoDB cleanup error:',
        error.message,
      );
    }

    process.exit(0);
    return;
  }

  server.close(async () => {
    console.log(
      '[MF SERVER] HTTP server closed',
    );

    try {
      await closeDb();

      console.log(
        '[MF SERVER] MongoDB connection cleanup completed',
      );
    } catch (error) {
      console.error(
        '[MF SERVER] MongoDB cleanup error:',
        error.message,
      );
    }

    process.exit(0);
  });

  setTimeout(() => {
    console.warn(
      '[MF SERVER] Forcing shutdown after timeout',
    );

    process.exit(1);
  }, 10000).unref();
}

process.once(
  'SIGINT',
  () => shutdown('SIGINT'),
);

process.once(
  'SIGTERM',
  () => shutdown('SIGTERM'),
);

process.once(
  'uncaughtException',
  (error) => {
    console.error(
      '[MF SERVER] Uncaught exception:',
      error,
    );
  },
);

process.once(
  'unhandledRejection',
  (error) => {
    console.error(
      '[MF SERVER] Unhandled rejection:',
      error,
    );
  },
);

startServer();

module.exports = {
  app,
  startServer,
};
