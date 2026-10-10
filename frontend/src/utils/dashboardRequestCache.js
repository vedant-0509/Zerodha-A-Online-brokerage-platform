import axios from "axios";

import { getCached, setCached, clearAllCache } from "./cacheStore";

const inflight = new Map();

const CACHE_DEFAULT_TTL = 30 * 1000; // 30 seconds

/**
 * Force the next dashboard read to hit the API instead of this in-memory cache.
 */
export function invalidateDashboardCache() {
    clearAllCache();
}

/**
 * Notify mounted portfolio screens after a successful trade/watchlist mutation.
 * type: "trade", "watchlist", or "all".
 */
export function notifyDashboardDataChanged(type = "all", source = null) {
    clearAllCache();

    if (typeof window !== "undefined") {
        window.dispatchEvent(
            new CustomEvent("dashboard:data-changed", {
                detail: { type, source },
            }),
        );
    }
}

/* =========================================================
   USER SCOPE
   Prevent cached private data from being shared between users.
========================================================= */

function getUserScope() {
    try {
        const storedUser = localStorage.getItem("user");

        if (!storedUser) {
            return "guest";
        }

        const user = JSON.parse(storedUser);

        return String(
            user?.user_id ??
            user?.userId ??
            user?.id ??
            user?.email ??
            "authenticated",
        );
    } catch {
        return "authenticated";
    }
}

/* =========================================================
   URL HELPERS
========================================================= */

function getAbsoluteUrl(url, baseURL = window.location.origin) {
    try {
        return new URL(url, baseURL).toString();
    } catch {
        return String(url);
    }
}

function isDashboardApiUrl(url) {
    try {
        const parsed = new URL(url, window.location.origin);

        return (
            parsed.pathname.startsWith("/api/") ||
            parsed.hostname.includes("zerodha-backend")
        );
    } catch {
        return false;
    }
}

/* =========================================================
   DO NOT CACHE AUTH / LIVE / FILE REQUESTS
========================================================= */

function isExcludedUrl(url) {
    try {
        const parsed = new URL(url, window.location.origin);
        const pathname = parsed.pathname.toLowerCase();

        if (
            pathname.includes("/login") ||
            pathname.includes("/logout") ||
            pathname.includes("/signup") ||
            pathname.includes("/auth/me") ||
            pathname.includes("/me")
        ) {
            return true;
        }

        // Mutual Fund Top Returns uses offset-based pagination.
        // It must bypass the global dashboard cache because
        // different offsets must return different pages.
        if (pathname === "/api/mutual-funds/top-returns") {
            return true;
        }
        if (pathname === "/api/mutual-funds") {
            return true;
        }

        return false;
    } catch {
        return false;
    }
}

/* =========================================================
   TTL POLICY
========================================================= */

function getTTL(url) {
    try {
        const parsed = new URL(url, window.location.origin);
        const pathname = parsed.pathname.toLowerCase();

        /* Stock detail:
               Keep short because live Socket.IO is also active.
            */
        if (pathname.includes("/detail-stock/")) {
            return 10 * 1000;
        }

        /* Stocks */
        if (pathname.includes("/stocks/")) {
            return 30 * 1000;
        }

        /* Holdings */
        if (pathname.includes("/holdings")) {
            return 30 * 1000;
        }

        /* Orders */
        if (pathname.includes("/orders")) {
            return 30 * 1000;
        }

        /* Watchlist */
        if (pathname.includes("/watchlist")) {
            return 30 * 1000;
        }

        /* Mutual funds */
        if (pathname.includes("/mutual-funds/")) {
            return 60 * 1000;
        }

        return CACHE_DEFAULT_TTL;
    } catch {
        return CACHE_DEFAULT_TTL;
    }
}

/* =========================================================
   CACHE KEY
========================================================= */

function createCacheKey(url) {
    const privateScope = getUserScope();

    return `dashboard:${privateScope}:${url}`;
}

/* =========================================================
   AXIOS RESPONSE SHAPE FOR CACHED DATA
========================================================= */

function createAxiosResponse(data, config) {
    return {
        data,
        status: 200,
        statusText: "OK",
        headers: {},
        config,
        request: null,
    };
}

/* =========================================================
   AXIOS GLOBAL GET CACHE
========================================================= */

const AxiosPrototype = axios.Axios?.prototype;

if (AxiosPrototype && !AxiosPrototype.__dashboardCachePatched) {
    const originalRequest = AxiosPrototype.request;

    AxiosPrototype.request = function dashboardCachedRequest(config) {
        const method = String(config?.method || "get").toLowerCase();

        if (method !== "get" || typeof window === "undefined") {
            return originalRequest.call(this, config);
        }

        const absoluteUrl = getAbsoluteUrl(
            config?.url,
            config?.baseURL || window.location.origin,
        );

        if (!isDashboardApiUrl(absoluteUrl) || isExcludedUrl(absoluteUrl)) {
            return originalRequest.call(this, config);
        }

        const cacheKey = createCacheKey(absoluteUrl);
        const ttl = getTTL(absoluteUrl);

        const cached = getCached(cacheKey);

        /* =================================================
               FRESH CACHE
            ================================================= */

        if (cached && !cached.stale) {
            return Promise.resolve(createAxiosResponse(cached.data, config));
        }

        /* =================================================
               STALE CACHE
               Show old data immediately.
               Refresh silently in background.
            ================================================= */

        if (cached && cached.stale) {
            if (!inflight.has(cacheKey)) {
                const refreshPromise = originalRequest
                    .call(this, config)
                    .then((response) => {
                        if (response?.status >= 200 && response?.status < 300) {
                            setCached(cacheKey, response.data, ttl);
                        }

                        return response;
                    })
                    .catch((error) => {
                        console.error(
                            `[Dashboard Cache] Background refresh failed: ${absoluteUrl}`,
                            error,
                        );

                        throw error;
                    })
                    .finally(() => {
                        inflight.delete(cacheKey);
                    });

                inflight.set(cacheKey, refreshPromise);
            }

            return Promise.resolve(createAxiosResponse(cached.data, config));
        }

        /* =================================================
               REQUEST ALREADY IN PROGRESS
            ================================================= */

        if (inflight.has(cacheKey)) {
            return inflight
                .get(cacheKey)
                .then((response) => createAxiosResponse(response.data, config));
        }

        /* =================================================
               FIRST REQUEST
            ================================================= */

        const requestPromise = originalRequest
            .call(this, config)
            .then((response) => {
                if (response?.status >= 200 && response?.status < 300) {
                    setCached(cacheKey, response.data, ttl);
                }

                return response;
            })
            .finally(() => {
                inflight.delete(cacheKey);
            });

        inflight.set(cacheKey, requestPromise);

        return requestPromise;
    };

    AxiosPrototype.__dashboardCachePatched = true;
}

/* =========================================================
   FETCH CACHE
   Covers pages using fetch() instead of axios.
========================================================= */

if (typeof window !== "undefined" && !window.__dashboardFetchCachePatched) {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async function dashboardCachedFetch(input, init = {}) {
        const request = input instanceof Request ? input : null;

        const method = String(
            init?.method || request?.method || "GET",
        ).toUpperCase();

        const rawUrl = typeof input === "string" ? input : input?.url;

        const absoluteUrl = getAbsoluteUrl(rawUrl);

        /* =================================================
               MUTATIONS
               Clear old cached dashboard data.
            ================================================= */

        if (method !== "GET") {
            const response = await originalFetch(input, init);

            if (
                method === "POST" ||
                method === "PUT" ||
                method === "PATCH" ||
                method === "DELETE"
            ) {
                clearAllCache();
            }

            return response;
        }

        if (!isDashboardApiUrl(absoluteUrl) || isExcludedUrl(absoluteUrl)) {
            return originalFetch(input, init);
        }

        const cacheKey = createCacheKey(absoluteUrl);

        const ttl = getTTL(absoluteUrl);

        const cached = getCached(cacheKey);

        /* =================================================
               FRESH CACHE
            ================================================= */

        if (cached && !cached.stale) {
            return new Response(JSON.stringify(cached.data), {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                },
            });
        }

        /* =================================================
               STALE CACHE
               Return instantly and refresh silently.
            ================================================= */

        if (cached && cached.stale) {
            if (!inflight.has(cacheKey)) {
                const refreshPromise = originalFetch(input, init)
                    .then(async (response) => {
                        if (response.ok) {
                            try {
                                const data = await response.clone().json();

                                setCached(cacheKey, data, ttl);
                            } catch {
                                /* Non-JSON response:
                                                       don't cache it.
                                                    */
                            }
                        }

                        return response;
                    })
                    .catch((error) => {
                        console.error(
                            `[Dashboard Cache] Background refresh failed: ${absoluteUrl}`,
                            error,
                        );

                        throw error;
                    })
                    .finally(() => {
                        inflight.delete(cacheKey);
                    });

                inflight.set(cacheKey, refreshPromise);
            }

            return new Response(JSON.stringify(cached.data), {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                },
            });
        }

        /* =================================================
               REQUEST ALREADY IN PROGRESS
            ================================================= */

        if (inflight.has(cacheKey)) {
            const response = await inflight.get(cacheKey);

            return new Response(JSON.stringify(response.data), {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                },
            });
        }

        /* =================================================
               FIRST FETCH
            ================================================= */

        const requestPromise = originalFetch(input, init)
            .then(async (response) => {
                if (response.ok) {
                    try {
                        const data = await response.clone().json();

                        setCached(cacheKey, data, ttl);
                    } catch {
                        /* Ignore non-JSON */
                    }
                }

                return response;
            })
            .finally(() => {
                inflight.delete(cacheKey);
            });

        inflight.set(cacheKey, requestPromise);

        return requestPromise;
    };

    window.__dashboardFetchCachePatched = true;
}

/* =========================================================
   CLEAR CACHE WHEN AUTH SESSION CHANGES
========================================================= */

if (typeof window !== "undefined" && !window.__dashboardAuthCacheListener) {
    window.addEventListener("auth-expired", () => {
        clearAllCache();
    });

    window.addEventListener("storage", (event) => {
        if (event.key === "token" && !event.newValue) {
            clearAllCache();
        }
    });

    window.__dashboardAuthCacheListener = true;
}
