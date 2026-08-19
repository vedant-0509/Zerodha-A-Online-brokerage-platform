const express = require('express');
const http = require('http');
const cors = require('cors');
const cron = require('node-cron');
const { Server } = require('socket.io');
const env = require('./env');
const logger = require('./logger');
const { redis, connectRedis } = require('./redis');
const { initDb, saveDailyClose, getDbHistory } = require('./db');
const { isMarketOpen, indiaDate } = require('./market');
const upstox = require('./upstox');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors:{ origin: env.origins, methods:['GET','POST'], credentials:true } });
app.use(cors({ origin: env.origins, credentials:true }));
app.use(express.json());

const subscribers = new Map(); // instrumentKey -> Set(socket.id)
const snapshots = new Map();
const SNAP_PREFIX = 'detailstock:snapshot:';
const HISTORY_PREFIX = 'detailstock:history:';

function validKey(key) { return typeof key === 'string' && key.length >= 3 && key.length <= 180; }
function snapshotKey(key) { return `${SNAP_PREFIX}${key}`; }
function historyKey(key, unit, interval, from, to) { return `${HISTORY_PREFIX}${key}:${unit}:${interval}:${from || ''}:${to}`; }

async function cacheSnapshot(snapshot) {
  snapshots.set(snapshot.instrumentKey, snapshot);
  await redis.set(snapshotKey(snapshot.instrumentKey), JSON.stringify(snapshot), { EX: env.snapshotCacheSeconds });
}
async function getSnapshot(key) {
  if (snapshots.has(key)) return snapshots.get(key);
  const raw = await redis.get(snapshotKey(key));
  if (!raw) return null;
  try { const value = JSON.parse(raw); snapshots.set(key,value); return value; } catch { return null; }
}

async function primeSnapshot(key) {
  const existing = await getSnapshot(key);
  if (existing) return existing;
  const snapshot = await upstox.fetchOhlc(key);
  await cacheSnapshot(snapshot);
  return snapshot;
}

async function reconcileKnownInstrumentsOnStartup() {
  if (!env.reconcileOnStartup || isMarketOpen() || !env.startupInstrumentKeys.length) return;
  logger.info('Market is closed; reconciling configured instruments from Upstox', { count: env.startupInstrumentKeys.length });
  for (const key of env.startupInstrumentKeys) {
    try {
      const snapshot = await upstox.fetchOhlc(key);
      await cacheSnapshot(snapshot);
      if (env.mysqlEnabled) await saveDailyClose(snapshot, indiaDate());
    } catch (err) {
      logger.error('Startup close reconciliation failed', { instrumentKey: key, error: err.message });
    }
  }
}

upstox.setTickHandler(async tick => {
  try {
    const previous = snapshots.get(tick.instrumentKey) || {};
    const snapshot = { ...previous, ...tick };
    if (previous.symbol) snapshot.symbol = previous.symbol;
    await cacheSnapshot(snapshot);
    io.to(`stock:${tick.instrumentKey}`).emit('detailStock:tick', snapshot);
  } catch (err) { logger.error('Tick handling failed', { error:err.message }); }
});

io.on('connection', socket => {
  logger.info('DetailStock client connected', { socketId:socket.id });

  socket.on('detailStock:subscribe', async (payload, ack) => {
    const key = payload?.instrumentKey;
    if (!validKey(key)) return ack?.({ success:false, message:'Valid instrumentKey is required' });
    try {
      socket.join(`stock:${key}`);
      if (!subscribers.has(key)) subscribers.set(key, new Set());
      const set = subscribers.get(key);
      const first = set.size === 0;
      set.add(socket.id);
      if (first) await upstox.subscribe(key);
      const snapshot = await primeSnapshot(key);
      socket.emit('detailStock:snapshot', { ...snapshot, marketOpen:isMarketOpen() });
      ack?.({ success:true, subscribed:true, subscriberCount:set.size, snapshot });
      logger.info('Stock subscribed', { socketId:socket.id, instrumentKey:key, subscriberCount:set.size });
    } catch (err) {
      logger.error('Subscribe failed', { error:err.message, instrumentKey:key });
      ack?.({ success:false, message:err.message });
    }
  });

  socket.on('detailStock:unsubscribe', async (payload, ack) => {
    const key = payload?.instrumentKey;
    if (!validKey(key)) return ack?.({ success:false });
    await release(key, socket.id);
    socket.leave(`stock:${key}`);
    ack?.({ success:true });
  });

  socket.on('disconnect', async () => {
    for (const [key, set] of subscribers.entries()) {
      if (set.has(socket.id)) await release(key, socket.id);
    }
    logger.info('DetailStock client disconnected', { socketId:socket.id });
  });
});

async function release(key, socketId) {
  const set = subscribers.get(key);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) {
    subscribers.delete(key);
    await upstox.unsubscribe(key);
    logger.info('Stock unsubscribed from Upstox', { instrumentKey:key });
  }
}

app.get('/health', async (req,res) => {
  let redisOk = false;
  try { redisOk = redis.isReady; } catch {}
  res.json({ success:true, service:'detailStock', marketOpen:isMarketOpen(), redis:redisOk, upstoxSubscribed:upstox.getSubscribed().length, time:new Date().toISOString() });
});

app.get('/api/detail-stock/snapshot/:instrumentKey', async (req,res) => {
  const key = req.params.instrumentKey;
  if (!validKey(key)) return res.status(400).json({ success:false, message:'Invalid instrumentKey' });
  try {
    const snapshot = await primeSnapshot(key);
    res.json({ success:true, marketOpen:isMarketOpen(), data:snapshot });
  } catch (err) { res.status(502).json({ success:false, message:err.response?.data || err.message }); }
});

app.get('/api/detail-stock/history/:instrumentKey', async (req,res) => {
  const key = req.params.instrumentKey;
  const unit = ['minutes','hours','days','weeks','months'].includes(req.query.unit) ? req.query.unit : 'days';
  const interval = String(req.query.interval || (unit === 'days' || unit === 'weeks' || unit === 'months' ? '1' : '1'));
  const to = String(req.query.to || indiaDate());
  const from = req.query.from ? String(req.query.from) : undefined;
  if (!validKey(key)) return res.status(400).json({ success:false, message:'Invalid instrumentKey' });
  const cacheKey = historyKey(key,unit,interval,from,to);
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return res.json({ success:true, source:'cache', data:JSON.parse(cached) });
    let data = await upstox.fetchHistory(key,unit,interval,to,from);
    if ((!data || !data.length) && unit === 'days') data = await getDbHistory(key, from || '2000-01-01', to);
    await redis.set(cacheKey, JSON.stringify(data), { EX:env.historyCacheSeconds });
    res.json({ success:true, source:'upstox', data });
  } catch (err) {
    try {
      const dbData = await getDbHistory(key, from || '2000-01-01', to);
      if (dbData.length) return res.json({ success:true, source:'database', data:dbData });
    } catch {}
    res.status(502).json({ success:false, message:err.response?.data || err.message });
  }
});

app.get('/api/detail-stock/status/:instrumentKey', async (req,res) => {
  const key=req.params.instrumentKey;
  res.json({ success:true, instrumentKey:key, marketOpen:isMarketOpen(), subscriberCount:subscribers.get(key)?.size || 0, subscribed:upstox.getSubscribed().includes(key), snapshot:await getSnapshot(key) });
});

async function persistClosingPrices() {
  if (!env.mysqlEnabled) return;
  const date = indiaDate();
  for (const [key, snapshot] of snapshots.entries()) {
    try { await saveDailyClose(snapshot,date); } catch (err) { logger.error('Close persistence failed',{instrumentKey:key,error:err.message}); }
  }
  logger.info('Official closing prices persisted',{date,count:snapshots.size});
}

cron.schedule('35 15 * * 1-5', persistClosingPrices, { timezone:env.timezone });

(async () => {
  try {
    await connectRedis();
    await initDb();
    await reconcileKnownInstrumentsOnStartup();
    server.listen(env.port, () => logger.info('detailStock started',{port:env.port}));
  } catch (err) {
    logger.error('Startup failed',{error:err.stack || err.message});
    process.exit(1);
  }
})();

process.on('SIGTERM', async()=>{ try{await redis.quit();}catch{} process.exit(0); });
process.on('SIGINT', async()=>{ try{await redis.quit();}catch{} process.exit(0); });
