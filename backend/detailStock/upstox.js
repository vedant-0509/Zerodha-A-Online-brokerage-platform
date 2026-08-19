const axios = require('axios');
const Upstox = require('upstox-js-sdk');
const env = require('./env');
const logger = require('./logger');

const defaultClient = Upstox.ApiClient.instance;
defaultClient.authentications['OAUTH2'].accessToken = env.upstoxAccessToken;

let streamer = null;
let connected = false;
let onTick = null;
const subscribed = new Set();

function safeJson(data) {
  if (data == null) return null;
  if (typeof data === 'object' && !Buffer.isBuffer(data)) return data;
  const text = Buffer.isBuffer(data) ? data.toString('utf8') : String(data);
  try { return JSON.parse(text); } catch { return null; }
}

function findFeed(payload, key) {
  if (!payload) return null;
  const feed = payload.feeds?.[key] || payload.data?.feeds?.[key];
  if (!feed) return null;
  return feed;
}

function normalizeFeed(instrumentKey, feed) {
  const root = feed?.fullFeed?.marketFF || feed?.fullFeed?.indexFF || feed?.marketFF || feed?.indexFF || feed?.ff || feed;
  const ltpc = root?.ltpc || feed?.ltpc || {};
  const ext = root?.eFeedDetails || root?.extendedFeedDetails || {};
  const ohlc = root?.marketOHLC?.ohlc || feed?.marketOHLC?.ohlc || [];
  const day = ohlc.find(x => x.interval === '1d');
  const price = Number(ltpc.ltp ?? root?.ltp ?? feed?.ltp ?? NaN);
  const previousClose = Number(ltpc.cp ?? ext.lastClose ?? root?.lastClose ?? NaN);
  const daily = day || {};
  const open = Number(daily.open ?? root?.open ?? NaN);
  const high = Number(daily.high ?? root?.high ?? NaN);
  const low = Number(daily.low ?? root?.low ?? NaN);
  const volume = Number(daily.volume ?? ext.tv ?? root?.volume ?? NaN);
  if (!Number.isFinite(price) && !Number.isFinite(previousClose)) return null;
  return { instrumentKey, price:Number.isFinite(price) ? price : previousClose, previousClose:Number.isFinite(previousClose) ? previousClose : null, open:Number.isFinite(open) ? open : null, high:Number.isFinite(high) ? high : null, low:Number.isFinite(low) ? low : null, volume:Number.isFinite(volume) ? volume : null, timestamp: new Date().toISOString(), source:'upstox' };
}

function ensureStreamer() {
  if (streamer) return streamer;
  streamer = new Upstox.MarketDataStreamerV3();
  streamer.autoReconnect(true, 5, 1000000);
  streamer.on('open', () => {
    connected = true;
    logger.info('Upstox WebSocket connected');
    if (subscribed.size) streamer.subscribe([...subscribed], env.upstoxStreamMode);
  });
  streamer.on('close', () => { connected = false; logger.warn('Upstox WebSocket closed'); });
  streamer.on('error', err => logger.error('Upstox WebSocket error', { error: err?.message || String(err) }));
  streamer.on('message', raw => {
    const payload = safeJson(raw);
    if (!payload) return;
    for (const key of subscribed) {
      const feed = findFeed(payload, key);
      const tick = normalizeFeed(key, feed);
      if (tick && onTick) onTick(tick);
    }
  });
  streamer.connect();
  return streamer;
}

async function subscribe(key) {
  const s = ensureStreamer();
  const was = subscribed.has(key);
  subscribed.add(key);
  if (connected && !was) s.subscribe([key], env.upstoxStreamMode);
}

async function unsubscribe(key) {
  if (!streamer || !subscribed.has(key)) return;
  subscribed.delete(key);
  if (connected) streamer.unsubscribe([key]);
}

async function fetchOhlc(instrumentKey) {
  const response = await axios.get('https://api.upstox.com/v3/market-quote/ohlc', {
    params: { instrument_key: instrumentKey, interval:'1d' },
    headers: { Accept:'application/json', Authorization:`Bearer ${env.upstoxAccessToken}` }, timeout:10000
  });
  const values = Object.values(response.data?.data || {});
  const q = values[0];
  if (!q) throw new Error('No OHLC data returned by Upstox');
  return { instrumentKey, price:Number(q.last_price), open:q.live_ohlc?.open ?? q.prev_ohlc?.open, high:q.live_ohlc?.high ?? q.prev_ohlc?.high, low:q.live_ohlc?.low ?? q.prev_ohlc?.low, previousClose:q.prev_ohlc?.close ?? null, volume:q.live_ohlc?.volume ?? null, timestamp:new Date().toISOString(), source:'upstox-rest' };
}

async function fetchHistory(instrumentKey, unit, interval, to, from) {
  const path = `https://api.upstox.com/v3/historical-candle/${encodeURIComponent(instrumentKey)}/${unit}/${interval}/${to}${from ? `/${from}` : ''}`;
  const response = await axios.get(path, { headers:{ Accept:'application/json', Authorization:`Bearer ${env.upstoxAccessToken}` }, timeout:15000 });
  const candles = response.data?.data?.candles || [];
  return candles.map(c => ({ timestamp:c[0], open:Number(c[1]), high:Number(c[2]), low:Number(c[3]), close:Number(c[4]), volume:Number(c[5] || 0), openInterest:Number(c[6] || 0) })).sort((a,b)=>new Date(a.timestamp)-new Date(b.timestamp));
}

function setTickHandler(fn) { onTick = fn; }
function getSubscribed() { return [...subscribed]; }

module.exports = { subscribe, unsubscribe, fetchOhlc, fetchHistory, setTickHandler, getSubscribed };
