const cache = new Map();

export function getCached(key) {
    const entry = cache.get(key);

    if (!entry) {
        return null;
    }

    return {
        data: entry.data,
        timestamp: entry.timestamp,
        stale:
            Date.now() - entry.timestamp >
            entry.ttl,
    };
}

export function setCached(
    key,
    data,
    ttl = 5 * 60 * 1000
) {
    cache.set(key, {
        data,
        timestamp: Date.now(),
        ttl,
    });
}

export function removeCached(key) {
    cache.delete(key);
}

export function clearAllCache() {
    cache.clear();
}

export function clearCachePrefix(prefix) {
    for (const key of cache.keys()) {
        if (key.startsWith(prefix)) {
            cache.delete(key);
        }
    }
}