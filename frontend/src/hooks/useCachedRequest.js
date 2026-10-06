import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
    getCached,
    setCached,
} from "../utils/cacheStore";

export default function useCachedRequest({
    cacheKey,
    url,
    ttl = 5 * 60 * 1000,
    enabled = true,
}) {
    const cached = enabled
        ? getCached(cacheKey)
        : null;

    const [data, setData] = useState(
        cached?.data ?? null
    );

    const [loading, setLoading] = useState(
        enabled && !cached
    );

    const [error, setError] = useState(null);

    const refresh = useCallback(
        async (showLoading = false) => {
            if (!enabled) return;

            try {
                if (showLoading) {
                    setLoading(true);
                }

                setError(null);

                const response =
                    await axios.get(url);

                const result = response.data;

                setData(result);

                setCached(
                    cacheKey,
                    result,
                    ttl
                );
            } catch (err) {
                console.error(
                    `Request failed: ${cacheKey}`,
                    err
                );

                setError(err);
            } finally {
                setLoading(false);
            }
        },
        [
            cacheKey,
            url,
            ttl,
            enabled,
        ]
    );

    useEffect(() => {
        if (!enabled) return;

        /*
         * First visit:
         * show loading and fetch.
         *
         * Returning visit:
         * cached data already exists,
         * so fetch silently in background.
         */
        refresh(!cached);
    }, [enabled, refresh]);

    return {
        data,
        loading,
        error,
        refresh,
    };
}