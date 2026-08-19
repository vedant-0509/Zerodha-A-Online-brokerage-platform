require('dotenv').config();

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

module.exports = {
  port: Number(process.env.PORT || 3011),
  origins: (process.env.FRONTEND_ORIGIN || 'http://localhost:3000,http://localhost:3001').split(',').map(s => s.trim()).filter(Boolean),
  upstoxAccessToken: required('UPSTOX_ACCESS_TOKEN'),
  upstoxStreamMode: process.env.UPSTOX_STREAM_MODE || 'full',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  mysqlEnabled: String(process.env.MYSQL_ENABLED || 'false').toLowerCase() === 'true',
  mysql: {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'zerodha'
  },
  timezone: process.env.MARKET_TIMEZONE || 'Asia/Kolkata',
  marketOpen: process.env.MARKET_OPEN || '09:15',
  marketClose: process.env.MARKET_CLOSE || '15:30',
  closeJobTime: process.env.CLOSE_JOB_TIME || '15:35',
  historyCacheSeconds: Number(process.env.HISTORY_CACHE_SECONDS || 60),
  snapshotCacheSeconds: Number(process.env.SNAPSHOT_CACHE_SECONDS || 86400),
  startupInstrumentKeys: (process.env.STARTUP_INSTRUMENT_KEYS || '').split(',').map(s => s.trim()).filter(Boolean),
  reconcileOnStartup: String(process.env.RECONCILE_ON_STARTUP || 'true').toLowerCase() === 'true'
};
