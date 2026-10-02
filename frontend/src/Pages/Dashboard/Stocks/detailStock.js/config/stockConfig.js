// // export const DETAIL_API = "http://localhost:3011";
// // export const STOCK_API = "http://localhost:3001";

// // export const SYMBOL_ISIN_MAP = {
// //   // RELIANCE: "INE002A01018",
// //   PFC: "INE134E01011",
// //   TCS: "INE467B01029",
// //   INFY: "INE009A01021",
// //   HDFCBANK: "INE040A01034",
// //   ICICIBANK: "INE090A01021",
// //   BHARTIARTL: "INE397D01024",
// //   ITC: "INE154A01025",
// //   LTIM: "INE214T01019",
// //   ADANIPORTS: "INE742F01042",
// // };

// // export const ENDPOINTS = {
// //   stock: (symbol) => `${STOCK_API}/stock/${encodeURIComponent(symbol)}`,
// //   marketStatus: () => `${DETAIL_API}/api/detail-stock/market-status`,
// //   snapshot: (instrumentKey) => `${DETAIL_API}/api/detail-stock/snapshot/${encodeURIComponent(instrumentKey)}`,
// //   history: (instrumentKey, params) =>
// //     `${DETAIL_API}/api/detail-stock/history/${encodeURIComponent(instrumentKey)}?unit=${encodeURIComponent(params.unit)}&interval=${encodeURIComponent(params.interval)}&from=${encodeURIComponent(params.from)}&to=${encodeURIComponent(params.to)}`,
// //   fundamentals: (isin) => `${DETAIL_API}/api/detail-stock/fundamentals/${encodeURIComponent(isin)}`,
// //   shareholding: (isin) => `${DETAIL_API}/api/detail-stock/shareholding/${encodeURIComponent(isin)}`,
// //   financials: (isin) => `${DETAIL_API}/api/detail-stock/financial-performance/${encodeURIComponent(isin)}`,
// //   mutualFunds: (isin) => `${DETAIL_API}/api/detail-stock/mutual-funds/${encodeURIComponent(isin)}`,
// //   profile: (isin) => `${DETAIL_API}/api/detail-stock/profile/${encodeURIComponent(isin)}`,
// //   order: () => `${DETAIL_API}/api/detail-stock/order`,
// // };

// // export const RANGES = ["1D", "1W", "1M", "3M", "6M", "1Y", "3Y", "5Y", "All"];
// // export const CHART_WIDTH = 1000;
// // export const CHART_HEIGHT = 500;
// // export const CHART_PADDING_X = 10;
// // export const CHART_PADDING_Y = 20;
// // export const LIVE_TICK_THROTTLE_MS = 300;



















// export const DETAIL_API = "http://localhost:3011";
// export const STOCK_API = "http://localhost:3001";

// export const SYMBOL_ISIN_MAP = {
//   // RELIANCE: "INE002A01018",
//   PFC: "INE134E01011",
//   TCS: "INE467B01029",
//   INFY: "INE009A01021",
//   HDFCBANK: "INE040A01034",
//   ICICIBANK: "INE090A01021",
//   BHARTIARTL: "INE397D01024",
//   ITC: "INE154A01025",
//   LTIM: "INE214T01019",
//   ADANIPORTS: "INE742F01042",
// };

// export const ENDPOINTS = {
//   stock: (symbol) =>
//     `${STOCK_API}/stock/${encodeURIComponent(symbol)}`,

//   marketStatus: () =>
//     `${DETAIL_API}/api/detail-stock/market-status`,

//   snapshot: (instrumentKey) =>
//     `${DETAIL_API}/api/detail-stock/snapshot/${encodeURIComponent(
//       instrumentKey
//     )}`,

//   /*
//    * History endpoint
//    *
//    * IMPORTANT:
//    * - Do not send "from=undefined" for 1D.
//    * - refresh=1 is used after market close so the backend
//    *   can bypass Redis and fetch the latest official history.
//    */
//   history: (instrumentKey, params = {}) => {
//     const query = new URLSearchParams();

//     if (params.unit) {
//       query.set("unit", params.unit);
//     }

//     if (params.interval) {
//       query.set("interval", params.interval);
//     }

//     if (params.from) {
//       query.set("from", params.from);
//     }

//     if (params.to) {
//       query.set("to", params.to);
//     }

//     /*
//      * Used when the market changes from OPEN -> CLOSED.
//      * This tells the backend that we want fresh official
//      * historical data instead of an old Redis response.
//      */
//     if (params.refresh) {
//       query.set("refresh", "1");
//     }

//     return (
//       `${DETAIL_API}/api/detail-stock/history/` +
//       `${encodeURIComponent(instrumentKey)}?${query.toString()}`
//     );
//   },

//   fundamentals: (isin) =>
//     `${DETAIL_API}/api/detail-stock/fundamentals/${encodeURIComponent(
//       isin
//     )}`,

//   shareholding: (isin) =>
//     `${DETAIL_API}/api/detail-stock/shareholding/${encodeURIComponent(
//       isin
//     )}`,

//   financials: (identifier) =>
//     `${DETAIL_API}/api/detail-stock/financial-performance/${encodeURIComponent(
//       identifier
//     )}`,

//   mutualFunds: (isin) =>
//     `${DETAIL_API}/api/detail-stock/mutual-funds/${encodeURIComponent(
//       isin
//     )}`,

//   profile: (isin) =>
//     `${DETAIL_API}/api/detail-stock/profile/${encodeURIComponent(
//       isin
//     )}`,

//   order: () =>
//     `${DETAIL_API}/api/detail-stock/order`,
// };

// export const RANGES = [
//   "1D",
//   "1W",
//   "1M",
//   "3M",
//   "6M",
//   "1Y",
//   "3Y",
//   "5Y",
//   "All",
// ];

// export const CHART_WIDTH = 1000;
// export const CHART_HEIGHT = 500;

// export const CHART_PADDING_X = 10;
// export const CHART_PADDING_Y = 20;

// /*
//  * Live chart update frequency.
//  *
//  * 300ms means the UI can update roughly 3 times per second
//  * while still avoiding excessive React re-renders.
//  */
// export const LIVE_TICK_THROTTLE_MS = 300;



























// export const DETAIL_API = "";
// export const STOCK_API = "/api/stocks";

// export const SYMBOL_ISIN_MAP = {
//   // RELIANCE: "INE002A01018",
//   PFC: "INE134E01011",
//   TCS: "INE467B01029",
//   INFY: "INE009A01021",
//   HDFCBANK: "INE040A01034",
//   ICICIBANK: "INE090A01021",
//   BHARTIARTL: "INE397D01024",
//   ITC: "INE154A01025",
//   LTIM: "INE214T01019",
//   ADANIPORTS: "INE742F01042",
// };

// export const ENDPOINTS = {
//   stock: (symbol) => `${STOCK_API}/stock/${encodeURIComponent(symbol)}`,
//   marketStatus: () => `${DETAIL_API}/api/detail-stock/market-status`,
//   snapshot: (instrumentKey) => `${DETAIL_API}/api/detail-stock/snapshot/${encodeURIComponent(instrumentKey)}`,
//   history: (instrumentKey, params) =>
//     `${DETAIL_API}/api/detail-stock/history/${encodeURIComponent(instrumentKey)}?unit=${encodeURIComponent(params.unit)}&interval=${encodeURIComponent(params.interval)}&from=${encodeURIComponent(params.from)}&to=${encodeURIComponent(params.to)}`,
//   fundamentals: (isin) => `${DETAIL_API}/api/detail-stock/fundamentals/${encodeURIComponent(isin)}`,
//   shareholding: (isin) => `${DETAIL_API}/api/detail-stock/shareholding/${encodeURIComponent(isin)}`,
//   financials: (isin) => `${DETAIL_API}/api/detail-stock/financial-performance/${encodeURIComponent(isin)}`,
//   mutualFunds: (isin) => `${DETAIL_API}/api/detail-stock/mutual-funds/${encodeURIComponent(isin)}`,
//   profile: (isin) => `${DETAIL_API}/api/detail-stock/profile/${encodeURIComponent(isin)}`,
//   order: () => `${DETAIL_API}/api/detail-stock/order`,
// };

// export const RANGES = ["1D", "1W", "1M", "3M", "6M", "1Y", "3Y", "5Y", "All"];
// export const CHART_WIDTH = 1000;
// export const CHART_HEIGHT = 500;
// export const CHART_PADDING_X = 10;
// export const CHART_PADDING_Y = 20;
// export const LIVE_TICK_THROTTLE_MS = 300;



















export const DETAIL_API = "";
export const STOCK_API = "/api/stocks";

export const SYMBOL_ISIN_MAP = {
  // RELIANCE: "INE002A01018",
  PFC: "INE134E01011",
  TCS: "INE467B01029",
  INFY: "INE009A01021",
  HDFCBANK: "INE040A01034",
  ICICIBANK: "INE090A01021",
  BHARTIARTL: "INE397D01024",
  ITC: "INE154A01025",
  LTIM: "INE214T01019",
  ADANIPORTS: "INE742F01042",
};

export const ENDPOINTS = {
  stock: (symbol) =>
    `${STOCK_API}/stock/${encodeURIComponent(symbol)}`,

  marketStatus: () =>
    `${DETAIL_API}/api/detail-stock/market-status`,

  snapshot: (instrumentKey) =>
    `${DETAIL_API}/api/detail-stock/snapshot/${encodeURIComponent(
      instrumentKey
    )}`,

  /*
   * History endpoint
   *
   * IMPORTANT:
   * - Do not send "from=undefined" for 1D.
   * - refresh=1 is used after market close so the backend
   *   can bypass Redis and fetch the latest official history.
   */
  history: (instrumentKey, params = {}) => {
    const query = new URLSearchParams();

    if (params.unit) {
      query.set("unit", params.unit);
    }

    if (params.interval) {
      query.set("interval", params.interval);
    }

    if (params.from) {
      query.set("from", params.from);
    }

    if (params.to) {
      query.set("to", params.to);
    }

    /*
     * Used when the market changes from OPEN -> CLOSED.
     * This tells the backend that we want fresh official
     * historical data instead of an old Redis response.
     */
    if (params.refresh) {
      query.set("refresh", "1");
    }

    return (
      `${DETAIL_API}/api/detail-stock/history/` +
      `${encodeURIComponent(instrumentKey)}?${query.toString()}`
    );
  },

  fundamentals: (isin) =>
    `${DETAIL_API}/api/detail-stock/fundamentals/${encodeURIComponent(
      isin
    )}`,

  shareholding: (isin) =>
    `${DETAIL_API}/api/detail-stock/shareholding/${encodeURIComponent(
      isin
    )}`,

  financials: (identifier) =>
    `${DETAIL_API}/api/detail-stock/financial-performance/${encodeURIComponent(
      identifier
    )}`,

  mutualFunds: (isin) =>
    `${DETAIL_API}/api/detail-stock/mutual-funds/${encodeURIComponent(
      isin
    )}`,

  profile: (isin) =>
    `${DETAIL_API}/api/detail-stock/profile/${encodeURIComponent(
      isin
    )}`,

  order: () =>
    `${DETAIL_API}/api/detail-stock/order`,
};

export const RANGES = [
  "1D",
  "1W",
  "1M",
  "3M",
  "6M",
  "1Y",
  "3Y",
  "5Y",
  "All",
];

export const CHART_WIDTH = 1000;
export const CHART_HEIGHT = 500;

export const CHART_PADDING_X = 10;
export const CHART_PADDING_Y = 20;

/*
 * Live chart update frequency.
 *
 * 300ms means the UI can update roughly 3 times per second
 * while still avoiding excessive React re-renders.
 */
export const LIVE_TICK_THROTTLE_MS = 300;