const cache = new Map();

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

export function getPageCache(key) {
    const entry = cache.get(key);

    if (!entry) {
        return null;
    }

    return {
        data: entry.data,
        isFresh: Date.now() - entry.timestamp < entry.ttl,
    };
}

export function setPageCache(
    key,
    data,
    ttl = DEFAULT_TTL
) {
    cache.set(key, {
        data,
        timestamp: Date.now(),
        ttl,
    });
}

export function clearPageCache() {
    cache.clear();
}

export function clearPageCacheByPrefix(prefix) {
    for (const key of cache.keys()) {
        if (key.startsWith(prefix)) {
            cache.delete(key);
        }
    }
}